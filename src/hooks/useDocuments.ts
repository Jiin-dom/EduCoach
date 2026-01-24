/**
 * useDocuments Hook
 * 
 * React Query hook for managing documents data.
 * Provides queries and mutations for CRUD operations on documents.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { deleteFile } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'

// Document type matching database schema
export interface Document {
    id: string
    user_id: string
    title: string
    file_name: string
    file_path: string
    file_type: 'pdf' | 'docx' | 'txt' | 'md'
    file_size: number
    status: 'pending' | 'processing' | 'ready' | 'error'
    error_message: string | null
    summary: string | null
    concept_count: number
    processed_by?: 'pure_nlp' | 'gemini' | null
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
export function useDocuments() {
    const { user } = useAuth()

    return useQuery({
        queryKey: documentKeys.lists(),
        queryFn: async (): Promise<Document[]> => {
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
        enabled: !!user, // Only run query when user is logged in
    })
}

/**
 * Hook to fetch a single document by ID
 */
export function useDocument(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: documentKeys.detail(documentId ?? ''),
        queryFn: async (): Promise<Document | null> => {
            if (!documentId || !user) {
                return null
            }

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('id', documentId)
                .eq('user_id', user.id) // Ensure user owns document
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    // No document found
                    return null
                }
                throw new Error(error.message)
            }

            return data as Document
        },
        enabled: !!documentId && !!user,
    })
}

/**
 * Hook to delete a document (with storage cleanup)
 */
export function useDeleteDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (document: Document) => {
            // 1. Delete from storage first
            const { error: storageError } = await deleteFile(document.file_path)
            if (storageError) {
                console.error('Storage deletion failed:', storageError)
                // Continue anyway - database entry should be removed
            }

            // 2. Delete from database
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', document.id)

            if (dbError) {
                throw new Error(dbError.message)
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
            updates: Partial<Pick<Document, 'title' | 'status'>>
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
            console.log('[DocumentProcessing] 🔄 Starting document processing...', {
                documentId,
                processor,
                timestamp: new Date().toISOString()
            })

            // Update status to processing
            console.log('[DocumentProcessing] 📝 Updating document status to "processing"...')
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
                console.error('[DocumentProcessing] ❌ Edge Function failed:', {
                    error: error.message,
                    duration: `${edgeFunctionDuration}ms`,
                    documentId
                })

                // Revert status on error
                console.log('[DocumentProcessing] 🔄 Reverting document status to "error"...')
                await supabase
                    .from('documents')
                    .update({ status: 'error', error_message: error.message })
                    .eq('id', documentId)

                throw new Error(error.message)
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

