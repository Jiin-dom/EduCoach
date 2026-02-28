/**
 * AI Tutor Edge Function — RAG Chat
 *
 * 1. Embeds the student's question (gemini-embedding-001)
 * 2. Searches document_embeddings via match_documents()
 * 3. Fetches full chunk text + document titles for context
 * 4. Builds a grounded prompt with Bloom's Taxonomy level
 * 5. Calls Gemini to generate an answer
 * 6. Persists the exchange in chat_messages for traceability
 * 7. Returns the answer + source citations
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000
const SIMILARITY_THRESHOLD = 0.5
const MAX_CHUNKS = 6
const CONVERSATION_HISTORY_LIMIT = 4
const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

// Bloom's Taxonomy prompt modifiers
const BLOOM_INSTRUCTIONS: Record<string, string> = {
    remember: 'Give a direct, factual answer. List key facts and definitions.',
    understand: 'Explain the concept in simple terms. Use analogies if helpful.',
    apply: 'Show how this concept is used in practice. Give a concrete example.',
    analyze: 'Break this down into its component parts. Compare and contrast where relevant.',
    evaluate: 'Discuss strengths and weaknesses. Provide a critical assessment.',
    create: 'Help the student synthesize new ideas. Suggest connections between concepts.',
}

interface ChatRequest {
    message: string
    bloomLevel: string
    conversationId?: string
    documentId?: string
}

interface SourceCitation {
    documentId: string
    documentTitle: string
    chunkId: string
    chunkPreview: string
    similarity: number
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!geminiApiKey) {
            throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // --- Auth: extract user_id from JWT ---
        const authHeader = req.headers.get('Authorization')
        let userId: string | null = null

        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '')
                const payload = JSON.parse(atob(token.split('.')[1]))
                userId = payload.sub || null
            } catch {
                console.warn('⚠️ Could not parse JWT, will check body')
            }
        }

        if (!userId) {
            throw new Error('AUTH_ERROR:You must be logged in to use the AI tutor.')
        }

        // --- Parse request ---
        const body: ChatRequest = await req.json()
        const { message, bloomLevel, conversationId, documentId } = body

        if (!message || message.trim().length === 0) {
            throw new Error('INVALID_REQUEST:Please enter a question.')
        }

        console.log('🤖 AI Tutor request:', {
            userId: userId.substring(0, 8) + '...',
            bloomLevel,
            hasConversation: !!conversationId,
            hasDocumentScope: !!documentId,
            messageLength: message.length,
        })

        // --- Step 1: Embed the question ---
        console.log('🔢 Embedding question...')
        const questionEmbedding = await generateEmbedding(message, geminiApiKey)

        // --- Step 2: Vector search via match_documents ---
        console.log('🔍 Searching document embeddings...')
        const { data: matches, error: matchError } = await supabase.rpc(
            'match_documents',
            {
                query_embedding: questionEmbedding,
                match_threshold: SIMILARITY_THRESHOLD,
                match_count: MAX_CHUNKS,
                filter_document_id: documentId || null,
            }
        )

        if (matchError) {
            console.error('❌ Vector search failed:', matchError.message)
            throw new Error('SEARCH_ERROR:Failed to search your study materials. Please try again.')
        }

        const matchedChunks = matches || []
        console.log(`📚 Found ${matchedChunks.length} relevant chunks`)

        // --- Step 3: Answerability check ---
        if (matchedChunks.length === 0) {
            const noContextAnswer = documentId
                ? "I couldn't find relevant information in this document for your question. Try asking about a topic covered in this file, or switch to searching all your documents."
                : "I couldn't find relevant information in your uploaded materials. Make sure you've uploaded and processed documents covering this topic."

            const convId = await ensureConversation(
                supabase, conversationId, userId, documentId || null, message
            )

            await saveMessages(supabase, convId, message, noContextAnswer, bloomLevel, [], [], null)

            return jsonResponse({
                answer: noContextAnswer,
                sources: [],
                conversationId: convId,
                chunksUsed: 0,
            })
        }

        // --- Step 4: Fetch full chunk text + document titles ---
        const chunkIds = matchedChunks.map((m: { chunk_id: string }) => m.chunk_id)
        const docIds = [...new Set(matchedChunks.map((m: { document_id: string }) => m.document_id))]

        const [chunksResult, docsResult] = await Promise.all([
            supabase.from('chunks').select('id, content, chunk_index').in('id', chunkIds),
            supabase.from('documents').select('id, title').in('id', docIds),
        ])

        const chunksMap = new Map<string, { content: string; chunk_index: number }>()
        for (const c of (chunksResult.data || [])) {
            chunksMap.set(c.id, { content: c.content, chunk_index: c.chunk_index })
        }

        const docsMap = new Map<string, string>()
        for (const d of (docsResult.data || [])) {
            docsMap.set(d.id, d.title)
        }

        // Build context and source citations
        const contextBlocks: string[] = []
        const sources: SourceCitation[] = []

        for (const match of matchedChunks) {
            const chunk = chunksMap.get(match.chunk_id)
            const docTitle = docsMap.get(match.document_id) || 'Unknown Document'

            if (chunk) {
                contextBlocks.push(
                    `[Source: ${docTitle}, Section ${chunk.chunk_index + 1}]\n${chunk.content}`
                )
                sources.push({
                    documentId: match.document_id,
                    documentTitle: docTitle,
                    chunkId: match.chunk_id,
                    chunkPreview: chunk.content.substring(0, 150),
                    similarity: match.similarity,
                })
            }
        }

        // --- Step 5: Fetch conversation history for multi-turn ---
        let historyBlock = ''
        if (conversationId) {
            const { data: historyRows } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(CONVERSATION_HISTORY_LIMIT)

            if (historyRows && historyRows.length > 0) {
                const reversed = historyRows.reverse()
                historyBlock = reversed
                    .map((m: { role: string; content: string }) =>
                        `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`
                    )
                    .join('\n')
            }
        }

        // --- Step 6: Build grounded prompt ---
        const bloomInstruction = BLOOM_INSTRUCTIONS[bloomLevel] || BLOOM_INSTRUCTIONS.understand

        const systemPrompt = `You are EduCoach AI Tutor — a helpful, encouraging study assistant.

RULES:
- Answer ONLY using the provided study materials below.
- If the answer is not in the materials, say "I couldn't find that in your uploaded materials."
- Cite which source document and section your answer comes from.
- Be concise but thorough.
- Use markdown formatting for readability (bold key terms, use bullet points where helpful).

LEARNING LEVEL: ${bloomLevel}
${bloomInstruction}

STUDENT'S STUDY MATERIALS:
---
${contextBlocks.join('\n---\n')}
---${historyBlock ? `

CONVERSATION HISTORY:
${historyBlock}` : ''}

STUDENT'S QUESTION: ${message}`

        // --- Step 7: Generate answer ---
        console.log('💬 Generating answer...')
        const answer = await callGemini(systemPrompt, geminiApiKey)

        // --- Step 8: Persist to database ---
        const convId = await ensureConversation(
            supabase, conversationId, userId, documentId || null, message
        )

        const retrievedChunkIds = matchedChunks.map((m: { chunk_id: string }) => m.chunk_id)
        const similarityScores = matchedChunks.map((m: { similarity: number }) => m.similarity)

        await saveMessages(
            supabase, convId, message, answer,
            bloomLevel, retrievedChunkIds, similarityScores, GEMINI_MODEL
        )

        console.log('✅ AI Tutor response generated successfully')

        return jsonResponse({
            answer,
            sources,
            conversationId: convId,
            chunksUsed: matchedChunks.length,
        })

    } catch (error) {
        const errorMessage = (error as Error).message
        console.error('❌ AI Tutor error:', errorMessage)

        let userMessage = 'Something went wrong. Please try again.'
        if (errorMessage.includes(':')) {
            userMessage = errorMessage.split(':').slice(1).join(':')
        }

        return new Response(
            JSON.stringify({ success: false, error: userMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ---------------------------------------------------------------------------
// Helper: ensure a conversation exists (create if needed)
// ---------------------------------------------------------------------------
async function ensureConversation(
    supabase: ReturnType<typeof createClient>,
    existingId: string | undefined,
    userId: string,
    documentId: string | null,
    firstMessage: string,
): Promise<string> {
    if (existingId) {
        return existingId
    }

    const title = firstMessage.length > 60
        ? firstMessage.substring(0, 57) + '...'
        : firstMessage

    const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: userId, document_id: documentId, title })
        .select('id')
        .single()

    if (error || !data) {
        console.error('❌ Failed to create conversation:', error?.message)
        throw new Error('DB_ERROR:Failed to start conversation.')
    }

    return data.id
}

// ---------------------------------------------------------------------------
// Helper: save both user + assistant messages
// ---------------------------------------------------------------------------
async function saveMessages(
    supabase: ReturnType<typeof createClient>,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    bloomLevel: string,
    retrievedChunkIds: string[],
    similarityScores: number[],
    modelUsed: string | null,
): Promise<void> {
    const rows = [
        {
            conversation_id: conversationId,
            role: 'user',
            content: userMessage,
            bloom_level: bloomLevel,
        },
        {
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantMessage,
            bloom_level: bloomLevel,
            retrieved_chunk_ids: retrievedChunkIds,
            similarity_scores: similarityScores,
            model_used: modelUsed,
        },
    ]

    const { error } = await supabase.from('chat_messages').insert(rows)

    if (error) {
        console.error('⚠️ Failed to save chat messages:', error.message)
    }
}

// ---------------------------------------------------------------------------
// Helper: generate embedding (same model as process-document)
// ---------------------------------------------------------------------------
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const maxChars = 8000
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: truncatedText }] },
                outputDimensionality: EMBEDDING_DIMENSIONS,
            }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Embedding API error:', response.status, errorText)
        throw new Error('AI_ERROR:Failed to process your question. Please try again.')
    }

    const data = await response.json()
    const values = data.embedding?.values
    if (!values || values.length === 0) {
        throw new Error('AI_ERROR:Failed to process your question. Please try again.')
    }

    return values
}

// ---------------------------------------------------------------------------
// Helper: call Gemini for answer generation (with retry)
// ---------------------------------------------------------------------------
async function callGemini(prompt: string, apiKey: string): Promise<string> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 2048,
                        },
                    }),
                }
            )

            if (!response.ok) {
                const isRetryable = response.status === 503 || response.status === 429 || response.status === 500
                if (isRetryable && attempt < MAX_RETRIES) {
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                    console.log(`⏳ Retryable error (${response.status}), waiting ${delayMs}ms...`)
                    await new Promise(r => setTimeout(r, delayMs))
                    continue
                }

                if (response.status === 429) {
                    throw new Error('AI_RATE_LIMIT:Too many requests. Please wait a moment and try again.')
                }
                throw new Error(`AI_ERROR:AI service error (${response.status}). Please try again.`)
            }

            const data = await response.json()
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text

            if (!content) {
                const finishReason = data.candidates?.[0]?.finishReason
                if (finishReason === 'SAFETY') {
                    throw new Error('AI_SAFETY:The question was flagged by content safety filters.')
                }
                throw new Error('AI_EMPTY:The AI returned an empty response. Please try rephrasing your question.')
            }

            return content

        } catch (error) {
            if ((error as Error).message.includes(':')) {
                throw error
            }
            if (attempt < MAX_RETRIES) {
                const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                await new Promise(r => setTimeout(r, delayMs))
                continue
            }
            throw new Error('AI_NETWORK:Unable to reach the AI service. Please check your connection.')
        }
    }

    throw new Error('AI_ERROR:Failed after multiple attempts. Please try again later.')
}

// ---------------------------------------------------------------------------
// Helper: JSON response with CORS headers
// ---------------------------------------------------------------------------
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(
        JSON.stringify({ success: true, ...data }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
