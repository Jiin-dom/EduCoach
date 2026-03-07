/**
 * Generate Quiz Edge Function
 *
 * Orchestrates quiz generation from a processed document:
 * 1. Fetches chunks + concepts from the database
 * 2. Calls the NLP service /generate-questions for template-driven AQG (Obj3 primary)
 * 3. Optionally enhances with Gemini (improve phrasing, add explanations)
 * 4. Saves quiz + questions to the database
 *
 * Falls back to Gemini-only generation if the NLP service is unavailable.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

interface GenerateQuizRequest {
    documentId: string
    questionCount?: number
    difficulty?: string
    questionTypes?: string[]
    enhanceWithLlm?: boolean
}

interface NlpQuestion {
    chunk_id: string
    question_type: string
    question_text: string
    options?: string[] | null
    correct_answer: string
    difficulty_label: string
    explanation?: string
}

const DIFFICULTY_MAP: Record<string, string> = {
    easy: 'beginner',
    medium: 'intermediate',
    hard: 'advanced',
    mixed: 'mixed',
}

function parseTimeoutMs(value: string | null, fallbackMs: number): number {
    if (!value) return fallbackMs
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs
}

async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeoutId)
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const startTime = Date.now()
    console.log('🚀 generate-quiz Edge Function started')

    let quizId: string | null = null

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || null
        const nlpServiceUrl = Deno.env.get('NLP_SERVICE_URL') || null

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Parse request
        const body: GenerateQuizRequest = await req.json()
        const {
            documentId,
            questionCount = 10,
            difficulty = 'mixed',
            questionTypes = ['multiple_choice', 'identification', 'true_false', 'fill_in_blank'],
            enhanceWithLlm = true,
        } = body

        if (!documentId) {
            throw new Error('INVALID_REQUEST:Document ID is required.')
        }

        console.log(`📄 Generating quiz for document: ${documentId}`)

        // 1. Fetch document
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single()

        if (docError || !document) {
            throw new Error('DOC_NOT_FOUND:The document could not be found.')
        }

        if (document.status !== 'ready') {
            throw new Error('DOC_NOT_READY:The document must be processed before generating a quiz. Please process it first.')
        }

        // 2. Fetch chunks
        const { data: chunks, error: chunkError } = await supabase
            .from('chunks')
            .select('id, content, chunk_index')
            .eq('document_id', documentId)
            .order('chunk_index', { ascending: true })

        if (chunkError) {
            throw new Error(`DB_ERROR:Failed to fetch document chunks. ${chunkError.message}`)
        }

        if (!chunks || chunks.length === 0) {
            throw new Error('NO_CHUNKS:No text chunks found. Please re-process the document.')
        }

        // 3. Fetch concepts (with chunk_id for per-chunk mapping)
        const { data: concepts, error: conceptError } = await supabase
            .from('concepts')
            .select('id, name, description, keywords, importance, chunk_id, difficulty_level, source_pages')
            .eq('document_id', documentId)
            .order('importance', { ascending: false })

        if (conceptError) {
            console.warn('⚠️ Failed to fetch concepts:', conceptError.message)
        }

        const conceptList = concepts || []

        // Build global keyphrases (for document-wide distractor pool)
        const allKeyphrases: string[] = []
        const seenKp = new Set<string>()
        for (const c of conceptList) {
            const phrases = [c.name, ...(c.keywords || [])]
            for (const p of phrases) {
                const low = (p || '').toLowerCase().trim()
                if (low && !seenKp.has(low)) {
                    seenKp.add(low)
                    allKeyphrases.push(p)
                }
            }
        }

        // Build per-chunk concept map: concepts with chunk_id link directly,
        // others matched by keyword/name appearing in chunk content
        const chunkConceptIndex = new Map<string, typeof conceptList>()
        for (const chunk of chunks) {
            const matched: typeof conceptList = []
            const contentLower = chunk.content.toLowerCase()
            for (const c of conceptList) {
                if (c.chunk_id === chunk.id) {
                    matched.push(c)
                } else if (contentLower.includes(c.name.toLowerCase())) {
                    matched.push(c)
                }
            }
            chunkConceptIndex.set(chunk.id, matched.length > 0 ? matched : conceptList.slice(0, 5))
        }

        // Map difficulty from quiz-level vocabulary to question-level
        const nlpDifficulty = DIFFICULTY_MAP[difficulty] || 'mixed'

        // Get the user_id from the auth header
        const authHeader = req.headers.get('Authorization')
        let userId = document.user_id
        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '')
                const payload = JSON.parse(atob(token.split('.')[1]))
                if (payload.sub) userId = payload.sub
            } catch { /* use document owner */ }
        }

        // 4. Create quiz record
        const quizTitle = `Quiz: ${document.title}`
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .insert({
                user_id: userId,
                document_id: documentId,
                title: quizTitle,
                description: `Auto-generated quiz from "${document.title}"`,
                difficulty,
                status: 'generating',
            })
            .select()
            .single()

        if (quizError || !quiz) {
            throw new Error(`DB_ERROR:Failed to create quiz record. ${quizError?.message || ''}`)
        }

        quizId = quiz.id
        console.log(`📝 Quiz record created: ${quizId}`)

        // 5. Build NLP service payload with per-chunk keyphrases and sentences
        const nlpChunks = chunks.map((chunk: { id: string; content: string }) => {
            const chunkConcepts = chunkConceptIndex.get(chunk.id) || []
            const chunkKeyphrases: string[] = []
            const seenChunkKp = new Set<string>()
            for (const c of chunkConcepts) {
                for (const p of [c.name, ...(c.keywords || [])]) {
                    const low = (p || '').toLowerCase().trim()
                    if (low && !seenChunkKp.has(low)) {
                        seenChunkKp.add(low)
                        chunkKeyphrases.push(p)
                    }
                }
            }

            // Extract important sentences from the chunk text by picking
            // sentences that contain at least one keyphrase
            const chunkSentences = chunk.content
                .split(/(?<=[.!?])\s+/)
                .filter((s: string) => s.length > 30 && s.length < 400)
            const importantFromChunk: string[] = []
            for (const sent of chunkSentences) {
                const lower = sent.toLowerCase()
                if (chunkKeyphrases.some(kp => lower.includes(kp.toLowerCase()))) {
                    importantFromChunk.push(sent)
                }
                if (importantFromChunk.length >= 5) break
            }

            return {
                chunk_id: chunk.id,
                text: chunk.content,
                keyphrases: chunkKeyphrases,
                important_sentences: importantFromChunk,
            }
        })

        // Build concept info array for NLP service (concept coverage balancing)
        const conceptInfo = conceptList.slice(0, 20).map(c => ({
            name: c.name,
            importance: c.importance,
            difficulty_level: c.difficulty_level || 'intermediate',
            keywords: c.keywords || [],
            description: c.description || '',
            source_pages: (c as Record<string, unknown>).source_pages || null,
        }))

        // Detect slide-based document from concepts with source_pages
        const hasSlidePages = conceptList.some(c =>
            Array.isArray((c as Record<string, unknown>).source_pages) &&
            ((c as Record<string, unknown>).source_pages as number[]).length > 0
        )

        let questions: NlpQuestion[] = []
        let usedNlpService = false

        // 6. Call NLP service (PRIMARY)
        if (nlpServiceUrl) {
            try {
                console.log(`🧠 Calling NLP service /generate-questions (difficulty=${nlpDifficulty})...`)
                const nlpStart = Date.now()
                const timeoutMs = parseTimeoutMs(Deno.env.get('NLP_SERVICE_TIMEOUT_MS'), 60000)

                const nlpPayload: Record<string, unknown> = {
                    chunks: nlpChunks,
                    all_keyphrases: allKeyphrases,
                    question_types: questionTypes,
                    max_questions_per_chunk: Math.min(5, Math.ceil(questionCount / Math.max(1, chunks.length)) + 1),
                    max_total_questions: questionCount,
                    difficulty: nlpDifficulty,
                    concepts: conceptInfo,
                }

                if (hasSlidePages) {
                    nlpPayload.document_type = 'slides'
                }

                const nlpResponse = await fetchWithTimeout(
                    `${nlpServiceUrl}/generate-questions`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(nlpPayload),
                    },
                    timeoutMs
                )

                if (nlpResponse.ok) {
                    const nlpData = await nlpResponse.json()
                    if (nlpData.success && nlpData.questions?.length > 0) {
                        questions = nlpData.questions
                        usedNlpService = true
                        console.log(`✅ NLP service returned ${questions.length} questions in ${Date.now() - nlpStart}ms`)
                    } else {
                        console.warn('⚠️ NLP service returned no questions:', nlpData.error || 'empty')
                    }
                } else {
                    console.warn(`⚠️ NLP service error: ${nlpResponse.status}`)
                }
            } catch (err) {
                console.warn('⚠️ NLP service unreachable, will fall back to Gemini:', (err as Error).message)
            }
        } else {
            console.log('ℹ️ NLP_SERVICE_URL not configured, skipping template AQG')
        }

        // 7. Gemini enhancement or fallback
        const canUseGemini = Boolean(geminiApiKey)

        if (questions.length === 0 && canUseGemini) {
            // Fallback: generate questions entirely with Gemini
            console.log('🤖 Falling back to Gemini-only quiz generation...')
            questions = await generateWithGemini(
                document,
                chunks,
                conceptList,
                questionCount,
                questionTypes,
                geminiApiKey!,
                nlpDifficulty
            )
        } else if (questions.length > 0 && enhanceWithLlm && canUseGemini) {
            // Enhance template-generated questions with Gemini
            console.log('✨ Enhancing template questions with Gemini...')
            questions = await enhanceWithGeminiLlm(questions, chunks, geminiApiKey!)
        }

        // Post-enhancement quality gate: reject T/F questions that are interrogative
        const preFilterCount = questions.length
        questions = questions.filter(q => {
            if (q.question_type === 'true_false') {
                const text = q.question_text.trim()
                if (text.endsWith('?')) return false
                if (/^(how|what|why|when|where|who|which|can|could|should|would|is|are|do|does|did|will|has|have)\b/i.test(text)) return false
                if (/\.\.\.|\u2026/.test(text)) return false
            }
            return true
        })
        if (preFilterCount > questions.length) {
            console.log(`🧹 Post-enhancement filter removed ${preFilterCount - questions.length} invalid T/F questions`)
        }

        if (questions.length === 0) {
            await supabase
                .from('quizzes')
                .update({ status: 'error', error_message: 'Could not generate any questions from this document.' })
                .eq('id', quizId)
            throw new Error('NO_QUESTIONS:Could not generate questions from this document. Try processing the document again or uploading a more content-rich file.')
        }

        // 8. Build chunk -> concept mapping for linking questions to concepts
        const chunkConceptMap = new Map<string, string>()
        for (const c of conceptList) {
            // concepts have chunk_id from Phase 3 processing
            if ((c as Record<string, unknown>).chunk_id) {
                const cid = (c as Record<string, unknown>).chunk_id as string
                if (!chunkConceptMap.has(cid)) {
                    chunkConceptMap.set(cid, c.id)
                }
            }
        }
        // Fallback: if no chunk-level mapping, use the first concept from the document
        const fallbackConceptId = conceptList.length > 0 ? conceptList[0].id : null

        // 9. Save questions to DB
        console.log(`💾 Saving ${questions.length} questions to database...`)
        const questionRecords = questions.map((q, index) => {
            const chunkId = q.chunk_id || null
            const resolvedConceptId = chunkId
                ? (chunkConceptMap.get(chunkId) || fallbackConceptId)
                : fallbackConceptId
            return {
                quiz_id: quizId,
                concept_id: resolvedConceptId,
                source_chunk_id: chunkId,
                question_type: q.question_type,
                question_text: q.question_text,
                options: q.options || null,
                correct_answer: q.correct_answer,
                explanation: (q as Record<string, unknown>).explanation || null,
                difficulty_level: q.difficulty_label || 'intermediate',
                order_index: index,
            }
        })

        const { error: insertError } = await supabase
            .from('quiz_questions')
            .insert(questionRecords)

        if (insertError) {
            throw new Error(`DB_ERROR:Failed to save quiz questions. ${insertError.message}`)
        }

        // 10. Update quiz status
        await supabase
            .from('quizzes')
            .update({
                status: 'ready',
                question_count: questions.length,
                error_message: null,
            })
            .eq('id', quizId)

        const totalTime = Date.now() - startTime
        console.log(`✅ Quiz generated successfully in ${totalTime}ms (${questions.length} questions, NLP=${usedNlpService})`)

        return new Response(
            JSON.stringify({
                success: true,
                quizId,
                questionCount: questions.length,
                usedNlpService,
                processingTimeMs: totalTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        const errorMessage = (error as Error).message
        console.error('❌ Quiz generation error:', errorMessage)

        let userMessage = 'Something went wrong while generating the quiz. Please try again.'
        let errorCode = 'UNKNOWN_ERROR'

        if (errorMessage.includes(':')) {
            const parts = errorMessage.split(':')
            errorCode = parts[0]
            userMessage = parts.slice(1).join(':')
        }

        if (quizId) {
            try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseServiceKey)
                await supabase
                    .from('quizzes')
                    .update({ status: 'error', error_message: userMessage })
                    .eq('id', quizId)
            } catch (e) {
                console.error('⚠️ Failed to update quiz error status:', e)
            }
        }

        return new Response(
            JSON.stringify({ success: false, error: userMessage, errorCode }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ─── Gemini Fallback: Generate questions entirely with Gemini ────────────────

async function generateWithGemini(
    document: Record<string, unknown>,
    chunks: Array<{ id: string; content: string }>,
    concepts: Array<{ name: string; description?: string; keywords?: string[] }>,
    questionCount: number,
    questionTypes: string[],
    apiKey: string,
    difficulty: string = 'mixed'
): Promise<NlpQuestion[]> {
    const conceptSummary = concepts
        .slice(0, 15)
        .map((c) => `- ${c.name}: ${c.description || ''}`)
        .join('\n')

    const textSample = chunks.slice(0, 5).map((c) => c.content).join('\n\n')

    const typeDescriptions = questionTypes.map((t) => {
        switch (t) {
            case 'multiple_choice': return 'Multiple Choice (4 options, 1 correct)'
            case 'identification': return 'Identification (open-ended, short answer)'
            case 'true_false': return 'True or False'
            case 'fill_in_blank': return 'Fill in the Blank (sentence with a blank)'
            default: return t
        }
    }).join(', ')

    const difficultyInstruction = difficulty === 'mixed'
        ? 'Mix difficulty levels across beginner, intermediate, and advanced.'
        : `Target difficulty level: ${difficulty}. Most questions should be ${difficulty}.`

    const prompt = `You are an expert academic tutor creating a quiz from a study document.

DOCUMENT TITLE: ${document.title}
DOCUMENT SUMMARY: ${document.summary || 'N/A'}

KEY CONCEPTS:
${conceptSummary}

DOCUMENT TEXT (excerpt):
${textSample.substring(0, 6000)}

DIFFICULTY: ${difficultyInstruction}

Generate exactly ${questionCount} quiz questions using these types: ${typeDescriptions}.
Mix the types roughly evenly. Every question must be grounded in the document text above.
Ensure questions cover different concepts — avoid asking multiple questions about the same topic.

For each question provide:
- question_type: one of ${JSON.stringify(questionTypes)}
- question_text: the question stem
- options: array of 4 strings (for multiple_choice only, null otherwise)
- correct_answer: the correct answer text
- explanation: a 1-2 sentence explanation of why this is correct
- difficulty_label: "beginner", "intermediate", or "advanced"

Respond with ONLY valid JSON:
{
  "questions": [ { "question_type": "...", "question_text": "...", "options": [...] or null, "correct_answer": "...", "explanation": "...", "difficulty_label": "..." } ]
}

Rules:
- Return ONLY valid JSON, no markdown code blocks
- Correct answers must be factually supported by the document text
- MCQ distractors must be plausible but clearly wrong
- Fill-in-the-blank: use __________ for the blank
- True/False: correct_answer must be "true" or "false"
- True/False: question_text MUST be a declarative statement, NEVER a question ending with "?" or starting with "How", "What", etc.`

    const content = await callGemini(prompt, apiKey, 4096)
    try {
        let jsonStr = content
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0]
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0]
        }
        const parsed = JSON.parse(jsonStr.trim())
        const questions: NlpQuestion[] = (parsed.questions || []).map((q: Record<string, unknown>) => ({
            chunk_id: '',
            question_type: q.question_type as string,
            question_text: q.question_text as string,
            options: q.options as string[] | null,
            correct_answer: q.correct_answer as string,
            difficulty_label: (q.difficulty_label as string) || 'intermediate',
            explanation: q.explanation as string,
        }))
        return questions
    } catch {
        console.error('⚠️ Failed to parse Gemini quiz response')
        return []
    }
}

// ─── Gemini Enhancement: Improve template questions ──────────────────────────

async function enhanceWithGeminiLlm(
    questions: NlpQuestion[],
    chunks: Array<{ id: string; content: string }>,
    apiKey: string
): Promise<NlpQuestion[]> {
    const chunkMap = new Map<string, string>()
    for (const c of chunks) {
        chunkMap.set(c.id, c.content)
    }

    const questionsWithContext = questions.map((q) => ({
        ...q,
        source_text: chunkMap.get(q.chunk_id)?.substring(0, 500) || '',
    }))

    const prompt = `You are an expert academic tutor. Below are auto-generated quiz questions from an NLP pipeline.
Your job is to IMPROVE them — better phrasing, better MCQ distractors, and add a 1-2 sentence explanation for each.

IMPORTANT RULES:
- Do NOT change the correct_answer value
- Do NOT invent new questions
- ONLY improve phrasing, distractors, and add explanations
- Return the same number of questions
- True/False questions MUST be declarative statements, NEVER questions ending with "?"
- If a true_false question is actually a question (interrogative), either rephrase it into a declarative statement or change question_type to "identification"
- If you change a true_false to identification, set correct_answer to the answer of the question and options to null

QUESTIONS TO ENHANCE:
${JSON.stringify(questionsWithContext, null, 2)}

Return ONLY valid JSON:
{
  "questions": [ { "question_type": "...", "question_text": "...", "options": [...] or null, "correct_answer": "...", "explanation": "...", "difficulty_label": "...", "chunk_id": "..." } ]
}`

    try {
        const content = await callGemini(prompt, apiKey, 4096)
        let jsonStr = content
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0]
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0]
        }
        const parsed = JSON.parse(jsonStr.trim())
        if (parsed.questions?.length > 0) {
            console.log(`✅ Gemini enhanced ${parsed.questions.length} questions`)
            return parsed.questions.map((q: Record<string, unknown>) => ({
                chunk_id: (q.chunk_id as string) || '',
                question_type: q.question_type as string,
                question_text: q.question_text as string,
                options: q.options as string[] | null,
                correct_answer: q.correct_answer as string,
                difficulty_label: (q.difficulty_label as string) || 'intermediate',
                explanation: q.explanation as string,
            }))
        }
    } catch (err) {
        console.warn('⚠️ Gemini enhancement failed, keeping original questions:', (err as Error).message)
    }
    return questions
}

// ─── Gemini API call with retry ──────────────────────────────────────────────

async function callGemini(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: maxTokens,
                            responseMimeType: 'application/json',
                        },
                    }),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                const isRetryable = response.status === 503 || response.status === 429 || response.status === 500
                if (isRetryable && attempt < MAX_RETRIES) {
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                    console.log(`⏳ Gemini ${response.status}, retrying in ${delayMs}ms...`)
                    await new Promise((resolve) => setTimeout(resolve, delayMs))
                    continue
                }
                throw new Error(`AI_ERROR:AI service error (${response.status}). ${errorText.substring(0, 200)}`)
            }

            const data = await response.json()
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (!content) {
                throw new Error('AI_EMPTY:The AI returned an empty response.')
            }
            return content
        } catch (error) {
            if ((error as Error).message.includes(':')) throw error
            if (attempt < MAX_RETRIES) {
                const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                await new Promise((resolve) => setTimeout(resolve, delayMs))
                continue
            }
            throw new Error('AI_NETWORK:Unable to reach the AI service. Please try again.')
        }
    }
    throw new Error('AI_ERROR:Failed after multiple attempts.')
}
