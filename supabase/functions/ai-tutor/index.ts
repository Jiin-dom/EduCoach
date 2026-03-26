/**
 * AI Tutor Edge Function — RAG Chat (Remediated)
 *
 * 1. Verifies user identity from JWT via Supabase Auth
 * 2. Embeds the student's question (gemini-embedding-001)
 * 3. Performs user-scoped vector search via match_documents_for_user()
 * 4. Fetches chunk/document context + recent conversation history
 * 5. Generates plain-text AI answer with inferred pedagogy level
 * 6. Persists messages + citation traceability
 * 7. Returns answer + source citations
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

interface ChatRequest {
    message: string
    // Kept optional for backward compatibility with existing clients.
    bloomLevel?: string
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

interface ChatConversationRow {
    id: string
    user_id: string
    document_id: string | null
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('CONFIG_ERROR:Supabase is not configured. Please contact support.')
        }
        if (!geminiApiKey) {
            throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // --- Auth: verify token with Supabase Auth ---
        const userId = await getVerifiedUserId(supabase, req.headers.get('Authorization'))

        // --- Parse request ---
        const body: ChatRequest = await req.json()
        const message = body.message?.trim() ?? ''
        const requestedConversationId = body.conversationId
        const requestedDocumentId = body.documentId || null

        if (!message) {
            throw new Error('INVALID_REQUEST:Please enter a question.')
        }

        if (requestedDocumentId) {
            await ensureDocumentOwnership(supabase, userId, requestedDocumentId)
        }

        let effectiveConversationId = requestedConversationId
        let effectiveDocumentId = requestedDocumentId

        if (requestedConversationId) {
            const conversation = await getOwnedConversation(supabase, requestedConversationId, userId)

            if (conversation.document_id && requestedDocumentId && conversation.document_id !== requestedDocumentId) {
                throw new Error('INVALID_REQUEST:This conversation is already scoped to a different document.')
            }

            // Existing conversation scope takes precedence.
            effectiveDocumentId = conversation.document_id ?? requestedDocumentId
            effectiveConversationId = conversation.id
        }

        console.log('🤖 AI Tutor request:', {
            userId: userId.substring(0, 8) + '...',
            hasConversation: !!effectiveConversationId,
            hasDocumentScope: !!effectiveDocumentId,
            messageLength: message.length,
        })

        // --- Step 1: Embed the question ---
        console.log('🔢 Embedding question...')
        const questionEmbedding = await generateEmbedding(message, geminiApiKey)

        // --- Step 2: User-scoped vector search ---
        console.log('🔍 Searching user-scoped embeddings...')
        const { data: matches, error: matchError } = await supabase.rpc(
            'match_documents_for_user',
            {
                query_embedding: questionEmbedding,
                p_user_id: userId,
                match_threshold: SIMILARITY_THRESHOLD,
                match_count: MAX_CHUNKS,
                filter_document_id: effectiveDocumentId,
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
            const noContextAnswer = effectiveDocumentId
                ? "I couldn't find relevant information in this document for your question. Try asking about a topic covered in this file, or switch to searching all your documents."
                : "I couldn't find relevant information in your uploaded materials. Make sure you've uploaded and processed documents covering this topic."

            const convId = await ensureConversation(
                supabase,
                effectiveConversationId,
                userId,
                effectiveDocumentId,
                message,
            )

            await saveMessages(
                supabase,
                convId,
                message,
                noContextAnswer,
                [],
                [],
                null,
                [],
            )

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
            supabase.from('chunks').select('id, content, chunk_index, document_id').in('id', chunkIds),
            supabase.from('documents').select('id, title, user_id').in('id', docIds),
        ])

        if (chunksResult.error || docsResult.error) {
            console.error('❌ Context fetch failed:', {
                chunksError: chunksResult.error?.message,
                docsError: docsResult.error?.message,
            })
            throw new Error('DB_ERROR:Failed to load source context for your answer.')
        }

        const docsMap = new Map<string, string>()
        for (const d of (docsResult.data || [])) {
            if (d.user_id === userId) {
                docsMap.set(d.id, d.title)
            }
        }

        const chunksMap = new Map<string, { content: string; chunk_index: number; document_id: string }>()
        for (const c of (chunksResult.data || [])) {
            if (docsMap.has(c.document_id)) {
                chunksMap.set(c.id, {
                    content: c.content,
                    chunk_index: c.chunk_index,
                    document_id: c.document_id,
                })
            }
        }

        // Build context and source citations
        const contextBlocks: string[] = []
        const sources: SourceCitation[] = []

        for (const match of matchedChunks) {
            const chunk = chunksMap.get(match.chunk_id)
            const docTitle = docsMap.get(match.document_id)

            if (!chunk || !docTitle) {
                continue
            }

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

        if (contextBlocks.length === 0) {
            throw new Error('SEARCH_ERROR:No accessible sources were found for this question.')
        }

        // --- Step 5: Fetch conversation history for multi-turn ---
        let historyBlock = ''
        if (effectiveConversationId) {
            const { data: historyRows, error: historyError } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('conversation_id', effectiveConversationId)
                .order('created_at', { ascending: false })
                .limit(CONVERSATION_HISTORY_LIMIT)

            if (historyError) {
                console.warn('⚠️ Failed to fetch history:', historyError.message)
            }

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
        const systemPrompt = `You are EduCoach AI Tutor, a helpful study assistant.

RULES:
- Answer ONLY using the provided study materials below.
- If the answer is not in the materials, say: "I couldn't find that in your uploaded materials."
- Infer the student's current understanding level from their wording and conversation history, then adapt depth and explanation style automatically.
- Output plain text only.
- Do NOT use markdown syntax such as **, __, #, or backticks.
- Keep explanations concise but clear. Use short paragraphs. You may use plain bullet lines starting with "- " when useful.
- Cite source document and section in plain text.

STUDENT'S STUDY MATERIALS:
---
${contextBlocks.join('\n---\n')}
---${historyBlock ? `

CONVERSATION HISTORY:
${historyBlock}` : ''}

STUDENT'S QUESTION: ${message}`

        // --- Step 7: Generate answer ---
        console.log('💬 Generating answer...')
        const rawAnswer = await callGemini(systemPrompt, geminiApiKey)
        const answer = sanitizeAiResponse(rawAnswer)

        // --- Step 8: Persist to database ---
        const convId = await ensureConversation(
            supabase,
            effectiveConversationId,
            userId,
            effectiveDocumentId,
            message,
        )

        const retrievedChunkIds = matchedChunks.map((m: { chunk_id: string }) => m.chunk_id)
        const similarityScores = matchedChunks.map((m: { similarity: number }) => m.similarity)

        await saveMessages(
            supabase,
            convId,
            message,
            answer,
            retrievedChunkIds,
            similarityScores,
            GEMINI_MODEL,
            sources,
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

async function getVerifiedUserId(
    supabase: ReturnType<typeof createClient>,
    authHeader: string | null,
): Promise<string> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('AUTH_ERROR:You must be logged in to use the AI tutor.')
    }

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
        throw new Error('AUTH_ERROR:You must be logged in to use the AI tutor.')
    }

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user?.id) {
        console.error('❌ Auth verification failed:', error?.message)
        throw new Error('AUTH_ERROR:Your session is invalid or expired. Please sign in again.')
    }

    return data.user.id
}

async function ensureDocumentOwnership(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    documentId: string,
): Promise<void> {
    const { data, error } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.error('❌ Failed to validate document scope:', error.message)
        throw new Error('DB_ERROR:Failed to validate document scope.')
    }

    if (!data) {
        throw new Error('AUTH_ERROR:You do not have access to this document scope.')
    }
}

async function getOwnedConversation(
    supabase: ReturnType<typeof createClient>,
    conversationId: string,
    userId: string,
): Promise<ChatConversationRow> {
    const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, user_id, document_id')
        .eq('id', conversationId)
        .maybeSingle()

    if (error) {
        console.error('❌ Failed to fetch conversation:', error.message)
        throw new Error('DB_ERROR:Failed to validate conversation.')
    }

    if (!data || data.user_id !== userId) {
        throw new Error('AUTH_ERROR:Conversation not found or access denied.')
    }

    return data as ChatConversationRow
}

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
    retrievedChunkIds: string[],
    similarityScores: number[],
    modelUsed: string | null,
    sourceCitations: SourceCitation[],
): Promise<void> {
    const rows = [
        {
            conversation_id: conversationId,
            role: 'user',
            content: userMessage,
            bloom_level: null,
            source_citations: [],
        },
        {
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantMessage,
            bloom_level: null,
            retrieved_chunk_ids: retrievedChunkIds,
            similarity_scores: similarityScores,
            model_used: modelUsed,
            source_citations: sourceCitations,
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

function sanitizeAiResponse(input: string): string {
    let text = input.replace(/\r\n/g, '\n')

    // Remove common markdown markers while preserving readable text.
    text = text
        .replace(/```/g, '')
        .replace(/`/g, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/^#{1,6}\s*/gm, '')

    // Normalize whitespace but keep paragraph breaks.
    const normalizedLines = text
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())

    text = normalizedLines.join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    if (!text) {
        return "I couldn't generate a clear answer for that question. Please try rephrasing it."
    }

    return text
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
