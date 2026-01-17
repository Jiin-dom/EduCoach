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
    created_at: string
    updated_at: string
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
                return []
            }

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) {
                throw new Error(error.message)
            }

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
 */
export function useProcessDocument() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (documentId: string) => {
            // Update status to processing
            await supabase
                .from('documents')
                .update({ status: 'processing' })
                .eq('id', documentId)

            // Call the Edge Function
            const { data, error } = await supabase.functions.invoke('process-document', {
                body: { documentId },
            })

            if (error) {
                // Revert status on error
                await supabase
                    .from('documents')
                    .update({ status: 'error', error_message: error.message })
                    .eq('id', documentId)
                throw new Error(error.message)
            }

            return data
        },
        onSuccess: () => {
            // Invalidate documents to refresh status
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
        },
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

