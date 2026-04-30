import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { adaptiveStudyKeys } from '@/hooks/useAdaptiveStudy'
import { learningKeys } from '@/hooks/useLearning'

export interface Flashcard {
    id: string
    document_id: string
    concept_id: string | null
    user_id: string
    front: string
    back: string
    difficulty_level: string
    source_page: number | null
    repetition: number
    interval_days: number
    ease_factor: number
    due_date: string | null
    last_reviewed_at: string | null
    created_at: string
}

export const flashcardKeys = {
    all: ['flashcards'] as const,
    byDocument: (documentId: string) => [...flashcardKeys.all, 'document', documentId] as const,
    filtered: (documentId?: string) => [...flashcardKeys.all, 'filtered', documentId ?? 'all'] as const,
    due: () => [...flashcardKeys.all, 'due'] as const,
}

export function useDocumentFlashcards(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: flashcardKeys.byDocument(documentId ?? ''),
        queryFn: async (): Promise<Flashcard[]> => {
            if (!documentId || !user) return []

            const { data, error } = await supabase
                .from('flashcards')
                .select('*')
                .eq('document_id', documentId)
                .eq('user_id', user.id)
                .order('created_at')

            if (error) throw new Error(error.message)
            return data as Flashcard[]
        },
        enabled: !!documentId && !!user,
    })
}

export function useDueFlashcards() {
    const { user } = useAuth()

    return useQuery({
        queryKey: flashcardKeys.due(),
        queryFn: async (): Promise<Flashcard[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('flashcards')
                .select('*')
                .eq('user_id', user.id)
                .lte('due_date', new Date().toISOString())
                .order('due_date')

            if (error) throw new Error(error.message)
            return data as Flashcard[]
        },
        enabled: !!user,
    })
}

export function useAllFlashcards(documentId?: string) {
    const { user } = useAuth()

    return useQuery({
        queryKey: flashcardKeys.filtered(documentId),
        queryFn: async (): Promise<Flashcard[]> => {
            if (!user) return []

            let query = supabase
                .from('flashcards')
                .select('*')
                .eq('user_id', user.id)
                .order('due_date')

            if (documentId) {
                query = query.eq('document_id', documentId)
            }

            const { data, error } = await query

            if (error) throw new Error(error.message)
            return data as Flashcard[]
        },
        enabled: !!user,
    })
}

export function useGenerateFlashcards() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (documentId: string) => {
            if (!user) {
                throw new Error('You must be logged in to generate flashcards.')
            }

            const { data, error } = await supabase.functions.invoke('process-document', {
                body: { documentId },
            })

            if (error) {
                throw new Error(error.message ?? 'Failed to generate flashcards.')
            }

            return data
        },
        onSuccess: (_data, documentId) => {
            queryClient.invalidateQueries({ queryKey: flashcardKeys.all })
            if (documentId) {
                queryClient.invalidateQueries({ queryKey: flashcardKeys.byDocument(documentId) })
            }
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
        },
    })
}

type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

function computeSM2(card: Flashcard, rating: ReviewRating) {
    const qualityMap: Record<ReviewRating, number> = { again: 0, hard: 2, good: 4, easy: 5 }
    const q = qualityMap[rating]

    let { repetition, ease_factor, interval_days } = card

    if (q < 3) {
        repetition = 0
        interval_days = 1
    } else {
        if (repetition === 0) {
            interval_days = 1
        } else if (repetition === 1) {
            interval_days = 6
        } else {
            interval_days = Math.round(interval_days * ease_factor)
        }
        repetition += 1
    }

    ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

    const due_date = new Date()
    due_date.setDate(due_date.getDate() + Math.ceil(interval_days))

    return {
        repetition,
        interval_days,
        ease_factor: Math.round(ease_factor * 100) / 100,
        due_date: due_date.toISOString(),
        last_reviewed_at: new Date().toISOString(),
    }
}

export function useReviewFlashcard() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            card,
            rating,
        }: {
            card: Flashcard
            rating: ReviewRating
        }) => {
            const updates = computeSM2(card, rating)

            const { error } = await supabase
                .from('flashcards')
                .update(updates)
                .eq('id', card.id)

            if (error) throw new Error(error.message)

            return { ...card, ...updates }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: flashcardKeys.all })
        },
    })
}
