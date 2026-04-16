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
import { computeBalancedQuizTypeTargets, countQuestionsByType } from "./quizAllocation.ts"
import { filterInvalidIdentificationQuestions } from "./identificationContract.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000
const QUIZ_PRIORITY_PREMIUM = 2
const QUIZ_PRIORITY_FREE = 1

interface GenerateQuizRequest {
    documentId: string
    questionCount?: number
    difficulty?: string
    questionTypes?: string[]
    /** Optional: client-provided targets (server recomputes for safety) */
    questionTypeTargets?: Record<string, number>
    enhanceWithLlm?: boolean
    /** Optional: user ID for mastery-aware generation */
    userId?: string
    /** Optional: focus on specific concept IDs (for targeted review quizzes) */
    focusConceptIds?: string[]
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

interface MasteryContextItem {
    concept_name: string
    mastery_level: string
    mastery_score: number | null
    adaptive_difficulty: string
}

interface NlpChunkPayload {
    chunk_id: string
    text: string
    keyphrases: string[]
    important_sentences: string[]
    max_questions?: number
}

interface NlpConceptPayload {
    name: string
    importance: number
    difficulty_level: string
    keywords: string[]
    description: string
    source_pages: unknown
}

interface NlpGenerateQuestionsPayload {
    chunks: NlpChunkPayload[]
    all_keyphrases: string[]
    question_types: string[]
    question_type_targets?: Record<string, number>
    max_questions_per_chunk: number
    max_total_questions: number
    difficulty: string
    concepts: NlpConceptPayload[]
    document_type?: 'prose' | 'slides'
    mastery_context?: MasteryContextItem[]
}

const DIFFICULTY_MAP: Record<string, string> = {
    easy: 'beginner',
    medium: 'intermediate',
    hard: 'advanced',
    mixed: 'mixed',
}

const IDENTIFICATION_PROMPT_RULES = [
    "Identification questions are short-answer concept or topic lookups only.",
    "For identification, correct_answer must be a concise term or phrase, never a sentence or paragraph.",
    "Identification question_text must ask the user to identify a concept, topic, or term, not explain or define it in detail.",
].join("\n")

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
            questionTypeTargets: _clientQuestionTypeTargets,
            enhanceWithLlm = true,
            userId: requestUserId,
            focusConceptIds,
        } = body

        const { stableSelectedTypes: stableQuestionTypes, targetsByType: requestedTargetsByType } =
            computeBalancedQuizTypeTargets({
                totalCount: questionCount,
                selectedTypes: questionTypes,
            })

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
        const isReviewQuiz = Array.isArray(focusConceptIds) && focusConceptIds.length > 0

        // If this is a targeted review quiz, filter concepts to the focus set.
        // Fallback to the full list when no focus match is found.
        let activeConceptList = conceptList
        if (isReviewQuiz) {
            const focusSet = new Set(focusConceptIds)
            const focused = conceptList.filter((c) => focusSet.has(c.id))
            if (focused.length > 0) {
                activeConceptList = focused
                console.log(`🎯 Targeted review: focusing on ${activeConceptList.length} concepts`)
            } else {
                console.warn('⚠️ Targeted review requested but no matching concepts found; falling back to all concepts')
                activeConceptList = conceptList
            }
        }

        // Build global keyphrases (for document-wide distractor pool)
        const allKeyphrases: string[] = []
        const seenKp = new Set<string>()
        for (const c of activeConceptList) {
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
        const chunkConceptIndex = new Map<string, typeof activeConceptList>()
        for (const chunk of chunks) {
            const matched: typeof activeConceptList = []
            const contentLower = chunk.content.toLowerCase()
            for (const c of activeConceptList) {
                if (c.chunk_id === chunk.id) {
                    matched.push(c)
                } else if (contentLower.includes(c.name.toLowerCase())) {
                    matched.push(c)
                }
            }
            chunkConceptIndex.set(chunk.id, matched.length > 0 ? matched : activeConceptList.slice(0, 5))
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

        // 4. Query user mastery data for adaptive generation (Phase 6.1)
        const resolvedUserId = requestUserId || userId
        const subscription = await getSubscriptionForUser(supabase, resolvedUserId)
        const priorityTier = hasPremiumEntitlement(subscription) ? 'premium' : 'free'
        const priority = priorityTier === 'premium' ? QUIZ_PRIORITY_PREMIUM : QUIZ_PRIORITY_FREE

        interface MasteryInfo {
            mastery_level: string
            mastery_score: number
        }
        const masteryMap = new Map<string, MasteryInfo>()

        if (resolvedUserId && activeConceptList.length > 0) {
            try {
                const conceptIds = activeConceptList.map(c => c.id)
                const { data: masteryRows } = await supabase
                    .from('user_concept_mastery')
                    .select('concept_id, mastery_score, mastery_level')
                    .eq('user_id', resolvedUserId)
                    .in('concept_id', conceptIds)

                if (masteryRows) {
                    for (const row of masteryRows) {
                        masteryMap.set(row.concept_id, {
                            mastery_level: row.mastery_level,
                            mastery_score: Number(row.mastery_score),
                        })
                    }
                    console.log(`📊 Loaded mastery data for ${masteryRows.length}/${conceptIds.length} concepts`)
                }
            } catch (err) {
                console.warn('⚠️ Could not load mastery data, proceeding without:', (err as Error).message)
            }
        }

        // Determine per-concept adaptive difficulty based on mastery
        function getAdaptiveDifficulty(conceptId: string): string {
            const m = masteryMap.get(conceptId)
            if (!m) return difficulty === 'mixed' ? 'mixed' : (DIFFICULTY_MAP[difficulty] || 'intermediate')
            if (m.mastery_score < 60) return 'beginner'     // weak → easier Qs
            if (m.mastery_score < 80) return 'intermediate'  // developing → medium
            return 'advanced'                                // strong → harder Qs
        }

        // 5. Create quiz record
        const quizTitle = isReviewQuiz
            ? `Review Quiz: ${document.title}`
            : `Quiz: ${document.title}`
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .insert({
                user_id: userId,
                document_id: documentId,
                title: quizTitle,
                description: `Auto-generated quiz from "${document.title}"`,
                difficulty,
                status: 'generating',
                priority_tier: priorityTier,
                priority,
            })
            .select()
            .single()

        if (quizError || !quiz) {
            throw new Error(`DB_ERROR:Failed to create quiz record. ${quizError?.message || ''}`)
        }

        quizId = quiz.id
        console.log(`📝 Quiz record created: ${quizId}`)

        if (priorityTier === 'free') {
            await waitForPremiumQuizTurn(supabase, quizId)
        }

        // 5. Build NLP service payload with per-chunk keyphrases and sentences
        const nlpChunks: NlpChunkPayload[] = chunks.map((chunk: { id: string; content: string }) => {
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
        const conceptInfo: NlpConceptPayload[] = activeConceptList.slice(0, 20).map(c => ({
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

                const nlpPayload: NlpGenerateQuestionsPayload = {
                    chunks: nlpChunks,
                    all_keyphrases: allKeyphrases,
                    question_types: questionTypes,
                    question_type_targets: requestedTargetsByType as Record<string, number>,
                    max_questions_per_chunk: Math.min(5, Math.ceil(questionCount / Math.max(1, chunks.length)) + 1),
                    max_total_questions: questionCount,
                    difficulty: nlpDifficulty,
                    concepts: conceptInfo,
                }

                // Phase 6.1: Pass mastery context to NLP service for adaptive generation
                if (masteryMap.size > 0) {
                    nlpPayload.mastery_context = activeConceptList.map(c => ({
                        concept_name: c.name,
                        mastery_level: masteryMap.get(c.id)?.mastery_level ?? 'unknown',
                        mastery_score: masteryMap.get(c.id)?.mastery_score ?? null,
                        adaptive_difficulty: getAdaptiveDifficulty(c.id),
                    }))
                    console.log(`📊 Sent mastery context for ${nlpPayload.mastery_context.length} concepts`)

                    // Adjust per-chunk quota based on whether chunk contains weak concepts
                    const baseQpc = Math.ceil(questionCount / Math.max(1, chunks.length)) + 1
                    for (const nlpChunk of nlpChunks) {
                        const chunkConcepts = chunkConceptIndex.get(nlpChunk.chunk_id) || []
                        const hasWeak = chunkConcepts.some(c => {
                            const m = masteryMap.get(c.id)
                            return !m || m.mastery_score < 60
                        })
                        const allMastered = chunkConcepts.every(c => {
                            const m = masteryMap.get(c.id)
                            return m && m.mastery_score >= 80
                        })
                        // 2x for weak, 0.5x for mastered
                        nlpChunk.max_questions = Math.min(5, hasWeak ? baseQpc * 2 : (allMastered ? Math.max(1, Math.floor(baseQpc * 0.5)) : baseQpc))
                    }
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

        // If the NLP service returned fewer questions than requested, attempt deterministic supplementation
        // using the remaining per-type quotas (and then stable-order rebalance) while respecting selected types.
        if (usedNlpService && nlpServiceUrl && questions.length < questionCount) {
            const normalizeKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
            const dedupByText = (qs: NlpQuestion[]) => {
                const seen = new Set<string>()
                const out: NlpQuestion[] = []
                for (const q of qs) {
                    const key = normalizeKey(q.question_text)
                    if (!key || seen.has(key)) continue
                    seen.add(key)
                    out.push(q)
                }
                return out
            }

            for (let attempt = 1; attempt <= 2 && questions.length < questionCount; attempt++) {
                const actualByType = countQuestionsByType(questions)
                const missingTotal = questionCount - questions.length

                const supplementalTargets: Record<string, number> = {}
                let supplementalSum = 0
                for (const t of stableQuestionTypes) {
                    const target = (requestedTargetsByType as Record<string, number>)[t] || 0
                    const actual = actualByType[t] || 0
                    const remaining = Math.max(0, target - actual)
                    if (remaining > 0) {
                        supplementalTargets[t] = remaining
                        supplementalSum += remaining
                    }
                }

                // If we still need more, rebalance across selected types in stable order.
                if (supplementalSum < missingTotal) {
                    let toAdd = missingTotal - supplementalSum
                    for (const t of stableQuestionTypes) {
                        if (toAdd <= 0) break
                        supplementalTargets[t] = (supplementalTargets[t] || 0) + 1
                        toAdd -= 1
                    }
                }

                const willRequest = Object.values(supplementalTargets).reduce((a, b) => a + b, 0)
                if (willRequest <= 0) break

                console.log(`🧩 Supplementing questions (attempt=${attempt}) missing=${missingTotal} targets=${JSON.stringify(supplementalTargets)}`)

                try {
                    const timeoutMs = parseTimeoutMs(Deno.env.get('NLP_SERVICE_TIMEOUT_MS'), 60000)
                    const supplementPayload: NlpGenerateQuestionsPayload = {
                        chunks: nlpChunks,
                        all_keyphrases: allKeyphrases,
                        question_types: questionTypes,
                        question_type_targets: supplementalTargets,
                        max_questions_per_chunk: Math.min(5, Math.ceil(willRequest / Math.max(1, chunks.length)) + 1),
                        max_total_questions: willRequest,
                        difficulty: nlpDifficulty,
                        concepts: conceptInfo,
                    }
                    if (hasSlidePages) supplementPayload.document_type = 'slides'
                    if (masteryMap.size > 0) {
                        supplementPayload.mastery_context = activeConceptList.map(c => ({
                            concept_name: c.name,
                            mastery_level: masteryMap.get(c.id)?.mastery_level ?? 'unknown',
                            mastery_score: masteryMap.get(c.id)?.mastery_score ?? null,
                            adaptive_difficulty: getAdaptiveDifficulty(c.id),
                        }))
                    }

                    const resp = await fetchWithTimeout(
                        `${nlpServiceUrl}/generate-questions`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(supplementPayload),
                        },
                        timeoutMs
                    )

                    if (resp.ok) {
                        const data = await resp.json()
                        if (data.success && data.questions?.length) {
                            questions = dedupByText([...questions, ...data.questions]).slice(0, questionCount)
                            console.log(`🧩 Supplement added=${data.questions.length} total_now=${questions.length}`)
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Supplement attempt failed:', (e as Error).message)
                    break
                }
            }
        }

        // ─── Pipeline Contract: NLP-first, Gemini enhances + validates ───
        //
        // 1. NLP generates draft questions (above)
        // 2. If NLP returned zero: Gemini fallback generation (last resort)
        // 3. If NLP succeeded + enhanceWithLlm: Gemini enhancement pass
        // 4. Gemini validation pass (post-enhancement quality gate)
        //
        // Gemini is NEVER the primary generator when NLP is available.
        // ──────────────────────────────────────────────────────────────

        const canUseGemini = Boolean(geminiApiKey)
        let quotaTier: 'green' | 'yellow' | 'red' = canUseGemini ? 'green' : 'red'
        const metrics = {
            nlpGenerated: questions.length,
            geminiEnhanceRewrites: 0,
            geminiValidationPassed: 0,
            geminiValidationFailed: 0,
            geminiValidationRepaired: 0,
            geminiCallsMade: 0,
            quotaTier: 'green' as string,
            nlpOnlyFallback: false,
        }

        if (questions.length === 0 && canUseGemini) {
            console.log('🤖 Falling back to Gemini-only quiz generation (NLP produced zero questions)...')
            questions = await generateWithGemini(
                document,
                chunks,
                activeConceptList,
                questionCount,
                questionTypes,
                requestedTargetsByType as Record<string, number>,
                geminiApiKey!,
                nlpDifficulty
            )
            metrics.geminiCallsMade++
        } else if (questions.length > 0 && enhanceWithLlm && quotaTier !== 'red') {
            console.log('✨ Enhancement pass: improving NLP-generated questions with Gemini 2.5 Flash...')
            try {
                const enhanced = await enhanceWithGeminiLlm(questions, chunks, geminiApiKey!, activeConceptList)
                metrics.geminiCallsMade++
                let rewrites = 0
                for (let i = 0; i < Math.min(questions.length, enhanced.length); i++) {
                    if (enhanced[i].question_text !== questions[i].question_text) rewrites++
                }
                metrics.geminiEnhanceRewrites = rewrites
                questions = enhanced
            } catch (err) {
                const msg = (err as Error).message
                if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                    console.warn('⚠️ Enhancement hit quota limit, degrading to yellow tier')
                    quotaTier = 'yellow'
                } else {
                    console.warn('⚠️ Enhancement failed, keeping NLP questions:', msg)
                }
            }
        }

        // Validation pass (skip if quota is yellow or red)
        if (questions.length > 0 && canUseGemini && quotaTier === 'green') {
            console.log('🔍 Validation pass: checking question quality with Gemini 2.5 Flash...')
            try {
                const validationResult = await validateWithGemini(questions, chunks, geminiApiKey!)
                metrics.geminiCallsMade++
                metrics.geminiValidationPassed = validationResult.passed
                metrics.geminiValidationFailed = validationResult.rejected
                metrics.geminiValidationRepaired = validationResult.repaired
                questions = validationResult.questions
            } catch (err) {
                const msg = (err as Error).message
                if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                    console.warn('⚠️ Validation hit quota limit, proceeding without validation')
                    quotaTier = 'yellow'
                } else {
                    console.warn('⚠️ Validation failed, proceeding with enhanced questions:', msg)
                }
            }
        } else if (quotaTier !== 'green') {
            console.log(`ℹ️ Skipping validation pass (quota tier: ${quotaTier})`)
        }

        metrics.quotaTier = quotaTier
        metrics.nlpOnlyFallback = quotaTier === 'red'

        const preIdentificationFilterCount = questions.length
        questions = filterInvalidIdentificationQuestions(questions)
        if (preIdentificationFilterCount > questions.length) {
            console.log(`🧹 Post-enhancement filter removed ${preIdentificationFilterCount - questions.length} invalid identification questions`)
        }

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

        console.log(`📊 Quality metrics: ${JSON.stringify(metrics)}`)

        if (questions.length === 0) {
            await supabase
                .from('quizzes')
                .update({ status: 'error', error_message: 'Could not generate any questions from this document.' })
                .eq('id', quizId)
            throw new Error('NO_QUESTIONS:Could not generate questions from this document. Try processing the document again or uploading a more content-rich file.')
        }

        // 8. Build chunk -> concept mapping for linking questions to concepts
        const chunkConceptMap = new Map<string, string>()
        for (const c of activeConceptList) {
            // concepts have chunk_id from Phase 3 processing
            if ((c as Record<string, unknown>).chunk_id) {
                const cid = (c as Record<string, unknown>).chunk_id as string
                if (!chunkConceptMap.has(cid)) {
                    chunkConceptMap.set(cid, c.id)
                }
            }
        }
        // Fallback: if no chunk-level mapping, use the first concept from the document
        const fallbackConceptId = activeConceptList.length > 0
            ? activeConceptList[0].id
            : (conceptList.length > 0 ? conceptList[0].id : null)

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

async function getSubscriptionForUser(
    supabase: ReturnType<typeof createClient>,
    userId: string | undefined,
): Promise<{ plan: 'free' | 'premium'; status: 'active' | 'cancelled' | 'suspended'; trial_ends_at: string | null }> {
    if (!userId) {
        return { plan: 'free', status: 'active', trial_ends_at: null }
    }

    const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, trial_ends_at')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.warn('⚠️ Failed to read subscription, defaulting to free:', error.message)
        return { plan: 'free', status: 'active', trial_ends_at: null }
    }

    return {
        plan: data?.plan === 'premium' ? 'premium' : 'free',
        status:
            data?.status === 'cancelled' || data?.status === 'suspended'
                ? data.status
                : 'active',
        trial_ends_at: data?.trial_ends_at ?? null,
    }
}

function hasPremiumEntitlement(
    subscription: { plan: 'free' | 'premium'; status: 'active' | 'cancelled' | 'suspended'; trial_ends_at: string | null },
    now = new Date()
): boolean {
    const premiumActive = subscription.plan === 'premium' && subscription.status === 'active'
    if (premiumActive) return true

    if (!subscription.trial_ends_at) return false
    const trialEnd = new Date(subscription.trial_ends_at)
    if (Number.isNaN(trialEnd.getTime())) return false
    return trialEnd.getTime() > now.getTime()
}

async function waitForPremiumQuizTurn(
    supabase: ReturnType<typeof createClient>,
    currentQuizId: string,
): Promise<void> {
    const maxWaitMs = 30_000
    const pollMs = 1_000
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
        const { count, error } = await supabase
            .from('quizzes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'generating')
            .eq('priority', QUIZ_PRIORITY_PREMIUM)
            .neq('id', currentQuizId)

        if (error) {
            console.warn('⚠️ Failed to check premium queue, proceeding:', error.message)
            return
        }

        if (!count || count <= 0) {
            return
        }

        await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
}

async function generateWithGemini(
    document: Record<string, unknown>,
    chunks: Array<{ id: string; content: string }>,
    concepts: Array<{ name: string; description?: string; keywords?: string[] }>,
    questionCount: number,
    questionTypes: string[],
    questionTypeTargets: Record<string, number> | null,
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
            case 'identification': return 'Identification (short answer, concept/topic name only)'
            case 'true_false': return 'True or False'
            case 'fill_in_blank': return 'Fill in the Blank (sentence with a blank)'
            default: return t
        }
    }).join(', ')

    const difficultyInstruction = difficulty === 'mixed'
        ? 'Mix difficulty levels across beginner, intermediate, and advanced.'
        : `Target difficulty level: ${difficulty}. Most questions should be ${difficulty}.`

    const targetMixInstruction = questionTypeTargets && Object.keys(questionTypeTargets).length > 0
        ? `Use this exact type mix (counts per type): ${JSON.stringify(questionTypeTargets)}.`
        : 'Mix the types roughly evenly.'

    const prompt = `You are an expert academic tutor creating a quiz from a study document.

DOCUMENT TITLE: ${document.title}
DOCUMENT SUMMARY: ${document.summary || 'N/A'}

KEY CONCEPTS:
${conceptSummary}

DOCUMENT TEXT (excerpt):
${textSample.substring(0, 6000)}

DIFFICULTY: ${difficultyInstruction}

Generate exactly ${questionCount} quiz questions using these types: ${typeDescriptions}.
${targetMixInstruction} Every question must be grounded in the document text above.
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
- True/False: question_text MUST be a declarative statement, NEVER a question ending with "?" or starting with "How", "What", etc.
${IDENTIFICATION_PROMPT_RULES}`

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
    apiKey: string,
    concepts: Array<{ name: string; keywords?: string[]; description?: string }> = []
): Promise<NlpQuestion[]> {
    const chunkMap = new Map<string, string>()
    for (const c of chunks) {
        chunkMap.set(c.id, c.content)
    }

    const conceptContext = concepts.slice(0, 15).map(c =>
        `${c.name}: ${c.description || c.keywords?.join(', ') || ''}`
    ).join('\n')

    const questionsWithContext = questions.map((q) => ({
        ...q,
        source_text: chunkMap.get(q.chunk_id)?.substring(0, 800) || '',
    }))

    const prompt = `You are an expert academic tutor and question quality reviewer. Below are auto-generated quiz questions from a deterministic NLP pipeline. Your job is to REPAIR and IMPROVE them.

KEY CONCEPTS FROM THE DOCUMENT:
${conceptContext}

YOUR TASKS (in priority order):
1. REPAIR: If a question stem is vague, context-less, or unanswerable without the source document, rewrite it to be fully self-contained. Include enough context in question_text that a student can answer from the question alone.
2. IMPROVE: Better phrasing, more natural language, clearer stems.
3. DISTRACTORS: For multiple_choice, ensure distractors are plausible (same category as answer), clearly wrong to a prepared student, and all distinct.
4. EXPLANATIONS: Add a 1-2 sentence explanation grounded in the source text.
5. DIFFICULTY: Align question complexity with its difficulty_label:
   - beginner: recall/identify (What is X?)
   - intermediate: understand/apply (How does X relate to Y?)
   - advanced: analyze/evaluate (Why does X cause Y instead of Z?)

STRICT RULES:
- Do NOT change the correct_answer value — the factual answer must stay the same
- Do NOT invent new questions or add extra questions
- Return the SAME number of questions in the SAME order
- If question_type is "identification": correct_answer must remain a concise term or phrase (never a full sentence). The question_text MUST include enough context (a description, definition, or quote) so the student knows what to identify.
- If question_type is "true_false": question_text MUST be a declarative statement, NEVER ending with "?" or starting with interrogative words.
- If a true_false question is actually interrogative, rephrase it into a declarative statement. If that is impossible, change question_type to "identification" and set options to null.
- If question_type is "fill_in_blank": question_text MUST contain __________ for the blank.
- MCQ options MUST have exactly 4 items, all distinct.
${IDENTIFICATION_PROMPT_RULES}

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

// ─── Gemini Validation: Post-enhancement quality gate ────────────────────────

interface ValidationResult {
    questions: NlpQuestion[]
    passed: number
    rejected: number
    repaired: number
}

async function validateWithGemini(
    questions: NlpQuestion[],
    chunks: Array<{ id: string; content: string }>,
    apiKey: string
): Promise<ValidationResult> {
    const chunkMap = new Map<string, string>()
    for (const c of chunks) {
        chunkMap.set(c.id, c.content)
    }

    const questionsForReview = questions.map((q, idx) => ({
        index: idx,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        difficulty_label: q.difficulty_label,
        source_excerpt: chunkMap.get(q.chunk_id)?.substring(0, 400) || '',
    }))

    const prompt = `You are a strict quiz quality auditor. Review each question and evaluate it on four dimensions. Your goal is to catch bad questions before students see them.

QUESTIONS TO VALIDATE:
${JSON.stringify(questionsForReview, null, 2)}

For EACH question, score these dimensions (1-5):
- clarity: Is the question understandable and answerable from the question text alone? (1=incomprehensible, 5=crystal clear)
- grounding: Is the correct_answer factually supported by the source_excerpt? (1=unsupported, 5=directly stated)
- type_valid: Does it follow its type rules? (MCQ has 4 distinct options, T/F is declarative, identification has concise answer, fill_in_blank has __________) (1=broken, 5=perfect)
- difficulty_fit: Does complexity match difficulty_label? (1=mismatch, 5=well-calibrated)

Then decide an action:
- "pass": All scores >= 3. Keep as-is.
- "repair": Any score is 2. Rewrite question_text (and options if MCQ) to fix it. Do NOT change correct_answer.
- "reject": Any score is 1. Question is unsalvageable.

Return ONLY valid JSON:
{
  "results": [
    {
      "index": 0,
      "action": "pass" | "repair" | "reject",
      "clarity": 4,
      "grounding": 5,
      "type_valid": 5,
      "difficulty_fit": 4,
      "repaired_question_text": null or "...",
      "repaired_options": null or [...],
      "repaired_explanation": null or "...",
      "reason": "brief reason if repair or reject"
    }
  ]
}`

    const content = await callGemini(prompt, apiKey, 4096)
    let jsonStr = content
    if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0]
    } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0]
    }

    const parsed = JSON.parse(jsonStr.trim())
    const results: Array<{
        index: number
        action: string
        repaired_question_text?: string | null
        repaired_options?: string[] | null
        repaired_explanation?: string | null
        reason?: string
    }> = parsed.results || []

    const validatedQuestions: NlpQuestion[] = []
    let passed = 0, rejected = 0, repaired = 0

    for (let i = 0; i < questions.length; i++) {
        const verdict = results.find(r => r.index === i)
        if (!verdict || verdict.action === 'pass') {
            validatedQuestions.push(questions[i])
            passed++
        } else if (verdict.action === 'repair' && verdict.repaired_question_text) {
            validatedQuestions.push({
                ...questions[i],
                question_text: verdict.repaired_question_text,
                options: verdict.repaired_options ?? questions[i].options,
                explanation: verdict.repaired_explanation ?? questions[i].explanation,
            })
            repaired++
            console.log(`🔧 Repaired Q${i + 1}: ${verdict.reason || 'quality issue'}`)
        } else if (verdict.action === 'reject') {
            rejected++
            console.log(`❌ Rejected Q${i + 1}: ${verdict.reason || 'unsalvageable'}`)
        } else {
            validatedQuestions.push(questions[i])
            passed++
        }
    }

    console.log(`🔍 Validation: ${passed} passed, ${repaired} repaired, ${rejected} rejected`)
    return { questions: validatedQuestions, passed, rejected, repaired }
}

// ─── Gemini API call with retry and quota awareness ──────────────────────────

async function callGemini(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
    const MAX_GEMINI_RETRIES = 2
    for (let attempt = 1; attempt <= MAX_GEMINI_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

                if (response.status === 429) {
                    if (attempt < MAX_GEMINI_RETRIES) {
                        const jitter = Math.random() * 500
                        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter
                        console.log(`⏳ Gemini 429 rate-limited, retrying in ${Math.round(delayMs)}ms...`)
                        await new Promise((resolve) => setTimeout(resolve, delayMs))
                        continue
                    }
                    throw new Error(`QUOTA_429:Rate limited by Gemini API. ${errorText.substring(0, 100)}`)
                }

                const isRetryable = response.status === 503 || response.status === 500
                if (isRetryable && attempt < MAX_GEMINI_RETRIES) {
                    const jitter = Math.random() * 500
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter
                    console.log(`⏳ Gemini ${response.status}, retrying in ${Math.round(delayMs)}ms...`)
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
            if (attempt < MAX_GEMINI_RETRIES) {
                const jitter = Math.random() * 500
                const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter
                await new Promise((resolve) => setTimeout(resolve, delayMs))
                continue
            }
            throw new Error('AI_NETWORK:Unable to reach the AI service. Please try again.')
        }
    }
    throw new Error('AI_ERROR:Failed after multiple attempts.')
}
