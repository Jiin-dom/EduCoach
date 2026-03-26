/**
 * Process Document Edge Function
 * 
 * This function processes uploaded documents:
 * 1. Downloads the file from Supabase Storage
 * 2. Extracts text content
 * 3. Chunks the text into segments
 * 4. Uses Pure NLP (default) or Gemini to extract concepts
 * 5. Generates embeddings for semantic search (optional)
 * 6. Saves everything to the database
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - User-friendly error messages
 * - Chunked processing for large documents
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// CORS headers for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration
const CHUNK_SIZE = 2800       // Characters per chunk (~700 tokens) - optimized for RAG retrieval
const CHUNK_OVERLAP = 200     // Overlap between chunks for context continuity
const MAX_CHUNKS = 20         // Maximum chunks to process
const MAX_RETRIES = 3         // API retry attempts
const BASE_DELAY_MS = 2000    // Base delay for exponential backoff
const DEFAULT_PROCESSOR = 'pure_nlp'
const DEFAULT_CONCEPT_CATEGORY = 'General Study'
const DEFAULT_DIFFICULTY = 'intermediate'

const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
    'with', 'this', 'these', 'those', 'you', 'your', 'we', 'our', 'they', 'their',
    'or', 'if', 'then', 'than', 'but', 'not', 'can', 'could', 'should', 'would',
    'about', 'into', 'within', 'without', 'over', 'under', 'between', 'during'
])

const EDGE_GENERIC_TAGS = new Set([
    'datum', 'data', 'portion', 'portions', 'function', 'method',
    'use', 'result', 'value', 'number', 'type', 'time', 'output',
    'input', 'model', 'step', 'example', 'case', 'set', 'way',
    'form', 'work', 'end', 'side', 'level', 'line', 'order',
    'area', 'point', 'group', 'part', 'kind', 'thing', 'stuff',
    'state', 'need', 'change', 'note', 'item', 'term', 'unit',
    'you', 'your', 'something', 'anything', 'everything',
    'agenda', 'outline', 'recap', 'overview', 'contents',
    'objectives', 'topics', 'summary', 'review', 'introduction',
    'references', 'bibliography', 'questions',
])

function isNumericHeavy(text: string): boolean {
    const stripped = text.replace(/\s/g, '')
    if (stripped.length === 0) return true
    const digitDots = (stripped.match(/[\d.]/g) || []).length
    return digitDots / stripped.length > 0.4
}

function isCodeLikeContent(text: string): boolean {
    return /\b(import\s+\w|from\s+\w+\.\w+\s+import|def\s+\w+\(|class\s+\w+[(:])/.test(text)
        || /\b(Sequential|Dense|model\.\w+|\.fit\(|\.predict\(|\.compile\()/.test(text)
        || (/[{};=]/.test(text) && (text.match(/[{};=]/g) || []).length >= 3)
}

let processedByColumnCache: boolean | null = null

function normalizeProcessor(value?: string | null): 'pure_nlp' | 'gemini' | null {
    if (!value) {
        return null
    }

    const normalized = value.toLowerCase().trim()
    if (normalized === 'pure_nlp' || normalized === 'gemini') {
        return normalized
    }

    return null
}

function parseTimeoutMs(value: string | null, fallbackMs: number): number {
    if (!value) {
        return fallbackMs
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallbackMs
    }

    return parsed
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

interface ProcessRequest {
    documentId: string
    processor?: string
}

interface Concept {
    name: string
    description: string
    category: string
    importance: number
    difficulty_level: string
    keywords: string[]
    source_pages?: number[]
    chunk_id?: string
}

interface SummarySection {
    title: string
    icon: string
    content: string
    pages?: number[]
}

interface SummaryBullet {
    label: string
    text: string
    page?: number
}

interface StructuredSummary {
    short: string
    detailed: SummarySection[]
    bullets: SummaryBullet[]
}

interface GeminiResponse {
    summary: string
    structured_summary?: StructuredSummary | null
    concepts: Concept[]
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const startTime = Date.now()
    console.log('🚀 Edge Function started')

    // Store documentId for error handling
    let documentId: string | null = null

    try {
        // Get environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || null
        const defaultProcessorRaw = Deno.env.get('DEFAULT_PROCESSOR')
        const normalizedProcessor = defaultProcessorRaw ? defaultProcessorRaw.toLowerCase() : null
        const resolvedProcessor =
            normalizedProcessor === 'pure_nlp' || normalizedProcessor === 'gemini'
                ? normalizedProcessor
                : null
        const envUsePureNlp = Deno.env.get('USE_PURE_NLP')
        const baseUsePureNlp = resolvedProcessor
            ? resolvedProcessor === 'pure_nlp'
            : (envUsePureNlp === null ? DEFAULT_PROCESSOR === 'pure_nlp' : envUsePureNlp !== 'false')
        const canUseGemini = Boolean(geminiApiKey)

        if (normalizedProcessor && normalizedProcessor !== 'pure_nlp' && normalizedProcessor !== 'gemini') {
            console.log(`⚠️ DEFAULT_PROCESSOR="${defaultProcessorRaw}" is invalid, falling back to ${DEFAULT_PROCESSOR}`)
        }

        // Get NLP Service URL for document text extraction
        const nlpServiceUrl = Deno.env.get('NLP_SERVICE_URL')
        if (!nlpServiceUrl) {
            console.log('⚠️ NLP_SERVICE_URL not configured, falling back to basic text extraction')
        }

        // Initialize Supabase client with service role (bypasses RLS)
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Parse request body
        const body: ProcessRequest = await req.json()
        documentId = body.documentId
        const requestedProcessor = normalizeProcessor(body.processor)
        const usePureNlp = requestedProcessor ? requestedProcessor === 'pure_nlp' : baseUsePureNlp
        const isProcessorOverride = Boolean(requestedProcessor)

        if (body.processor && !requestedProcessor) {
            console.log(`⚠️ Invalid processor override "${body.processor}", ignoring`)
        }

        if (requestedProcessor === 'gemini' && !canUseGemini) {
            throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
        }

        if (!usePureNlp && !canUseGemini) {
            throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
        }

        console.log(`🧭 Processing mode: ${usePureNlp ? 'pure_nlp' : 'gemini'}${requestedProcessor ? ' (override)' : ' (default)'}`)

        if (!documentId) {
            throw new Error('INVALID_REQUEST:Document ID is required.')
        }

        console.log(`📄 Processing document: ${documentId}`)

        // 1. Fetch document metadata
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single()

        if (docError || !document) {
            throw new Error('DOC_NOT_FOUND:The document could not be found. It may have been deleted.')
        }

        // Update status to processing
        await supabase
            .from('documents')
            .update({ status: 'processing', error_message: null })
            .eq('id', documentId)

        // 2. Download file from storage
        console.log('📥 Downloading file from storage...')
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(document.file_path)

        if (downloadError || !fileData) {
            throw new Error(`STORAGE_ERROR:We couldn't retrieve your file. Please try uploading it again.`)
        }

        // 3. Extract text based on file type
        console.log(`📝 Starting NLP extraction for ${document.file_type} file...`)
        let textContent: string
        let extractedKeywords: string[] = []
        let importantSentences: string[] = []
        let extractedNounPhrases: NounPhrase[] = []
        let extractedClusters: SentenceCluster[] = []
        let extractedSummarySentences: SummarySentence[] = []
        let extractedClusterQuality: number | null = null
        let extractedProcessingQuality: number | null = null
        let extractedConceptRelationships: ConceptRelationship[] = []
        let extractedDocumentType = 'prose'
        let extractedSlides: SlideData[] = []

        if (nlpServiceUrl) {
            // Use NLP service for extraction + keywords + ranked sentences + clusters
            const nlpStartTime = Date.now()
            console.log('🧠 NLP service extraction started')
            const nlpResult = await extractWithNlpService(fileData, nlpServiceUrl, document.file_type)
            textContent = nlpResult.text
            extractedKeywords = nlpResult.keywords
            importantSentences = nlpResult.importantSentences
            extractedNounPhrases = nlpResult.nounPhrases
            extractedClusters = nlpResult.sentenceClusters
            extractedSummarySentences = nlpResult.summarySentences
            extractedClusterQuality = nlpResult.clusterQuality
            extractedProcessingQuality = nlpResult.processingQuality
            extractedConceptRelationships = nlpResult.conceptRelationships
            extractedDocumentType = nlpResult.documentType
            extractedSlides = nlpResult.slides
            console.log('✅ NLP service extraction finished', {
                durationMs: Date.now() - nlpStartTime,
                charCount: textContent.length,
                keywordCount: extractedKeywords.length,
                sentenceCount: importantSentences.length,
                clusterCount: extractedClusters.length,
                nounPhraseCount: extractedNounPhrases.length,
                summarySentenceCount: extractedSummarySentences.length,
                clusterQuality: extractedClusterQuality,
                processingQuality: extractedProcessingQuality,
                conceptRelationships: extractedConceptRelationships.length,
                documentType: extractedDocumentType,
                slideCount: extractedSlides.length,
            })
        } else if (document.file_type === 'pdf') {
            // Fallback: basic PDF extraction (may not work well)
            console.log('🧠 NLP service unavailable, using PDF fallback extraction')
            textContent = await extractTextFromPdfFallback(fileData)
        } else {
            // Plain text files
            console.log('🧠 NLP service unavailable, using raw text extraction')
            textContent = await fileData.text()
        }

        if (!textContent || textContent.trim().length === 0) {
            throw new Error('EMPTY_DOC:The document appears to be empty or could not be read. Please try uploading again.')
        }

        console.log(`✅ Extracted ${textContent.length} characters from document`)
        if (extractedKeywords.length > 0) {
            console.log(`🔑 Extracted ${extractedKeywords.length} keywords from NLP service`)
        }

        // Save original text to database for caching/RAG
        await supabase
            .from('documents')
            .update({ original_text: textContent })
            .eq('id', documentId)

        // 4. Chunk the text
        const chunks = chunkText(textContent, CHUNK_SIZE, CHUNK_OVERLAP)
        const totalChunks = chunks.length
        const chunksToProcess = chunks.slice(0, MAX_CHUNKS)
        const wasTruncated = totalChunks > MAX_CHUNKS

        console.log(`📦 Created ${totalChunks} chunks, processing ${chunksToProcess.length}`)

        if (wasTruncated) {
            console.log(`⚠️ Document too large, processing only first ${MAX_CHUNKS} chunks`)
        }

        // 5. Clear previous derived data (chunks, concepts, embeddings)
        console.log('🧹 Clearing previous derived data...')
        await clearDerivedData(supabase, documentId)

        // 6. Save chunks to database
        console.log('💾 Saving chunks to database...')
        const chunkRecords = chunksToProcess.map((content, index) => ({
            document_id: documentId,
            content,
            chunk_index: index,
            token_count: Math.ceil(content.length / 4), // Rough token estimate
        }))

        const { data: savedChunks, error: chunkError } = await supabase
            .from('chunks')
            .insert(chunkRecords)
            .select()

        if (chunkError) {
            throw new Error(`DB_ERROR:We couldn't save the processed content. Please try again.`)
        }

        // 7. Analyze document (Pure NLP default, Gemini optional)
        const derivedKeywords = extractedKeywords.length > 0
            ? extractedKeywords
            : extractKeywordsFromText(textContent, 15)
        const derivedImportantSentences = importantSentences.length > 0
            ? importantSentences
            : splitSentences(textContent).slice(0, 10)

        const pureNlpResult = buildPureNlpResult(
            textContent, derivedKeywords, derivedImportantSentences,
            extractedNounPhrases, extractedClusters,
            extractedSummarySentences,
            extractedDocumentType, extractedSlides
        )

        const runGeminiAnalysis = async (): Promise<GeminiResponse> => {
            if (!geminiApiKey) {
                throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
            }

            const apiKey = geminiApiKey
            console.log('🤖 Analyzing document with Gemini...')
            const geminiStart = Date.now()
            const wasChunked = chunksToProcess.length > 1
            const result = wasChunked
                ? await processChunkedDocument(chunksToProcess, apiKey)
                : await processSingleDocument(textContent, apiKey)
            console.log(`⚡ Gemini analysis took: ${Date.now() - geminiStart}ms`)
            return result
        }

        let analysisResult: GeminiResponse = pureNlpResult
        let processedBy = 'pure_nlp'

        if (usePureNlp) {
            console.log(`🧠 Using Pure NLP analysis${isProcessorOverride ? ' (override)' : ' (default)'}`)
            if (!isProcessorOverride && (analysisResult.concepts.length === 0 || analysisResult.summary.trim().length === 0)) {
                if (canUseGemini) {
                    console.log('⚠️ Pure NLP returned limited results, falling back to Gemini...')
                    analysisResult = await runGeminiAnalysis()
                    processedBy = 'gemini'
                } else {
                    console.log('⚠️ Pure NLP results limited and Gemini unavailable; continuing with NLP output')
                }
            }
        } else {
            analysisResult = await runGeminiAnalysis()
            processedBy = 'gemini'
        }

        console.log(`🧠 Extracted ${analysisResult.concepts.length} concepts`)

        // 8. Save concepts to database (with chunk_id mapping)
        let savedConceptIds: string[] = []
        if (analysisResult.concepts.length > 0) {
            console.log('💾 Saving concepts to database...')

            const chunkData = (savedChunks || []).map((c: { id: string; content: string; chunk_index?: number }) => ({
                id: c.id,
                content: c.content,
                chunk_index: (c as Record<string, unknown>).chunk_index as number ?? 0,
            }))
            const mappedConcepts = mapConceptsToChunks(analysisResult.concepts, chunkData)
            const chunksMapped = mappedConcepts.filter(c => c.chunk_id).length
            console.log(`🔗 Mapped ${chunksMapped}/${mappedConcepts.length} concepts to chunks`)

            const conceptRecords = mappedConcepts.map((concept) => ({
                document_id: documentId,
                name: concept.name,
                description: concept.description,
                category: concept.category,
                importance: concept.importance,
                difficulty_level: concept.difficulty_level,
                keywords: concept.keywords,
                ...(concept.source_pages ? { source_pages: concept.source_pages } : {}),
                ...(concept.chunk_id ? { chunk_id: concept.chunk_id } : {}),
            }))

            const { data: savedConcepts, error: conceptError } = await supabase
                .from('concepts')
                .insert(conceptRecords)
                .select('id')

            if (conceptError) {
                console.error('⚠️ Failed to save concepts:', conceptError)
            } else if (savedConcepts) {
                savedConceptIds = savedConcepts.map((c: { id: string }) => c.id)
            }

            // 8b. Populate related_concepts using NLP relationship data
            if (savedConceptIds.length > 0 && extractedConceptRelationships.length > 0) {
                console.log(`🔗 Setting ${extractedConceptRelationships.length} concept relationships...`)
                const relMap = new Map<number, Set<number>>()
                for (const rel of extractedConceptRelationships) {
                    const { source_idx, target_idx } = rel
                    if (source_idx < savedConceptIds.length && target_idx < savedConceptIds.length) {
                        if (!relMap.has(source_idx)) relMap.set(source_idx, new Set())
                        if (!relMap.has(target_idx)) relMap.set(target_idx, new Set())
                        relMap.get(source_idx)!.add(target_idx)
                        relMap.get(target_idx)!.add(source_idx)
                    }
                }

                for (const [idx, relatedIndices] of relMap) {
                    const conceptId = savedConceptIds[idx]
                    const relatedIds = [...relatedIndices].map(i => savedConceptIds[i]).filter(Boolean)
                    if (conceptId && relatedIds.length > 0) {
                        await supabase
                            .from('concepts')
                            .update({ related_concepts: relatedIds })
                            .eq('id', conceptId)
                    }
                }
            }
        }

        // 8c. Generate flashcards from concepts
        if (nlpServiceUrl && analysisResult.concepts.length > 0 && document.user_id) {
            try {
                console.log('🃏 Generating flashcards...')
                const flashcardInput = {
                    concepts: analysisResult.concepts.map((c) => ({
                        concept_name: c.name,
                        description: c.description,
                        keywords: c.keywords,
                        source_page: c.source_pages?.[0] ?? null,
                    })),
                    important_sentences: derivedImportantSentences.slice(0, 20),
                    max_cards: 30,
                }

                const flashcardTimeoutMs = parseTimeoutMs(Deno.env.get('NLP_SERVICE_TIMEOUT_MS'), 30000)
                const fcResponse = await fetchWithTimeout(
                    `${nlpServiceUrl}/generate-flashcards`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(flashcardInput),
                    },
                    flashcardTimeoutMs
                )

                if (fcResponse.ok) {
                    const fcResult = await fcResponse.json()
                    if (fcResult.success && fcResult.flashcards?.length > 0) {
                        // Delete old flashcards for this document/user
                        await supabase
                            .from('flashcards')
                            .delete()
                            .eq('document_id', documentId)
                            .eq('user_id', document.user_id)

                        // Build concept name → ID lookup
                        const conceptNameToId = new Map<string, string>()
                        if (savedConceptIds.length > 0) {
                            analysisResult.concepts.forEach((c, idx) => {
                                if (savedConceptIds[idx]) {
                                    conceptNameToId.set(c.name.toLowerCase(), savedConceptIds[idx])
                                }
                            })
                        }

                        const flashcardRecords = fcResult.flashcards.map((fc: { front: string; back: string; concept_name: string; difficulty: string; source_page: number | null }) => ({
                            document_id: documentId,
                            user_id: document.user_id,
                            front: fc.front,
                            back: fc.back,
                            concept_id: conceptNameToId.get(fc.concept_name?.toLowerCase()) ?? null,
                            difficulty_level: fc.difficulty || 'intermediate',
                            source_page: fc.source_page,
                        }))

                        const { error: fcInsertError } = await supabase
                            .from('flashcards')
                            .insert(flashcardRecords)

                        if (fcInsertError) {
                            console.error('⚠️ Failed to save flashcards:', fcInsertError.message)
                        } else {
                            console.log(`✅ Saved ${flashcardRecords.length} flashcards`)
                        }
                    }
                }
            } catch (fcErr) {
                console.error('⚠️ Flashcard generation failed (non-blocking):', (fcErr as Error).message)
            }
        }

        // 9. Generate embeddings for each chunk
        if (savedChunks && savedChunks.length > 0) {
            if (canUseGemini) {
                console.log('🔢 Generating embeddings for semantic search...')
                await generateAndSaveEmbeddings(
                    supabase,
                    documentId,
                    savedChunks,
                    geminiApiKey as string
                )
            } else {
                console.log('ℹ️ Skipping embeddings (GEMINI_API_KEY not configured)')
            }
        }

        // 10. Update document with summary and concept count
        const updatePayload: Record<string, unknown> = {
            status: 'ready',
            summary: analysisResult.summary,
            concept_count: analysisResult.concepts.length,
            error_message: null,
        }

        if (analysisResult.structured_summary) {
            updatePayload.structured_summary = analysisResult.structured_summary
        }

        if (await hasProcessedByColumn(supabase)) {
            updatePayload.processed_by = processedBy
        }

        if (extractedProcessingQuality !== null) {
            updatePayload.processing_quality = extractedProcessingQuality
        }

        const { error: updateError } = await supabase
            .from('documents')
            .update(updatePayload)
            .eq('id', documentId)

        if (updateError) {
            throw new Error(`DB_ERROR:We couldn't finalize your document. Please try processing again.`)
        }

        const totalTime = Date.now() - startTime
        console.log(`✅ Document processed successfully in ${totalTime}ms`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Document processed successfully',
                conceptCount: analysisResult.concepts.length,
                chunkCount: chunksToProcess.length,
                wasTruncated,
                processingTimeMs: totalTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        const errorMessage = (error as Error).message
        console.error('❌ Processing error:', errorMessage)

        // Parse user-friendly errors (format: "ERROR_CODE:User friendly message")
        let userMessage = 'Something went wrong while processing your document. Please try again.'
        let errorCode = 'UNKNOWN_ERROR'

        if (errorMessage.includes(':')) {
            const parts = errorMessage.split(':')
            errorCode = parts[0]
            userMessage = parts.slice(1).join(':')
        }

        // Try to update document status to error
        if (documentId) {
            try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseServiceKey)

                await supabase
                    .from('documents')
                    .update({
                        status: 'error',
                        error_message: userMessage
                    })
                    .eq('id', documentId)
            } catch (e) {
                console.error('⚠️ Failed to update error status:', e)
            }
        }

        return new Response(
            JSON.stringify({
                success: false,
                error: userMessage,
                errorCode,
                technicalDetails: errorMessage // For debugging
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

/**
 * Extract text from document using NLP Microservice (Tika + TextRank + KeyBERT)
 * This is the proper way to extract text from PDF/DOCX files
 */
interface SummarySentence {
    text: string
    index: number
    relevance_score: number
}

interface SlideData {
    slide_number: number
    title: string
    bullets: string[]
    keywords?: string[]
}

interface ConceptRelationship {
    source_idx: number
    target_idx: number
    similarity: number
    relationship_type: string
}

interface NlpExtractionResult {
    text: string
    keywords: string[]
    importantSentences: string[]
    nounPhrases: NounPhrase[]
    sentenceClusters: SentenceCluster[]
    summarySentences: SummarySentence[]
    clusterQuality: number | null
    processingQuality: number | null
    conceptRelationships: ConceptRelationship[]
    documentType: string
    slides: SlideData[]
}

async function extractWithNlpService(
    blob: Blob,
    nlpServiceUrl: string,
    fileType: string
): Promise<NlpExtractionResult> {
    console.log(`🔧 Calling NLP service at ${nlpServiceUrl}...`)

    try {
        // Create form data with the file
        const formData = new FormData()
        formData.append('file', blob, `document.${fileType}`)

        const timeoutMs = parseTimeoutMs(Deno.env.get('NLP_SERVICE_TIMEOUT_MS'), 60000)
        const response = await fetchWithTimeout(
            `${nlpServiceUrl}/process`,
            {
                method: 'POST',
                body: formData,
            },
            timeoutMs
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('NLP service error:', errorText)
            throw new Error(`NLP_SERVICE_ERROR:The text analysis service encountered an error. Please try again.`)
        }

        const result = await response.json()

        if (!result.success) {
            throw new Error(`NLP_SERVICE_ERROR:${result.error || 'Unknown error'}`)
        }

        console.log(`✅ NLP service extracted ${result.char_count} characters`)

        return {
            text: result.text,
            keywords: result.keywords || [],
            importantSentences: result.important_sentences || [],
            nounPhrases: result.noun_phrases || [],
            sentenceClusters: result.sentence_clusters || [],
            summarySentences: result.summary_sentences || [],
            clusterQuality: result.cluster_quality ?? null,
            processingQuality: result.processing_quality ?? null,
            conceptRelationships: result.concept_relationships || [],
            documentType: result.document_type || 'prose',
            slides: result.slides || [],
        }
    } catch (error) {
        const err = error as Error
        console.error('NLP service call failed:', err.message)

        // Re-throw errors that already carry an NLP error code — they are
        // intentional failures (e.g. empty document) thrown above, not
        // connection/network errors.
        if (err.message.startsWith('NLP_SERVICE_ERROR:') || err.message.startsWith('NLP_SERVICE_TIMEOUT:')) {
            throw err
        }

        if (err.name === 'AbortError') {
            throw new Error('NLP_SERVICE_TIMEOUT:Text extraction is taking too long. The document may be very large — please try a smaller file or try again later.')
        }

        throw new Error('NLP_SERVICE_ERROR:Could not reach the text extraction service. Please try again in a moment.')
    }
}

/**
 * Fallback: Extract text from PDF file (basic approach - may not work well)
 * Only used when NLP service is not available
 */
async function extractTextFromPdfFallback(blob: Blob): Promise<string> {
    console.log('⚠️ Using fallback PDF extraction (may not work well)')
    const text = await blob.text()

    // Try to extract readable text (basic approach)
    const cleanedText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (cleanedText.length > 100) {
        return cleanedText
    }

    throw new Error('PDF_ERROR:We couldn\'t extract text from this PDF. It may be image-based or protected. Try uploading a different version.')
}

/**
 * Split text into chunks, trying to break at sentence boundaries
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= chunkSize) {
            chunks.push(remaining.trim())
            break
        }

        // Try to find a sentence boundary near the chunk size
        let breakPoint = chunkSize

        // Look for sentence endings (. ! ?) within the last 500 chars of the chunk
        const searchStart = Math.max(0, chunkSize - 500)
        const searchArea = remaining.substring(searchStart, chunkSize)

        // Find the last sentence boundary
        const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n']
        let lastBoundary = -1

        for (const ending of sentenceEndings) {
            const pos = searchArea.lastIndexOf(ending)
            if (pos > lastBoundary) {
                lastBoundary = pos
            }
        }

        if (lastBoundary > 0) {
            breakPoint = searchStart + lastBoundary + 2
        }

        chunks.push(remaining.substring(0, breakPoint).trim())
        remaining = remaining.substring(Math.max(0, breakPoint - overlap)).trim()
    }

    return chunks.filter(chunk => chunk.length > 50) // Remove tiny chunks
}

/**
 * Map each concept to its best-matching chunk by finding which chunk
 * contains the concept's description or name. Uses keyword overlap as tiebreaker.
 */
function mapConceptsToChunks(
    concepts: Concept[],
    savedChunks: Array<{ id: string; content: string; chunk_index: number }>
): Concept[] {
    if (!savedChunks || savedChunks.length === 0) return concepts

    return concepts.map((concept) => {
        let bestChunkId: string | undefined
        let bestScore = 0

        const nameLower = concept.name.toLowerCase()
        const descLower = (concept.description || '').toLowerCase()
        const conceptKeywords = (concept.keywords || []).map(k => k.toLowerCase())

        for (const chunk of savedChunks) {
            const contentLower = chunk.content.toLowerCase()
            let score = 0

            if (contentLower.includes(descLower.substring(0, 80))) {
                score += 5
            }

            if (contentLower.includes(nameLower)) {
                score += 3
            }

            for (const kw of conceptKeywords) {
                if (kw.length > 3 && contentLower.includes(kw)) {
                    score += 1
                }
            }

            if (score > bestScore) {
                bestScore = score
                bestChunkId = chunk.id
            }
        }

        if (bestChunkId && bestScore > 0) {
            return { ...concept, chunk_id: bestChunkId }
        }
        return concept
    })
}

/**
 * Split text into sentences (best-effort)
 */
function splitSentences(text: string): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) {
        return []
    }

    const matches = normalized.match(/[^.!?]+[.!?]+/g) || []
    const remainder = normalized.replace(/[^.!?]+[.!?]+/g, '').trim()

    if (remainder) {
        matches.push(remainder)
    }

    return matches.map((s) => s.trim()).filter(Boolean)
}

/**
 * Extract keywords from text using simple frequency analysis
 */
function extractKeywordsFromText(text: string, limit: number): string[] {
    const counts = new Map<string, number>()
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word))

    for (const word of words) {
        counts.set(word, (counts.get(word) || 0) + 1)
    }

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word)
}

function toTitleCase(value: string): string {
    const ACRONYMS: Record<string, string> = {
        rnn: 'RNN',
        lstm: 'LSTM',
        gru: 'GRU',
        bptt: 'BPTT',
        cnn: 'CNN',
        rnnss: 'RNNs', // sometimes appears from tokenization
    }

    return value
        .split(' ')
        .map((word) => {
            if (!word) {
                return ''
            }

            const mapped = ACRONYMS[word.toLowerCase()]
            if (mapped) {
                return mapped
            }

            // Preserve acronyms / common technical tokens.
            if (/^[A-Z0-9]{2,}$/.test(word)) {
                return word
            }

            return word[0].toUpperCase() + word.slice(1)
        })
        .join(' ')
        .trim()
}

function stripNoisyInlineContent(text: string): string {
    return text
        // URLs add a lot of noise to study concepts.
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/www\.\S+/gi, ' ')
        // Common slide/page markers from PDFs.
        .replace(/\b(slide|page)\s*\d+\b/gi, ' ')
        // Strip arrow characters that leak from slide notation
        .replace(/[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f\u25b6\u25ba\u279c-\u279e]/g, ' ')
        // Strip residual mojibake: unicode control-range characters
        .replace(/\u00e2[\u0080-\u00bf]*/g, ' ')
        .replace(/[\u00c2\u00c3][\u0080-\u00bf]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function isStudyFriendlySentence(sentence: string): boolean {
    const s = sentence.trim()
    if (s.length < 40) return false
    if (s.length > 400) return false
    if (/https?:\/\/|www\./i.test(s)) return false
    if (/\b(slide|page)\s*\d+\b/i.test(s)) return false

    const letters = (s.match(/[a-z]/gi) || []).length
    if (letters / Math.max(1, s.length) < 0.45) return false

    return true
}

function normalizeForDedup(value: string): string {
    return value
        .toLowerCase()
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function filterKeywordsForStudy(keywords: string[]): string[] {
    const filtered: string[] = []
    const seen = new Set<string>()
    const slidePageNumberRe = /\b(slide|page)\s*\d+\b/i

    for (const raw of keywords) {
        // Strip arrows, articles, and inline noise before evaluation
        const phrase = stripArrowsAndArticles(stripNoisyInlineContent(raw || ''))
        if (!phrase) continue

        const lower = phrase.toLowerCase()
        if (seen.has(lower)) continue
        if (lower.includes('http') || lower.includes('www')) continue
        if (slidePageNumberRe.test(lower) || lower === 'slide' || lower === 'page') continue
        if (phrase.length < 3) continue
        if (isNumericHeavy(phrase)) continue
        // Reject single-word generic terms
        const words = lower.split(/\s+/)
        if (words.length === 1 && EDGE_GENERIC_TAGS.has(lower)) continue
        if (words.length === 1 && STOPWORDS.has(lower)) continue
        // Reject if ALL tokens are generic
        if (words.every(w => EDGE_GENERIC_TAGS.has(w) || STOPWORDS.has(w))) continue
        // Reject 2-word phrases where one token is purely numeric
        if (words.length === 2 && words.some(w => /^\d[\d.]*$/.test(w))) continue

        seen.add(lower)
        filtered.push(phrase)
    }

    return filtered
}

function findBestSupportingSentence(
    phrase: string,
    sentences: string[]
): { sentence: string; index: number } | null {
    const lowerPhrase = phrase.toLowerCase()
    let best: { sentence: string; index: number; score: number } | null = null

    for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i]
        const lower = s.toLowerCase()
        if (!lower.includes(lowerPhrase)) {
            continue
        }

        // Prefer earlier (higher-ranked) sentences and tighter matches.
        const score = (sentences.length - i) + Math.min(10, lowerPhrase.length / 6)
        if (!best || score > best.score) {
            best = { sentence: s, index: i, score }
        }
    }

    return best ? { sentence: best.sentence, index: best.index } : null
}

function extractKeyTerms(sentence: string): string[] {
    return sentence
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word))
}

function deriveConceptName(sentence: string, keywords: string[]): string {
    const lowerSentence = sentence.toLowerCase()
    const keywordMatch = keywords.find((keyword) => lowerSentence.includes(keyword.toLowerCase()))

    if (keywordMatch) {
        return toTitleCase(keywordMatch)
    }

    const terms = extractKeyTerms(sentence)
    if (terms.length === 0) {
        return 'Key Concept'
    }

    return toTitleCase(terms.slice(0, 4).join(' '))
}

function deriveKeywordsForSentence(sentence: string, keywords: string[]): string[] {
    const lowerSentence = sentence.toLowerCase()
    const matched = keywords.filter((keyword) => lowerSentence.includes(keyword.toLowerCase()))

    if (matched.length > 0) {
        return matched.slice(0, 5)
    }

    return extractKeyTerms(sentence).slice(0, 5)
}

// ============================================
// Cluster-based concept extraction types & helpers
// ============================================

interface NounPhrase {
    phrase: string
    count: number
}

interface SentenceCluster {
    label: string
    sentence_indices: number[]
    key_terms: string[]
    representative_index: number
}

const LABEL_PENALTY_TERMS = new Set([
    'using', 'building', 'creating', 'importing', 'making', 'doing',
    'overview', 'introduction', 'general', 'example', 'review',
    'understanding', 'learning', 'studying', 'applying', 'getting',
    'started', 'basics', 'chapter', 'section', 'slide', 'page',
    'module', 'lecture', 'part', 'unit', 'step', 'steps',
    'thing', 'things', 'stuff', 'way', 'lot', 'kind', 'type',
    'datum', 'data', 'number', 'value', 'result', 'set',
    'use', 'work', 'time', 'end', 'place', 'form', 'point',
    'area', 'case', 'fact', 'group', 'order', 'side', 'level',
    'line', 'change', 'need', 'something', 'anything', 'everything',
    'item', 'list', 'issue', 'note', 'notes', 'idea', 'information',
    'you', 'your', 'we', 'our', 'they', 'their', 'one', 'ones',
    'portion', 'portions', 'method', 'approach', 'process', 'state',
    'problem', 'question', 'answer', 'term', 'terms',
])

const LABEL_ARTICLES = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'many', 'each', 'every'])

const KNOWN_ACRONYMS = new Set([
    'CNN', 'RNN', 'LSTM', 'GRU', 'BPTT', 'NLP', 'ML', 'AI', 'GPU', 'CPU',
    'API', 'SQL', 'HTML', 'CSS', 'HTTP', 'REST', 'JSON', 'XML', 'TCP', 'UDP',
    'OOP', 'DFS', 'BFS', 'SVM', 'PCA', 'GAN', 'VAE', 'MLP', 'KNN',
    'SGD', 'ADAM', 'ReLU', 'MSE', 'MAE', 'ROC', 'AUC', 'IoU',
])

const PROTECTED_BIGRAMS = new Set([
    'deep learning', 'machine learning', 'reinforcement learning',
    'transfer learning', 'supervised learning', 'unsupervised learning',
    'representation learning', 'active learning', 'online learning',
    'federated learning', 'contrastive learning', 'curriculum learning',
    'neural network', 'neural networks',
    'data structure', 'data structures', 'data science',
    'computer vision', 'computer science', 'natural language',
    'operating system', 'operating systems',
    'information retrieval', 'information theory',
])

const LEADING_PREPS = new Set([
    'of', 'for', 'in', 'on', 'to', 'by', 'with', 'from', 'about', 'between',
])

const COMMON_SINGLE_WORDS = new Set([
    'useful', 'connected', 'dense', 'important', 'similar',
    'different', 'simple', 'complex', 'possible', 'available',
    'necessary', 'better', 'worse', 'faster', 'slower',
    'larger', 'smaller', 'higher', 'lower', 'common', 'typical',
])

function cleanConceptLabel(rawLabel: string): string {
    const stripped = stripArrowsAndArticles(rawLabel)
    const tokens = stripped.split(/\s+/).filter(Boolean)

    if (isNumericHeavy(stripped)) return ''

    const noArticles = tokens.filter(t => !LABEL_ARTICLES.has(t.toLowerCase()))

    // Build protected token indices before penalty filtering
    const protectedIndices = new Set<number>()
    for (let i = 0; i < noArticles.length - 1; i++) {
        const bigram = `${noArticles[i].toLowerCase()} ${noArticles[i + 1].toLowerCase()}`
        if (PROTECTED_BIGRAMS.has(bigram)) {
            protectedIndices.add(i)
            protectedIndices.add(i + 1)
        }
    }

    const cleaned = noArticles.filter((t, i) =>
        protectedIndices.has(i) || !LABEL_PENALTY_TERMS.has(t.toLowerCase())
    )

    // Strip leading prepositions left behind after penalty removal
    while (cleaned.length > 0 && LEADING_PREPS.has(cleaned[0].toLowerCase())) {
        cleaned.shift()
    }

    if (cleaned.length === 0) return ''

    const joined = cleaned.join(' ')
    if (/[\u00e2\u00c3\u00c2\u0080-\u009f]/.test(joined)) return ''

    if (cleaned.length === 1) {
        const upper = cleaned[0].toUpperCase()
        if (KNOWN_ACRONYMS.has(upper)) return upper
        if (cleaned[0].length <= 4) return ''
        if (COMMON_SINGLE_WORDS.has(cleaned[0].toLowerCase())) return ''
    }

    if (cleaned.length > 5) return toTitleCase(cleaned.slice(0, 4).join(' '))
    return toTitleCase(cleaned.join(' '))
}

function jaccardSimilarity(nameA: string, nameB: string): number {
    const tokensA = new Set(normalizeForDedup(nameA).split(' ').filter(Boolean))
    const tokensB = new Set(normalizeForDedup(nameB).split(' ').filter(Boolean))
    const intersection = [...tokensA].filter(t => tokensB.has(t)).length
    const union = new Set([...tokensA, ...tokensB]).size
    if (union === 0) return 0
    return intersection / union
}

function isContainedIn(shorter: string, longer: string): boolean {
    const shortTokens = normalizeForDedup(shorter).split(' ').filter(Boolean)
    const longTokens = new Set(normalizeForDedup(longer).split(' ').filter(Boolean))
    if (shortTokens.length === 0 || shortTokens.length >= longTokens.size) return false
    return shortTokens.every(t => longTokens.has(t))
}

function deduplicateConcepts(concepts: Concept[]): Concept[] {
    const kept: Concept[] = []

    for (const candidate of concepts) {
        let mergeTarget = -1

        for (let i = 0; i < kept.length; i++) {
            const existing = kept[i]
            const nameA = candidate.name
            const nameB = existing.name

            // Exact normalized match
            if (normalizeForDedup(nameA) === normalizeForDedup(nameB)) {
                mergeTarget = i
                break
            }

            // Containment: one name's tokens are a subset of the other's
            if (isContainedIn(nameA, nameB) || isContainedIn(nameB, nameA)) {
                mergeTarget = i
                break
            }

            // Jaccard overlap (stricter threshold for short names)
            const tokenCountA = normalizeForDedup(nameA).split(' ').filter(Boolean).length
            const tokenCountB = normalizeForDedup(nameB).split(' ').filter(Boolean).length
            const minTokens = Math.min(tokenCountA, tokenCountB)
            const threshold = minTokens <= 2 ? 0.7 : 0.5
            if (jaccardSimilarity(nameA, nameB) > threshold) {
                mergeTarget = i
                break
            }
        }

        if (mergeTarget >= 0) {
            const existing = kept[mergeTarget]
            // Keep the one with higher importance; if tied, prefer the shorter name
            if (candidate.importance > existing.importance ||
                (candidate.importance === existing.importance && candidate.name.length < existing.name.length)) {
                // Merge tags from existing into candidate
                const mergedTags = [...new Set([...candidate.keywords, ...existing.keywords])].slice(0, 5)
                kept[mergeTarget] = { ...candidate, keywords: mergedTags }
            } else {
                // Merge candidate's tags into existing
                const mergedTags = [...new Set([...existing.keywords, ...candidate.keywords])].slice(0, 5)
                kept[mergeTarget] = { ...existing, keywords: mergedTags }
            }
        } else {
            kept.push(candidate)
        }
    }

    return kept
}

function estimateDifficulty(description: string): string {
    try {
        const words = description.split(/\s+/)
        const avgWordLen = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length)
        const hasIntroPattern = /\b(basic|introduction|what is|definition|overview|fundamental)\b/i.test(description)
        const hasMathPattern = /[=+\-*/^]|\b(equation|formula|theorem|proof|derivative|gradient)\b/i.test(description)
        const hasAdvancedVocab = /\b(optimization|regularization|backpropagation|convergence|hyperparameter)\b/i.test(description)
        const acronymCount = (description.match(/\b[A-Z]{2,}\b/g) || []).length

        if (hasIntroPattern && avgWordLen < 5.5) return 'beginner'
        if (hasMathPattern || hasAdvancedVocab || (acronymCount >= 3 && avgWordLen > 6)) return 'advanced'
        return 'intermediate'
    } catch {
        return 'intermediate'
    }
}

function detectCategory(conceptName: string, keywords: string[]): string {
    try {
        const text = [conceptName, ...keywords].join(' ').toLowerCase()
        const rules: Array<{ pattern: RegExp; label: string }> = [
            { pattern: /\b(neural network|deep learning|cnn|rnn|lstm|gru|transformer)\b/, label: 'Neural Networks' },
            { pattern: /\b(convolution|filter|kernel|feature map|pooling|stride|padding)\b/, label: 'CNN Architecture' },
            { pattern: /\b(gradient|backpropagation|loss function|optimizer|learning rate)\b/, label: 'Training' },
            { pattern: /\b(batch size|epoch|dropout|regularization|hyperparameter)\b/, label: 'Hyperparameters' },
            { pattern: /\b(activation|relu|sigmoid|softmax|tanh)\b/, label: 'Activation Functions' },
            { pattern: /\b(algorithm|sort|search|complexity|big.?o)\b/, label: 'Algorithms' },
            { pattern: /\b(array|linked list|tree|graph|stack|queue|hash)\b/, label: 'Data Structures' },
            { pattern: /\b(database|sql|query|schema|table|index)\b/, label: 'Databases' },
            { pattern: /\b(class|object|inheritance|polymorphism|encapsulation)\b/, label: 'Object-Oriented Programming' },
            { pattern: /\b(variable|function|loop|condition|syntax)\b/, label: 'Programming Fundamentals' },
        ]
        for (const { pattern, label } of rules) {
            if (pattern.test(text)) return label
        }
        return 'General Study'
    } catch {
        return 'General Study'
    }
}

function stripLeadingConjunctions(text: string): string {
    return text.replace(/^(And|But|Also|Or|So|Yet|However|Moreover|Furthermore|Additionally)\s+/i, '').trim()
}

function truncateOnSentenceBoundary(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text
    const truncated = text.substring(0, maxLen)
    const lastPeriod = truncated.lastIndexOf('. ')
    const lastExclaim = truncated.lastIndexOf('! ')
    const lastQuestion = truncated.lastIndexOf('? ')
    const boundary = Math.max(lastPeriod, lastExclaim, lastQuestion)
    if (boundary > maxLen * 0.4) {
        return truncated.substring(0, boundary + 1).trim()
    }
    return truncated.trim()
}

// Fixed pedagogical section definitions
const PEDAGOGICAL_SECTIONS = [
    {
        title: 'Introduction',
        icon: 'play',
        patterns: /\b(introduc|what is|overview|basic|definition|define|background|purpose|objective|about)\b/i,
    },
    {
        title: 'Core Concepts',
        icon: 'sparkles',
        patterns: /\b(concept|theory|principle|fundamental|key idea|mechanism|how .+ works?|architecture|structure|model|framework)\b/i,
    },
    {
        title: 'Key Components',
        icon: 'grid',
        patterns: /\b(component|layer|module|element|parameter|configur|feature|property|attribute|type|class)\b/i,
    },
    {
        title: 'Applications',
        icon: 'layers',
        patterns: /\b(appl|use case|example|implement|build|create|code|train|deploy|practice|exercise|real.?world)\b/i,
    },
    {
        title: 'Challenges',
        icon: 'alert-triangle',
        patterns: /\b(challeng|problem|limit|issue|drawback|trade.?off|difficult|disadvantage|error|overfitting|underfitting)\b/i,
    },
]

const BULLET_LABEL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(defin|is a\b|are a\b|refers to|means\b|known as)\b/i, label: 'DEFINITION' },
    { pattern: /\b(example|instance|such as|e\.g\.|for instance|illustrated by)\b/i, label: 'EXAMPLE' },
    { pattern: /\b(step|process|procedure|build|create|implement|compil|train|algorithm|pipeline)\b/i, label: 'PROCESS' },
    { pattern: /\b(challeng|problem|issue|difficult|limit|drawback|error|vanish|overfit|underfit)\b/i, label: 'CHALLENGE' },
    { pattern: /\b(advantage|benefit|strength|useful|improve|efficient|reduce|fast|simple)\b/i, label: 'ADVANTAGE' },
    { pattern: /\b(compar|differ|unlike|versus|vs\b|contrast|distinction|verses)\b/i, label: 'KEY DISTINCTION' },
    { pattern: /\b(operation|convol|mathematical|computation|formula|calculat|transform|activation)\b/i, label: 'PROCESS' },
    { pattern: /\b(architecture|network|layer|neuron|kernel|filter|channel|pool|stride)\b/i, label: 'KEY CONCEPT' },
    { pattern: /\b(key|important|fundamental|essential|core|critical|significant)\b/i, label: 'KEY CONCEPT' },
]

function detectBulletLabel(text: string): string {
    for (const { pattern, label } of BULLET_LABEL_PATTERNS) {
        if (pattern.test(text)) return label
    }
    // Colon-separated "Term: explanation" is very common in slide bullets
    if (/^[A-Z][A-Za-z\s-]{2,30}:/.test(text.trim())) return 'DEFINITION'
    return 'KEY CONCEPT'
}

function classifyClusterToSection(clusterText: string): number {
    let bestIdx = 1 // Default to "Core Concepts"
    let bestScore = 0

    for (let i = 0; i < PEDAGOGICAL_SECTIONS.length; i++) {
        const matches = clusterText.match(PEDAGOGICAL_SECTIONS[i].patterns)
        const score = matches ? matches.length : 0
        if (score > bestScore) {
            bestScore = score
            bestIdx = i
        }
    }

    return bestIdx
}

function buildStructuredSummaryFromClusters(
    sentencePool: string[],
    clusters: SentenceCluster[],
    summarySentences: SummarySentence[],
    fallbackSentences: string[]
): { summary: string; structured: StructuredSummary } {
    const shortSources = summarySentences.length > 0
        ? summarySentences.slice(0, 3).map(s => s.text)
        : fallbackSentences.slice(0, 3)
    const shortText = shortSources.join('. ').replace(/\.\./g, '.').trim()
    const short = shortText.endsWith('.') ? shortText : shortText + '.'

    // Classify each cluster into a pedagogical section
    const sectionBuckets: Map<number, string[]> = new Map()

    for (const cluster of clusters) {
        const clusterSentences = cluster.sentence_indices
            .map(idx => sentencePool[idx])
            .filter(Boolean)
        if (clusterSentences.length === 0) continue

        const representative = sentencePool[cluster.representative_index] || clusterSentences[0]
        const clusterText = clusterSentences.join(' ')
        const sectionIdx = classifyClusterToSection(clusterText)

        let content = representative
        if (clusterSentences.length >= 2) {
            const second = clusterSentences.find(s => s !== representative)
            if (second) content = representative + '. ' + second
        }
        content = stripLeadingConjunctions(content)
        if (content.length > 400) {
            content = truncateOnSentenceBoundary(content, 400)
        }

        const existing = sectionBuckets.get(sectionIdx) || []
        existing.push(content)
        sectionBuckets.set(sectionIdx, existing)
    }

    // Build detailed sections from buckets, keeping order
    const detailed: SummarySection[] = []
    for (let i = 0; i < PEDAGOGICAL_SECTIONS.length; i++) {
        const contents = sectionBuckets.get(i)
        if (!contents || contents.length === 0) continue

        let merged = contents.join(' ')
        if (merged.length > 600) {
            merged = truncateOnSentenceBoundary(merged, 600)
        }

        detailed.push({
            title: PEDAGOGICAL_SECTIONS[i].title,
            icon: PEDAGOGICAL_SECTIONS[i].icon,
            content: merged,
        })
    }

    // If classification left us with fewer than 2 sections, build from MMR sentences
    if (detailed.length < 2 && summarySentences.length > 0) {
        const mmrSentences = summarySentences.map(s => s.text)
        if (mmrSentences.length >= 2) {
            detailed.length = 0
            detailed.push({
                title: 'Introduction',
                icon: 'play',
                content: mmrSentences[0],
            })
            detailed.push({
                title: 'Core Concepts',
                icon: 'sparkles',
                content: mmrSentences.slice(1, 3).join('. '),
            })
            if (mmrSentences.length > 3) {
                detailed.push({
                    title: 'Key Components',
                    icon: 'grid',
                    content: mmrSentences.slice(3).join('. '),
                })
            }
        }
    }

    // Bullets: one per cluster representative with concept label prefix
    const bullets: SummaryBullet[] = []
    for (const cluster of clusters) {
        if (bullets.length >= 10) break
        const rep = sentencePool[cluster.representative_index]
        if (!rep) continue
        const label = detectBulletLabel(rep)
        const clusterLabel = cleanConceptLabel(cluster.label)
        const text = clusterLabel
            ? `${clusterLabel}: ${stripLeadingConjunctions(rep)}`
            : stripLeadingConjunctions(rep)
        bullets.push({ label, text })
    }

    if (bullets.length < 3 && summarySentences.length > 0) {
        const usedTexts = new Set(bullets.map(b => b.text.toLowerCase()))
        for (const ss of summarySentences) {
            if (bullets.length >= 10) break
            if (usedTexts.has(ss.text.toLowerCase())) continue
            usedTexts.add(ss.text.toLowerCase())
            bullets.push({
                label: detectBulletLabel(ss.text),
                text: stripLeadingConjunctions(ss.text),
            })
        }
    }

    return {
        summary: short,
        structured: { short, detailed, bullets },
    }
}

function filterConceptTags(tags: string[], labelLower: string): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const t of tags) {
        const cleaned = stripArrowsAndArticles(t)
        const low = cleaned.toLowerCase().trim()
        if (!low || low.length < 3) continue
        if (seen.has(low)) continue
        if (isNumericHeavy(cleaned)) continue
        if (EDGE_GENERIC_TAGS.has(low)) continue
        if (labelLower.includes(low)) continue
        if (STOPWORDS.has(low)) continue
        const words = low.split(/\s+/)
        if (words.length === 1 && STOPWORDS.has(low)) continue
        seen.add(low)
        result.push(cleaned)
        if (result.length >= 4) break
    }
    return result
}

function stripArrowsAndArticles(text: string): string {
    return text
        .replace(/[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f\u25b6\u25ba\u279c-\u279e]/g, ' ')
        .replace(/^\s*(the|a|an)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

const META_SLIDE_TITLES = new Set([
    'agenda', 'outline', 'table of contents', 'topics', 'overview',
    'contents', 'objectives', 'learning objectives', 'recap',
    'references', 'bibliography', 'thank you', 'questions',
    'q&a', 'summary', 'review', 'end',
])

const COVER_SLIDE_RE = /^[A-Za-z\s]+:\s*\d+/

function isMetaSlide(slide: SlideData): boolean {
    const titleLower = (slide.title || '').trim().toLowerCase()
    if (META_SLIDE_TITLES.has(titleLower)) return true
    if (slide.slide_number === 1 && COVER_SLIDE_RE.test(slide.title || '')) return true
    return false
}

function buildConceptsFromSlides(slides: SlideData[]): Concept[] {
    const concepts: Concept[] = []
    const usedNames = new Set<string>()

    for (const slide of slides) {
        if (concepts.length >= 12) break

        if (isMetaSlide(slide)) continue

        const rawTitle = (slide.title || '').trim()
        if (!rawTitle || rawTitle.length < 3) continue

        const name = cleanConceptLabel(stripArrowsAndArticles(rawTitle))
        if (!name || name.length < 3) continue

        const nameKey = normalizeForDedup(name)
        if (usedNames.has(nameKey)) continue
        usedNames.add(nameKey)

        const cleanBullets = (slide.bullets || [])
            .map(b => stripArrowsAndArticles(b).trim())
            .filter(b => b.length > 5 && !isNumericHeavy(b) && !isCodeLikeContent(b))

        if (cleanBullets.length === 0) continue

        let description = cleanBullets.slice(0, 3).join('. ')
        description = stripLeadingConjunctions(description)
        if (description.length > 300) {
            description = truncateOnSentenceBoundary(description, 300)
        }
        if (!description.endsWith('.') && !description.endsWith('!') && !description.endsWith('?')) {
            description += '.'
        }

        const tags = filterConceptTags(
            (slide.keywords || []).map(k => stripArrowsAndArticles(k)).filter(Boolean),
            name.toLowerCase()
        )

        const importance = Math.min(10, Math.max(1, 10 - Math.floor((slide.slide_number - 1) / 3)))
        const difficulty = estimateDifficulty(description)
        const category = detectCategory(name, tags)

        concepts.push({
            name,
            description,
            category,
            importance,
            difficulty_level: difficulty,
            keywords: tags,
            source_pages: [slide.slide_number],
        })
    }

    return concepts
}

function buildStructuredSummaryFromSlides(
    slides: SlideData[]
): { summary: string; structured: StructuredSummary } {
    // Short summary: synthesized from first few slides with content
    const introSlides = slides
        .filter(s => (s.bullets || []).length > 0 && !isMetaSlide(s))
        .slice(0, 4)
    const shortParts: string[] = []
    for (const slide of introSlides) {
        const title = stripArrowsAndArticles(slide.title || '')
        if (isNumericHeavy(title)) continue
        const usableBullets = (slide.bullets || [])
            .map(b => stripArrowsAndArticles(b))
            .filter(b => b.length > 5 && !isNumericHeavy(b) && !isCodeLikeContent(b))
        const firstBullet = usableBullets[0] || ''
        if (title && firstBullet) {
            shortParts.push(`${title}: ${firstBullet}`)
        } else if (firstBullet) {
            shortParts.push(firstBullet)
        } else if (title) {
            shortParts.push(title)
        }
    }
    let short = shortParts.join('. ').replace(/\.\./g, '.').trim()
    if (short && !short.endsWith('.')) short += '.'
    if (!short) short = 'Document summary could not be generated.'

    // Detailed sections: group slides into pedagogical categories
    const sectionBuckets: Map<number, string[]> = new Map()

    for (const slide of slides) {
        if (isMetaSlide(slide)) continue
        const title = stripArrowsAndArticles(slide.title || '')
        const bullets = (slide.bullets || [])
            .map(b => stripArrowsAndArticles(b))
            .filter(b => b.length > 0 && !isNumericHeavy(b) && !isCodeLikeContent(b))
        if (!title && bullets.length === 0) continue
        if (isNumericHeavy(title) && bullets.length === 0) continue

        const slideText = [title, ...bullets].join(' ')
        const sectionIdx = classifyClusterToSection(slideText)

        let content = (title && !isNumericHeavy(title)) ? `${title}: ` : ''
        content += bullets.slice(0, 3).join('. ')
        content = stripLeadingConjunctions(content.trim())
        if (content.length > 400) {
            content = truncateOnSentenceBoundary(content, 400)
        }

        const existing = sectionBuckets.get(sectionIdx) || []
        existing.push(content)
        sectionBuckets.set(sectionIdx, existing)
    }

    const detailed: SummarySection[] = []
    for (let i = 0; i < PEDAGOGICAL_SECTIONS.length; i++) {
        const contents = sectionBuckets.get(i)
        if (!contents || contents.length === 0) continue

        let merged = contents.join(' ')
        if (merged.length > 600) {
            merged = truncateOnSentenceBoundary(merged, 600)
        }

        detailed.push({
            title: PEDAGOGICAL_SECTIONS[i].title,
            icon: PEDAGOGICAL_SECTIONS[i].icon,
            content: merged,
        })
    }

    // If we ended up with fewer than 2 sections, create fallback sections
    if (detailed.length < 2) {
        detailed.length = 0
        const contentSlides = slides.filter(s => (s.bullets || []).length > 0)
        if (contentSlides.length >= 2) {
            const first = contentSlides[0]
            const rest = contentSlides.slice(1)
            detailed.push({
                title: 'Introduction',
                icon: 'play',
                content: stripArrowsAndArticles(
                    [first.title, ...(first.bullets || []).slice(0, 2)].filter(Boolean).join('. ')
                ),
            })
            const coreContent = rest.slice(0, 3)
                .map(s => [s.title, ...(s.bullets || []).slice(0, 2)].filter(Boolean).join('. '))
                .join(' ')
            detailed.push({
                title: 'Core Concepts',
                icon: 'sparkles',
                content: stripArrowsAndArticles(
                    truncateOnSentenceBoundary(coreContent, 500)
                ),
            })
        }
    }

    // Bullets: one per slide with substantive content
    const bullets: SummaryBullet[] = []
    for (const slide of slides) {
        if (bullets.length >= 10) break
        if (isMetaSlide(slide)) continue
        const title = stripArrowsAndArticles(slide.title || '')
        const usableBullets = (slide.bullets || [])
            .map(b => stripArrowsAndArticles(b))
            .filter(b => b.length > 5 && !isNumericHeavy(b) && !isCodeLikeContent(b))
        const firstBullet = usableBullets[0] || ''
        if (!firstBullet) continue
        if (isNumericHeavy(title)) continue

        const bulletText = title ? `${title}: ${firstBullet}` : firstBullet
        const label = detectBulletLabel(bulletText)
        bullets.push({ label, text: stripLeadingConjunctions(bulletText) })
    }

    return {
        summary: short,
        structured: { short, detailed, bullets },
    }
}

function estimatePageFromPosition(text: string, sentence: string): number[] {
    const CHARS_PER_PAGE = 3000
    const pos = text.indexOf(sentence.substring(0, 60))
    if (pos < 0) return []
    const page = Math.floor(pos / CHARS_PER_PAGE) + 1
    return [page]
}

function buildConceptsFromClusters(
    sentencePool: string[],
    clusters: SentenceCluster[],
    _nounPhrases: NounPhrase[],
    _keywordPool: string[],
    fullText: string = ''
): Concept[] {
    const concepts: Concept[] = []

    for (const cluster of clusters) {
        if (concepts.length >= 12) break

        const label = cleanConceptLabel(cluster.label)
        if (!label) continue

        const clusterSentences = cluster.sentence_indices
            .map(i => sentencePool[i])
            .filter(Boolean)
        const representative = sentencePool[cluster.representative_index] || clusterSentences[0]
        if (!representative) continue

        let description = representative
        if (clusterSentences.length >= 2) {
            const second = clusterSentences.find(s => s !== representative)
            if (second) description = representative + '. ' + second
        }
        description = stripLeadingConjunctions(description)
        if (description.length > 300) {
            description = truncateOnSentenceBoundary(description, 300)
        }

        const labelLower = label.toLowerCase()
        const tags = filterConceptTags(cluster.key_terms, labelLower)

        const clusterSize = cluster.sentence_indices.length
        const avgRank = cluster.sentence_indices.reduce((s, i) => s + i, 0) / Math.max(1, clusterSize)
        const sizeScore = Math.min(3, clusterSize)
        const rankScore = Math.max(0, 5 - Math.floor(avgRank / 3))
        const importance = Math.min(10, Math.max(1, Math.round(sizeScore + rankScore + 2)))

        const difficulty = estimateDifficulty(description)
        const category = detectCategory(label, tags)

        const sourcePages = fullText
            ? estimatePageFromPosition(fullText, representative)
            : undefined

        concepts.push({
            name: label,
            description,
            category,
            importance,
            difficulty_level: difficulty,
            keywords: tags,
            ...(sourcePages && sourcePages.length > 0 ? { source_pages: sourcePages } : {}),
        })
    }

    return concepts
}

function buildPureNlpResult(
    text: string,
    keywords: string[],
    importantSentences: string[],
    nounPhrases: NounPhrase[] = [],
    sentenceClusters: SentenceCluster[] = [],
    summarySentences: SummarySentence[] = [],
    documentType: string = 'prose',
    slides: SlideData[] = []
): GeminiResponse {
    // Slide-based path: use slide structure directly for best results
    if (documentType === 'slides' && slides.length >= 3) {
        console.log(`📊 Using slide-based concept extraction (${slides.length} slides)`)
        const slideConcepts = buildConceptsFromSlides(slides)
        const dedupedConcepts = deduplicateConcepts(slideConcepts)
        const { summary, structured } = buildStructuredSummaryFromSlides(slides)
        return { summary, structured_summary: structured, concepts: dedupedConcepts }
    }

    const cleanedText = stripNoisyInlineContent(text)
    const baseSentences = importantSentences.length > 0 ? importantSentences : splitSentences(cleanedText)

    const sentencePool: string[] = []
    const seenSentences = new Set<string>()
    for (const s of baseSentences) {
        const cleaned = stripNoisyInlineContent(s)
        if (!isStudyFriendlySentence(cleaned)) continue

        const key = normalizeForDedup(cleaned)
        if (!key || seenSentences.has(key)) continue
        seenSentences.add(key)
        sentencePool.push(cleaned)
        if (sentencePool.length >= 20) break
    }

    const keywordPool = filterKeywordsForStudy(
        keywords.length > 0 ? keywords : extractKeywordsFromText(cleanedText, 25)
    )

    // Cluster-based path: semantic clusters from NLP service
    if (sentenceClusters.length >= 3) {
        const clusterConcepts = buildConceptsFromClusters(sentencePool, sentenceClusters, nounPhrases, keywordPool, text)
        const dedupedConcepts = deduplicateConcepts(clusterConcepts)
        const { summary, structured } = buildStructuredSummaryFromClusters(
            sentencePool, sentenceClusters, summarySentences, sentencePool
        )
        return { summary, structured_summary: structured, concepts: dedupedConcepts }
    }

    // Fallback path: keyword-based concept building when no clusters available
    const summary = sentencePool.slice(0, 3).join(' ').trim() || cleanedText.substring(0, 300).trim()
    const concepts: Concept[] = []
    const conceptNames = new Set<string>()

    for (const phrase of keywordPool) {
        if (concepts.length >= 12) break

        const normalized = normalizeForDedup(phrase)
        if (!normalized) continue
        if (!phrase.includes(' ') && (STOPWORDS.has(normalized) || normalized.length <= 4)) continue

        const support = findBestSupportingSentence(phrase, sentencePool)
        if (!support) continue

        const name = toTitleCase(phrase)
        if (!name || conceptNames.has(name)) continue
        conceptNames.add(name)

        concepts.push({
            name,
            description: support.sentence,
            category: DEFAULT_CONCEPT_CATEGORY,
            importance: Math.max(1, 10 - support.index),
            difficulty_level: DEFAULT_DIFFICULTY,
            keywords: deriveKeywordsForSentence(support.sentence, keywordPool).slice(0, 3),
        })
    }

    if (concepts.length < 5) {
        for (let i = 0; i < Math.min(10, sentencePool.length); i++) {
            const sentence = sentencePool[i]
            const name = deriveConceptName(sentence, keywordPool)
            if (!name || conceptNames.has(name)) continue
            conceptNames.add(name)

            concepts.push({
                name,
                description: sentence,
                category: DEFAULT_CONCEPT_CATEGORY,
                importance: Math.max(1, 10 - i),
                difficulty_level: DEFAULT_DIFFICULTY,
                keywords: deriveKeywordsForSentence(sentence, keywordPool).slice(0, 3),
            })

            if (concepts.length >= 12) break
        }
    }

    const conceptMap = new Map<string, Concept>()
    for (const concept of concepts) {
        const existing = conceptMap.get(concept.name)
        if (!existing || concept.importance > existing.importance) {
            conceptMap.set(concept.name, concept)
        }
    }

    return {
        summary,
        concepts: Array.from(conceptMap.values()),
    }
}

async function clearDerivedData(
    supabase: ReturnType<typeof createClient>,
    documentId: string
): Promise<void> {
    const targets = ['document_embeddings', 'concepts', 'chunks']
    for (const table of targets) {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('document_id', documentId)

        if (error) {
            console.error(`⚠️ Failed to clear ${table} for document ${documentId}:`, error.message)
        }
    }
}

/**
 * Process a single (non-chunked) document
 * For documents that fit in one chunk
 */
async function processSingleDocument(text: string, apiKey: string): Promise<GeminiResponse> {
    const prompt = `You are an expert academic tutor analyzing an educational document. Extract key information for students.

DOCUMENT:
${text}

Analyze this document and provide:
1. A structured summary with three formats (short, detailed sections, and bullet points)
2. Key concepts that students should learn (5-15 concepts)

For the structured_summary:
- "short": A concise 2-3 sentence overview of the entire document
- "detailed": An array of 3-6 themed sections, each with a title (e.g., "Introduction", "Core Concepts", "Key Components", "Applications", "Challenges"), an icon name (one of: "play", "sparkles", "grid", "layers", "zap", "alert-triangle", "code", "network", "book-open"), and 2-4 sentences of content
- "bullets": An array of labeled bullet points. Each has a label (one of: "DEFINITION", "KEY CONCEPT", "PROCESS", "EXAMPLE", "CHALLENGE", "ADVANTAGE", "KEY DISTINCTION") and a text description

For each concept include:
- name: Short title (2-5 words)
- description: Clear explanation (1-2 sentences)
- category: Topic category
- importance: Score 1-10
- difficulty_level: "beginner", "intermediate", or "advanced"
- keywords: Array of 3-5 related terms

Respond with this exact JSON structure:
{
  "summary": "Short 2-3 sentence overview (same as structured_summary.short)",
  "structured_summary": {
    "short": "2-3 sentence overview...",
    "detailed": [
      { "title": "Introduction", "icon": "play", "content": "2-4 sentences about this section..." },
      { "title": "Core Concepts", "icon": "sparkles", "content": "..." }
    ],
    "bullets": [
      { "label": "DEFINITION", "text": "Term: Clear definition..." },
      { "label": "KEY CONCEPT", "text": "Important point about..." }
    ]
  },
  "concepts": [
    {
      "name": "Concept Name",
      "description": "What this concept means and why it matters.",
      "category": "Category Name",
      "importance": 8,
      "difficulty_level": "intermediate",
      "keywords": ["term1", "term2", "term3"]
    }
  ]
}

Rules:
- Return ONLY valid JSON, no markdown code blocks
- Focus on exam-relevant concepts
- Be specific - avoid vague or generic descriptions
- Generate 5-8 detailed sections and 6-10 bullet points
- Each bullet should start with the topic followed by a colon, then the explanation`

    const content = await callGemini(prompt, apiKey, 6000)
    return parseGeminiResponse(content)
}

/**
 * Process a document that spans multiple chunks
 * Processes each chunk separately, then combines results
 */
async function processChunkedDocument(chunks: string[], apiKey: string): Promise<GeminiResponse> {
    console.log(`🔄 Processing ${chunks.length} chunks separately...`)

    // Step 1: Process each chunk to extract key information
    interface ChunkResult {
        summary: string
        keyPoints: string[]
        concepts: Concept[]
    }

    const chunkResults: ChunkResult[] = []

    for (let i = 0; i < chunks.length; i++) {
        console.log(`  📝 Processing chunk ${i + 1}/${chunks.length}...`)
        const result = await processChunk(chunks[i], i + 1, chunks.length, apiKey)
        chunkResults.push(result)
    }

    // Step 2: Combine all chunk results into final summary
    console.log('🔗 Combining chunk results...')
    return await combineChunkResults(chunkResults, apiKey)
}

/**
 * Process a single chunk to extract key information
 */
async function processChunk(
    text: string,
    chunkNum: number,
    totalChunks: number,
    apiKey: string
): Promise<{ summary: string; keyPoints: string[]; concepts: Concept[] }> {
    const prompt = `You are analyzing part ${chunkNum} of ${totalChunks} of an educational document.

Extract key information from this section:

TEXT:
${text}

Respond with JSON only:
{
  "summary": "2-3 sentence summary of THIS section",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "concepts": [
    {
      "name": "Concept from this section",
      "description": "Brief explanation",
      "category": "Category",
      "importance": 7,
      "difficulty_level": "intermediate",
      "keywords": ["term1", "term2"]
    }
  ]
}

Rules:
- Return ONLY valid JSON, no markdown
- Focus on the main ideas in THIS section
- Extract 2-5 concepts per chunk
- Be concise but comprehensive`

    const content = await callGemini(prompt, apiKey, 2000)

    try {
        const parsed = JSON.parse(content)
        return {
            summary: parsed.summary || '',
            keyPoints: parsed.keyPoints || [],
            concepts: parsed.concepts || [],
        }
    } catch {
        console.warn(`  ⚠️ Chunk ${chunkNum} parse failed, using fallback`)
        return {
            summary: content.substring(0, 200),
            keyPoints: ['Content analyzed'],
            concepts: [],
        }
    }
}

/**
 * Combine results from all chunks into a final comprehensive summary
 */
async function combineChunkResults(
    chunkResults: Array<{ summary: string; keyPoints: string[]; concepts: Concept[] }>,
    apiKey: string
): Promise<GeminiResponse> {
    // Compile all chunk summaries, key points, and concepts
    const allSummaries = chunkResults.map((r, i) => `Section ${i + 1}: ${r.summary}`).join('\n\n')
    const allKeyPoints = chunkResults.flatMap(r => r.keyPoints)
    const allConcepts = chunkResults.flatMap(r => r.concepts)

    // Deduplicate concepts by name (keep the one with higher importance)
    const conceptMap = new Map<string, Concept>()
    for (const concept of allConcepts) {
        const existing = conceptMap.get(concept.name)
        if (!existing || concept.importance > existing.importance) {
            conceptMap.set(concept.name, concept)
        }
    }
    const uniqueConcepts = Array.from(conceptMap.values())

    const prompt = `You are an expert academic tutor creating study materials. You have analyzed a document in ${chunkResults.length} sections.

SECTION SUMMARIES:
${allSummaries}

ALL KEY POINTS:
${allKeyPoints.map(p => `- ${p}`).join('\n')}

CONCEPTS FOUND ACROSS SECTIONS:
${uniqueConcepts.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Create a comprehensive final analysis with a structured summary. Respond with this exact JSON:
{
  "summary": "Short 2-3 sentence overview of the whole document",
  "structured_summary": {
    "short": "Same 2-3 sentence overview",
    "detailed": [
      { "title": "Introduction", "icon": "play", "content": "2-4 sentences about the document's introduction and purpose..." },
      { "title": "Core Concepts", "icon": "sparkles", "content": "2-4 sentences about the main theoretical concepts..." },
      { "title": "Key Components", "icon": "grid", "content": "2-4 sentences about important components or architecture..." },
      { "title": "Applications", "icon": "layers", "content": "2-4 sentences about practical applications..." }
    ],
    "bullets": [
      { "label": "DEFINITION", "text": "Term: Clear definition..." },
      { "label": "KEY CONCEPT", "text": "Important concept explanation..." },
      { "label": "PROCESS", "text": "Step or methodology description..." },
      { "label": "EXAMPLE", "text": "Practical example..." },
      { "label": "CHALLENGE", "text": "Known challenge or limitation..." }
    ]
  },
  "concepts": [
    {
      "name": "Concept Name",
      "description": "Clear explanation",
      "category": "Category",
      "importance": 8,
      "difficulty_level": "intermediate",
      "keywords": ["term1", "term2", "term3"]
    }
  ]
}

Requirements:
- Create ONE unified summary that synthesizes all sections
- Generate 3-6 detailed sections and 5-10 labeled bullets
- Select the 8-15 MOST IMPORTANT concepts
- Remove duplicates and merge similar concepts
- Focus on exam-relevant material
- Return ONLY valid JSON, no markdown code blocks`

    const content = await callGemini(prompt, apiKey, 6000)
    return parseGeminiResponse(content)
}

/**
 * Parse Gemini JSON response, handling markdown code blocks
 */
function parseGeminiResponse(content: string): GeminiResponse {
    try {
        let jsonStr = content
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0]
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0]
        }

        const parsed = JSON.parse(jsonStr.trim())
        const result: GeminiResponse = {
            summary: parsed.summary || '',
            concepts: parsed.concepts || [],
        }

        if (parsed.structured_summary) {
            result.structured_summary = {
                short: parsed.structured_summary.short || parsed.summary || '',
                detailed: Array.isArray(parsed.structured_summary.detailed) ? parsed.structured_summary.detailed : [],
                bullets: Array.isArray(parsed.structured_summary.bullets) ? parsed.structured_summary.bullets : [],
            }
        }

        return result
    } catch {
        console.error('Failed to parse Gemini response:', content.substring(0, 200))
        return {
            summary: 'Document uploaded successfully. Summary generation encountered an issue.',
            concepts: [],
        }
    }
}

async function hasProcessedByColumn(
    supabase: ReturnType<typeof createClient>
): Promise<boolean> {
    if (processedByColumnCache !== null) {
        return processedByColumnCache
    }

    const { error } = await supabase
        .from('documents')
        .select('processed_by')
        .limit(1)

    if (error) {
        const message = error.message || ''
        if (message.toLowerCase().includes('processed_by') || message.toLowerCase().includes('column')) {
            console.log('ℹ️ processed_by column not found; skipping processor tracking')
        } else {
            console.log('⚠️ Unable to verify processed_by column:', message)
        }
        processedByColumnCache = false
        return false
    }

    processedByColumnCache = true
    return true
}

/**
 * Call Gemini API with retry logic and exponential backoff
 */
async function callGemini(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🤖 Gemini API call attempt ${attempt}/${MAX_RETRIES}...`)

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
                            responseMimeType: 'application/json', // Request JSON directly
                        },
                    }),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`Gemini API error (attempt ${attempt}):`, errorText)

                // Check if it's a retryable error
                const isRetryable = response.status === 503 || response.status === 429 || response.status === 500

                if (isRetryable && attempt < MAX_RETRIES) {
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                    console.log(`⏳ Retryable error (${response.status}), waiting ${delayMs}ms...`)
                    await new Promise(resolve => setTimeout(resolve, delayMs))
                    continue
                }

                // Throw user-friendly errors
                switch (response.status) {
                    case 503:
                        throw new Error('AI_BUSY:Our AI service is currently busy. Please wait a moment and try again.')
                    case 429:
                        throw new Error('AI_RATE_LIMIT:Too many requests. Please wait a few minutes before trying again.')
                    case 400:
                        throw new Error('AI_INVALID:The document could not be processed. It may contain unsupported content.')
                    case 401:
                    case 403:
                        throw new Error('AI_AUTH:There\'s a configuration issue with our AI service. Please contact support.')
                    default:
                        throw new Error(`AI_ERROR:AI service error (${response.status}). Please try again later.`)
                }
            }

            const data = await response.json()
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text

            if (!content) {
                const finishReason = data.candidates?.[0]?.finishReason
                if (finishReason === 'SAFETY') {
                    throw new Error('AI_SAFETY:The document was flagged by content safety filters. Please review the content.')
                }
                throw new Error('AI_EMPTY:The AI returned an empty response. Please try again.')
            }

            console.log(`✅ Gemini API call successful on attempt ${attempt}`)
            return content

        } catch (error) {
            // If it's already a user-friendly error, rethrow
            if ((error as Error).message.includes(':')) {
                throw error
            }

            // Network or other errors
            if (attempt < MAX_RETRIES) {
                const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1)
                console.log(`⏳ Network error, waiting ${delayMs}ms...`)
                await new Promise(resolve => setTimeout(resolve, delayMs))
                continue
            }

            throw new Error('AI_NETWORK:Unable to reach the AI service. Please check your connection and try again.')
        }
    }

    throw new Error('AI_ERROR:Failed to process after multiple attempts. Please try again later.')
}

/**
 * Generate embeddings for chunks and save to database
 */
interface ChunkRecord {
    id: string
    content: string
}

async function generateAndSaveEmbeddings(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    chunks: ChunkRecord[],
    apiKey: string
): Promise<void> {
    // Rate limits for gemini-embedding-001 free tier: 
    //   RPM = 100, TPM = 30,000, RPD = 1,000
    // With ~700-token chunks, batch of 3 = ~2,100 tokens per batch.
    // At 1.5s between batches => ~40 batches/min => ~120 RPM (close to limit)
    // so 3 concurrent + 1.5s delay is a safe balance.
    const batchSize = 3
    const batchDelayMs = 1500
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        console.log(`  🔢 Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`)

        const embeddingPromises = batch.map(async (chunk: ChunkRecord) => {
            try {
                const embedding = await generateEmbedding(chunk.content, apiKey)
                return {
                    document_id: documentId,
                    chunk_id: chunk.id,
                    embedding,
                    content_preview: chunk.content.substring(0, 100),
                }
            } catch (e) {
                console.error(`  ⚠️ Failed embedding for chunk ${chunk.id}:`, (e as Error).message)
                failCount++
                return null
            }
        })

        const embeddings = (await Promise.all(embeddingPromises)).filter(Boolean)

        if (embeddings.length > 0) {
            const { error } = await supabase
                .from('document_embeddings')
                .insert(embeddings)

            if (error) {
                console.error('  ⚠️ Failed to save embeddings:', error.message)
            } else {
                successCount += embeddings.length
            }
        }

        if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, batchDelayMs))
        }
    }

    console.log(`✅ Embeddings: ${successCount} saved, ${failCount} failed`)
}

/**
 * Generate embedding for a single text using Gemini
 * Using gemini-embedding-001 (free tier, default 3072 dims, requesting 768)
 * Max input: 2048 tokens (~8000 chars)
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const maxChars = 8000
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: truncatedText }] },
                outputDimensionality: 768,
            }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Embedding API error:', response.status, errorText)
        throw new Error(`Embedding error: ${response.status}`)
    }

    const data = await response.json()
    return data.embedding?.values || []
}
