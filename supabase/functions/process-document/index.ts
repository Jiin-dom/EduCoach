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
const CHUNK_SIZE = 1000       // Characters per chunk (~200 words) - optimized for quiz generation
const CHUNK_OVERLAP = 100     // Overlap between chunks
const MAX_CHUNKS = 20         // Maximum chunks to process (increased for more context)
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
}

interface GeminiResponse {
    summary: string
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
            throw new Error(`STORAGE_ERROR:Failed to download file. ${downloadError?.message || 'Please try uploading again.'}`)
        }

        // 3. Extract text based on file type
        console.log(`📝 Starting NLP extraction for ${document.file_type} file...`)
        let textContent: string
        let extractedKeywords: string[] = []
        let importantSentences: string[] = []

        if (nlpServiceUrl) {
            // Use NLP service for extraction + keywords + ranked sentences
            const nlpStartTime = Date.now()
            console.log('🧠 NLP service extraction started')
            const nlpResult = await extractWithNlpService(fileData, nlpServiceUrl, document.file_type)
            textContent = nlpResult.text
            extractedKeywords = nlpResult.keywords
            importantSentences = nlpResult.importantSentences
            console.log('✅ NLP service extraction finished', {
                durationMs: Date.now() - nlpStartTime,
                charCount: textContent.length,
                keywordCount: extractedKeywords.length,
                sentenceCount: importantSentences.length
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
            throw new Error(`DB_ERROR:Failed to save document chunks. ${chunkError.message}`)
        }

        // 7. Analyze document (Pure NLP default, Gemini optional)
        const derivedKeywords = extractedKeywords.length > 0
            ? extractedKeywords
            : extractKeywordsFromText(textContent, 15)
        const derivedImportantSentences = importantSentences.length > 0
            ? importantSentences
            : splitSentences(textContent).slice(0, 10)

        const pureNlpResult = buildPureNlpResult(textContent, derivedKeywords, derivedImportantSentences)

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

        // 8. Save concepts to database
        if (analysisResult.concepts.length > 0) {
            console.log('💾 Saving concepts to database...')
            const conceptRecords = analysisResult.concepts.map((concept) => ({
                document_id: documentId,
                name: concept.name,
                description: concept.description,
                category: concept.category,
                importance: concept.importance,
                difficulty_level: concept.difficulty_level,
                keywords: concept.keywords,
            }))

            const { error: conceptError } = await supabase
                .from('concepts')
                .insert(conceptRecords)

            if (conceptError) {
                console.error('⚠️ Failed to save concepts:', conceptError)
                // Don't throw - continue processing
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

        if (await hasProcessedByColumn(supabase)) {
            updatePayload.processed_by = processedBy
        }

        const { error: updateError } = await supabase
            .from('documents')
            .update(updatePayload)
            .eq('id', documentId)

        if (updateError) {
            throw new Error(`DB_ERROR:Failed to update document. ${updateError.message}`)
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
interface NlpExtractionResult {
    text: string
    keywords: string[]
    importantSentences: string[]
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
            throw new Error(`NLP_SERVICE_ERROR:Failed to extract text. Status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
            throw new Error(`NLP_SERVICE_ERROR:${result.error || 'Unknown error'}`)
        }

        console.log(`✅ NLP service extracted ${result.char_count} characters`)

        return {
            text: result.text,
            keywords: result.keywords || [],
            importantSentences: result.important_sentences || []
        }
    } catch (error) {
        const err = error as Error
        console.error('NLP service call failed:', err.message)

        if (err.name === 'AbortError') {
            throw new Error('NLP_SERVICE_TIMEOUT:Text extraction service timed out. Please try again.')
        }

        throw new Error('NLP_SERVICE_ERROR:Could not connect to text extraction service. Please try again.')
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

    throw new Error('PDF_ERROR:Could not extract text from PDF. Please ensure NLP service is running or upload a text file (.txt, .md) instead.')
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
        // Common mojibake from PDF extraction.
        .replace(/â€™/g, "'")
        .replace(/â€œ|â€�/g, '"')
        .replace(/â€“|â€”/g, '-')
        .replace(/â€¢/g, '-')
        .replace(/â€¦/g, '...')
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
        const phrase = stripNoisyInlineContent(raw || '')
        if (!phrase) continue

        const lower = phrase.toLowerCase()
        if (seen.has(lower)) continue
        if (lower.includes('http') || lower.includes('www')) continue
        if (slidePageNumberRe.test(lower) || lower === 'slide' || lower === 'page') continue
        if (phrase.length < 3) continue

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

function buildPureNlpResult(
    text: string,
    keywords: string[],
    importantSentences: string[]
): GeminiResponse {
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

    const summary = sentencePool.slice(0, 3).join(' ').trim() || cleanedText.substring(0, 300).trim()

    // Prefer NLP service keywords, but filter them. If they are weak, fall back to simple frequency keywords.
    const keywordPool = filterKeywordsForStudy(
        keywords.length > 0 ? keywords : extractKeywordsFromText(cleanedText, 25)
    )

    // Build concepts around keyphrases and attach a supporting sentence.
    const concepts: Concept[] = []
    const conceptNames = new Set<string>()

    for (const phrase of keywordPool) {
        if (concepts.length >= 12) break

        // Avoid overly-generic single-word concepts.
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

    // Fallback: if keyword-based concepting produced too few, fall back to sentence-based concepts.
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
1. A concise summary (3-4 sentences covering the main points)
2. Key concepts that students should learn (5-15 concepts)

For each concept include:
- name: Short title (2-5 words)
- description: Clear explanation (1-2 sentences)
- category: Topic category (e.g., "Data Structures", "Algorithms", "Programming Fundamentals")
- importance: Score 1-10 (10 = essential, must know; 1 = supplementary)
- difficulty_level: "beginner", "intermediate", or "advanced"
- keywords: Array of 3-5 related terms for studying

Respond with this exact JSON structure:
{
  "summary": "A comprehensive summary of the document...",
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
- Prioritize concepts by importance for studying`

    const content = await callGemini(prompt, apiKey, 4096)
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
${allKeyPoints.map(p => `• ${p}`).join('\n')}

CONCEPTS FOUND ACROSS SECTIONS:
${uniqueConcepts.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Now create a comprehensive final analysis. Respond with this exact JSON structure:
{
  "summary": "A unified summary (4-5 sentences) that ties all sections together and covers the main document themes",
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
- Select the 8-15 MOST IMPORTANT concepts from all sections
- Prioritize concepts with higher importance scores
- Remove duplicates and merge similar concepts
- Focus on exam-relevant material
- Return ONLY valid JSON, no markdown code blocks`

    const content = await callGemini(prompt, apiKey, 4096)
    return parseGeminiResponse(content)
}

/**
 * Parse Gemini JSON response, handling markdown code blocks
 */
function parseGeminiResponse(content: string): GeminiResponse {
    try {
        // Handle potential markdown code blocks in response
        let jsonStr = content
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0]
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0]
        }

        return JSON.parse(jsonStr.trim())
    } catch {
        console.error('⚠️ Failed to parse Gemini response:', content.substring(0, 200))
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
    const batchSize = 5
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

        // Small delay between batches to avoid rate limits
        if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }

    console.log(`✅ Embeddings: ${successCount} saved, ${failCount} failed`)
}

/**
 * Generate embedding for a single text using Gemini
 * Using text-embedding-004 (free tier, 768 dimensions)
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const maxChars = 8000
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: truncatedText }] },
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
