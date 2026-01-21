/**
 * Process Document Edge Function
 * 
 * This function processes uploaded documents:
 * 1. Downloads the file from Supabase Storage
 * 2. Extracts text content
 * 3. Chunks the text into segments
 * 4. Sends chunks to GEMINI to extract concepts
 * 5. Generates embeddings for semantic search
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

interface ProcessRequest {
    documentId: string
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
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!geminiApiKey) {
            throw new Error('CONFIG_ERROR:AI service is not configured. Please contact support.')
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
        console.log(`📝 Extracting text from ${document.file_type} file...`)
        let textContent: string
        let extractedKeywords: string[] = []
        let importantSentences: string[] = []

        if (nlpServiceUrl && (document.file_type === 'pdf' || document.file_type === 'docx')) {
            // Use NLP service for proper extraction
            const nlpResult = await extractWithNlpService(fileData, nlpServiceUrl, document.file_type)
            textContent = nlpResult.text
            extractedKeywords = nlpResult.keywords
            importantSentences = nlpResult.importantSentences
        } else if (document.file_type === 'pdf') {
            // Fallback: basic PDF extraction (may not work well)
            textContent = await extractTextFromPdfFallback(fileData)
        } else {
            // Plain text files
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

        // 5. Save chunks to database
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

        // 6. Process with GEMINI to extract concepts
        console.log('🤖 Analyzing document with AI...')
        const geminiStart = Date.now()

        // Use chunked processing for large documents, single pass for small ones
        const wasChunked = chunksToProcess.length > 1
        let geminiResult: GeminiResponse

        if (wasChunked) {
            console.log('🔄 Using chunked processing for large document...')
            geminiResult = await processChunkedDocument(chunksToProcess, geminiApiKey)
        } else {
            geminiResult = await processSingleDocument(textContent, geminiApiKey)
        }

        console.log(`⚡ AI analysis took: ${Date.now() - geminiStart}ms`)
        console.log(`🧠 Extracted ${geminiResult.concepts.length} concepts`)

        // 7. Save concepts to database
        if (geminiResult.concepts.length > 0) {
            console.log('💾 Saving concepts to database...')
            const conceptRecords = geminiResult.concepts.map((concept) => ({
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

        // 8. Generate embeddings for each chunk
        if (savedChunks && savedChunks.length > 0) {
            console.log('🔢 Generating embeddings for semantic search...')
            await generateAndSaveEmbeddings(
                supabase,
                documentId,
                savedChunks,
                geminiApiKey
            )
        }

        // 9. Update document with summary and concept count
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                status: 'ready',
                summary: geminiResult.summary,
                concept_count: geminiResult.concepts.length,
                error_message: null,
            })
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
                conceptCount: geminiResult.concepts.length,
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

        const response = await fetch(`${nlpServiceUrl}/process`, {
            method: 'POST',
            body: formData,
        })

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
        console.error('NLP service call failed:', (error as Error).message)
        throw new Error(`NLP_SERVICE_ERROR:Could not connect to text extraction service. Please try again.`)
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
