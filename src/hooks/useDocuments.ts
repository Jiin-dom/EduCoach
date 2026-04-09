/**
 * useDocuments Hook
 * 
 * React Query hook for managing documents data.
 * Provides queries and mutations for CRUD operations on documents.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, ensureFreshSession } from '@/lib/supabase'
import { deleteFile } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { learningKeys } from '@/hooks/useLearning'
import { adaptiveStudyKeys } from '@/hooks/useAdaptiveStudy'
import { quizKeys } from '@/hooks/useQuizzes'

export interface SummarySection {
    title: string
    icon: string
    content: string
    pages?: number[]
}

export interface SummaryBullet {
    label: string
    text: string
    page?: number
}

export interface StructuredSummary {
    short: string
    detailed: SummarySection[]
    bullets: SummaryBullet[]
}

// Document type matching database schema
export interface Document {
    id: string
    user_id: string
    title: string
    goal_label?: string | null
    quiz_deadline_label?: string | null
    file_name: string
    file_path: string
    file_type: 'pdf' | 'docx' | 'txt' | 'md'
    file_size: number
    status: 'pending' | 'processing' | 'ready' | 'error'
    error_message: string | null
    summary: string | null
    structured_summary?: StructuredSummary | null
    concept_count: number
    processed_by?: 'pure_nlp' | 'gemini' | null
    processing_quality?: number | null
    deadline?: string | null
    exam_date?: string | null
    created_at: string
    updated_at: string
}

export type DocumentProcessor = 'pure_nlp' | 'gemini'

export type ProcessDocumentInput =
    | string
    | {
        documentId: string
        processor?: DocumentProcessor
    }

// Query keys for cache management
export const documentKeys = {
    all: ['documents'] as const,
    lists: () => [...documentKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...documentKeys.lists(), filters] as const,
    details: () => [...documentKeys.all, 'detail'] as const,
    detail: (id: string) => [...documentKeys.details(), id] as const,
}

/**
 * Hook to fetch all documents for the current user
 */
const PROCESSING_POLL_MS = 5000

export function useDocuments() {
    const { user } = useAuth()

    const query = useQuery({
        queryKey: documentKeys.lists(),
        queryFn: async ({ signal }): Promise<Document[]> => {
            if (!user) {
                console.log('[Documents] ⚠️ No user logged in, skipping document fetch')
                return []
            }

            console.log('[Documents] 📚 Fetching documents for user:', user.id)
            const fetchStartTime = performance.now()

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            const fetchDuration = (performance.now() - fetchStartTime).toFixed(2)

            if (error) {
                console.error('[Documents] ❌ Fetch failed:', {
                    error: error.message,
                    duration: `${fetchDuration}ms`
                })
                throw new Error(error.message)
            }

            console.log('[Documents] ✅ Fetch successful:', {
                count: data.length,
                duration: `${fetchDuration}ms`,
                documents: data.map(d => ({
                    id: d.id,
                    title: d.title,
                    status: d.status,
                    created_at: d.created_at
                }))
            })

            return data as Document[]
        },
        enabled: !!user,
        // Auto-poll while any document is still processing so the UI
        // picks up the final status without a manual page refresh.
        refetchInterval: (query) => {
            const docs = query.state.data
            if (docs?.some((d: Document) => d.status === 'processing')) {
                return PROCESSING_POLL_MS
            }
            return false
        },
    })

    return query
}

/**
 * Hook to fetch a single document by ID
 */
export function useDocument(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: documentKeys.detail(documentId ?? ''),
        queryFn: async ({ signal }): Promise<Document | null> => {
            if (!documentId || !user) {
                return null
            }

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('id', documentId)
                .eq('user_id', user.id)
                .abortSignal(signal)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                throw new Error(error.message)
            }

            return data as Document
        },
        enabled: !!documentId && !!user,
        refetchInterval: (query) => {
            const doc = query.state.data
            if (doc?.status === 'processing') {
                return PROCESSING_POLL_MS
            }
            return false
        },
    })
}

/**
 * Hook to delete a document (with storage cleanup)
 */
export function useDeleteDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (document: Document) => {
            // Delete the database row first so a relational conflict does not
            // orphan the UI record after the storage object has already been removed.
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', document.id)
                .eq('user_id', document.user_id)

            if (dbError) {
                throw new Error(dbError.message)
            }

            const { error: storageError } = await deleteFile(document.file_path)
            if (storageError) {
                console.error('Storage deletion failed after document row removal:', storageError)
            }

            return document.id
        },
        onSuccess: (deletedId) => {
            // Remove from cache
            queryClient.setQueryData<Document[]>(documentKeys.lists(), (old) =>
                old?.filter((doc) => doc.id !== deletedId)
            )

            // Invalidate to ensure fresh data
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
        },
    })
}

/**
 * Hook to update a document
 */
export function useUpdateDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            documentId,
            updates,
        }: {
            documentId: string
            updates: Partial<Pick<Document, 'title' | 'status' | 'exam_date' | 'deadline' | 'goal_label' | 'quiz_deadline_label'>>
        }) => {
            const { data, error } = await supabase
                .from('documents')
                .update(updates)
                .eq('id', documentId)
                .select()
                .single()

            if (error) {
                throw new Error(error.message)
            }

            return data as Document
        },
        onSuccess: (updatedDoc) => {
            // Update in cache
            queryClient.setQueryData<Document[]>(documentKeys.lists(), (old) =>
                old?.map((doc) => (doc.id === updatedDoc.id ? updatedDoc : doc))
            )

            // Update detail cache
            queryClient.setQueryData(documentKeys.detail(updatedDoc.id), updatedDoc)
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })
}

/**
 * Hook to trigger document processing
 * Calls the Edge Function to process a document
 * Optionally accepts a processor override (pure_nlp or gemini)
 */
export function useProcessDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: ProcessDocumentInput) => {
            const payload = typeof input === 'string' ? { documentId: input } : input
            const { documentId, processor } = payload
            console.log('[DocumentProcessing] Starting document processing...', {
                documentId,
                processor,
                timestamp: new Date().toISOString()
            })

            // Pre-flight: ensure we have a valid session BEFORE changing any
            // document state. This prevents the "stuck in processing" scenario
            // where the status update succeeds but the Edge Function 401s.
            const session = await ensureFreshSession()
            if (!session) {
                throw new Error('Your session has expired — please log in again')
            }

            console.log('[DocumentProcessing] Updating document status to "processing"...')
            const updateResult = await supabase
                .from('documents')
                .update({ status: 'processing' })
                .eq('id', documentId)

            if (updateResult.error) {
                console.error('[DocumentProcessing] ❌ Failed to update status:', updateResult.error)
            } else {
                console.log('[DocumentProcessing] ✅ Status updated to "processing"')
            }

            // Call the Edge Function
            console.log('[DocumentProcessing] 🌐 Invoking Edge Function "process-document"...')
            const edgeFunctionStartTime = performance.now()

            console.log('[DocumentProcessing] 🧠 NLP extraction started (server-side)')
            const { data, error } = await supabase.functions.invoke('process-document', {
                body: {
                    documentId,
                    ...(processor ? { processor } : {}),
                },
            })

            const edgeFunctionDuration = (performance.now() - edgeFunctionStartTime).toFixed(2)

            if (error) {
                console.error('[DocumentProcessing] ❌ Edge Function client error:', {
                    error: error.message,
                    duration: `${edgeFunctionDuration}ms`,
                    documentId
                })

                // The Edge Function may have returned a user-friendly error in
                // the response body, or it may have already updated the DB.
                // Extract the friendly message when available.
                const serverMessage = (data as Record<string, unknown>)?.error as string | undefined

                // Re-check the actual document status before overwriting.
                const { data: currentDoc } = await supabase
                    .from('documents')
                    .select('status, error_message')
                    .eq('id', documentId)
                    .single()

                const currentStatus = currentDoc?.status

                if (currentStatus === 'ready') {
                    console.log('[DocumentProcessing] ✅ Edge Function already completed (recovered from client timeout)')
                    return { success: true, message: 'Document processed successfully (recovered from timeout)' }
                }

                if (currentStatus === 'processing') {
                    console.log('[DocumentProcessing] ⏳ Edge Function still running, not overwriting status')
                    throw new Error(
                        'Processing is taking longer than expected. ' +
                        'The document will update automatically when ready.'
                    )
                }

                // If the Edge Function already saved a friendly error_message
                // to the DB, don't overwrite it with the generic SDK message.
                if (currentStatus === 'error' && currentDoc?.error_message) {
                    console.log('[DocumentProcessing] Edge Function already set error in DB, preserving it')
                    throw new Error(currentDoc.error_message)
                }

                // Edge Function didn't run — use the server response message
                // if available, otherwise fall back to a friendly default.
                const friendlyMsg = serverMessage
                    || 'Something went wrong while processing your document. Please try again.'

                console.log('[DocumentProcessing] 🔄 Setting document error status...')
                await supabase
                    .from('documents')
                    .update({ status: 'error', error_message: friendlyMsg })
                    .eq('id', documentId)

                throw new Error(friendlyMsg)
            }

            console.log('[DocumentProcessing] 🎉 Edge Function completed successfully!', {
                duration: `${edgeFunctionDuration}ms`,
                documentId,
                response: data
            })

            console.log('[DocumentProcessing] ✅ NLP extraction finished (response received)', {
                documentId,
                processingTimeMs: data?.processingTimeMs,
                conceptCount: data?.conceptCount
            })

            return data
        },
        onSuccess: (data, documentId) => {
            console.log('[DocumentProcessing] ✅ Processing mutation successful, refreshing cache...', {
                documentId,
                responseData: data
            })

            // Invalidate documents to refresh status
            queryClient.invalidateQueries({ queryKey: documentKeys.all })

            console.log('[DocumentProcessing] 🔄 Document cache invalidated')
        },
        onError: (error, documentId) => {
            console.error('[DocumentProcessing] 💥 Processing mutation failed:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                documentId
            })

            // Always refresh from DB so the UI shows the real status,
            // not the stale optimistic state from the mutation.
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
        }
    })
}

/**
 * Hook to get documents count by status
 */
export function useDocumentStats() {
    const { user } = useAuth()

    return useQuery({
        queryKey: [...documentKeys.all, 'stats'],
        queryFn: async () => {
            if (!user) {
                return { total: 0, pending: 0, processing: 0, ready: 0, error: 0 }
            }

            const { data, error } = await supabase
                .from('documents')
                .select('status')
                .eq('user_id', user.id)

            if (error) {
                throw new Error(error.message)
            }

            const stats = {
                total: data.length,
                pending: data.filter((d) => d.status === 'pending').length,
                processing: data.filter((d) => d.status === 'processing').length,
                ready: data.filter((d) => d.status === 'ready').length,
                error: data.filter((d) => d.status === 'error').length,
            }

            return stats
        },
        enabled: !!user,
    })
}

