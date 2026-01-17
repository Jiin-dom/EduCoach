/**
 * useConcepts Hook
 * 
 * React Query hook for managing concepts data.
 * Provides queries for fetching concepts from documents.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Concept type matching database schema
export interface Concept {
    id: string
    document_id: string
    chunk_id: string | null
    name: string
    description: string | null
    category: string | null
    importance: number
    related_concepts: string[]
    difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
    keywords: string[]
    created_at: string
    updated_at: string
}

// Query keys for cache management
export const conceptKeys = {
    all: ['concepts'] as const,
    lists: () => [...conceptKeys.all, 'list'] as const,
    listByDocument: (documentId: string) => [...conceptKeys.lists(), { documentId }] as const,
    details: () => [...conceptKeys.all, 'detail'] as const,
    detail: (id: string) => [...conceptKeys.details(), id] as const,
}

/**
 * Hook to fetch all concepts for a specific document
 */
export function useDocumentConcepts(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: conceptKeys.listByDocument(documentId ?? ''),
        queryFn: async (): Promise<Concept[]> => {
            if (!documentId || !user) {
                return []
            }

            const { data, error } = await supabase
                .from('concepts')
                .select('*')
                .eq('document_id', documentId)
                .order('importance', { ascending: false })

            if (error) {
                throw new Error(error.message)
            }

            return data as Concept[]
        },
        enabled: !!documentId && !!user,
    })
}

/**
 * Hook to fetch all concepts for the current user across all documents
 */
export function useAllConcepts() {
    const { user } = useAuth()

    return useQuery({
        queryKey: conceptKeys.lists(),
        queryFn: async (): Promise<Concept[]> => {
            if (!user) {
                return []
            }

            // First get user's document IDs
            const { data: documents, error: docError } = await supabase
                .from('documents')
                .select('id')
                .eq('user_id', user.id)

            if (docError) {
                throw new Error(docError.message)
            }

            if (!documents || documents.length === 0) {
                return []
            }

            const documentIds = documents.map((d) => d.id)

            // Then get concepts for those documents
            const { data, error } = await supabase
                .from('concepts')
                .select('*')
                .in('document_id', documentIds)
                .order('importance', { ascending: false })

            if (error) {
                throw new Error(error.message)
            }

            return data as Concept[]
        },
        enabled: !!user,
    })
}

/**
 * Hook to get a single concept by ID
 */
export function useConcept(conceptId: string | undefined) {
    return useQuery({
        queryKey: conceptKeys.detail(conceptId ?? ''),
        queryFn: async (): Promise<Concept | null> => {
            if (!conceptId) {
                return null
            }

            const { data, error } = await supabase
                .from('concepts')
                .select('*')
                .eq('id', conceptId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                throw new Error(error.message)
            }

            return data as Concept
        },
        enabled: !!conceptId,
    })
}

/**
 * Hook to get concepts grouped by category for a document
 */
export function useConceptsByCategory(documentId: string | undefined) {
    const { data: concepts, ...rest } = useDocumentConcepts(documentId)

    const groupedConcepts = concepts?.reduce((acc, concept) => {
        const category = concept.category || 'Uncategorized'
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(concept)
        return acc
    }, {} as Record<string, Concept[]>)

    return {
        data: groupedConcepts,
        concepts,
        ...rest,
    }
}

/**
 * Get difficulty badge color
 */
export function getDifficultyColor(difficulty: string | null): string {
    switch (difficulty) {
        case 'beginner':
            return 'text-green-600 bg-green-50 border-green-200'
        case 'intermediate':
            return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        case 'advanced':
            return 'text-red-600 bg-red-50 border-red-200'
        default:
            return 'text-gray-600 bg-gray-50 border-gray-200'
    }
}

/**
 * Get importance color for visual indication
 */
export function getImportanceColor(importance: number): string {
    if (importance >= 8) return 'bg-primary'
    if (importance >= 5) return 'bg-primary/70'
    return 'bg-primary/40'
}

