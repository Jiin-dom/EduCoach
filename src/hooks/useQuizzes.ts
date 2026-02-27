/**
 * useQuizzes Hook
 *
 * React Query hooks for managing quizzes, questions, and attempts.
 * Follows the same patterns as useDocuments.ts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, ensureFreshSession } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Quiz {
    id: string
    user_id: string
    document_id: string
    title: string
    description: string | null
    question_count: number
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
    time_limit_minutes: number | null
    status: 'generating' | 'ready' | 'error'
    error_message: string | null
    created_at: string
    updated_at: string
}

export interface QuizQuestion {
    id: string
    quiz_id: string
    concept_id: string | null
    source_chunk_id: string | null
    question_type: 'multiple_choice' | 'identification' | 'true_false' | 'fill_in_blank'
    question_text: string
    options: string[] | null
    correct_answer: string
    explanation: string | null
    difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
    order_index: number
    created_at: string
}

export interface Attempt {
    id: string
    user_id: string
    quiz_id: string
    score: number | null
    total_questions: number
    correct_answers: number
    answers: AttemptAnswer[]
    time_taken_seconds: number | null
    started_at: string
    completed_at: string | null
    created_at: string
}

export interface AttemptAnswer {
    question_id: string
    user_answer: string
    is_correct: boolean
}

export interface GenerateQuizInput {
    documentId: string
    questionCount?: number
    difficulty?: string
    questionTypes?: string[]
    enhanceWithLlm?: boolean
}

export interface SubmitAttemptInput {
    quizId: string
    answers: AttemptAnswer[]
    totalQuestions: number
    correctAnswers: number
    score: number
    timeTakenSeconds?: number
    startedAt: string
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const quizKeys = {
    all: ['quizzes'] as const,
    lists: () => [...quizKeys.all, 'list'] as const,
    listByDocument: (docId: string) => [...quizKeys.lists(), { docId }] as const,
    details: () => [...quizKeys.all, 'detail'] as const,
    detail: (id: string) => [...quizKeys.details(), id] as const,
    questions: (quizId: string) => [...quizKeys.all, 'questions', quizId] as const,
    attempts: (quizId: string) => [...quizKeys.all, 'attempts', quizId] as const,
    userAttempts: () => [...quizKeys.all, 'user-attempts'] as const,
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useQuizzes() {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.lists(),
        queryFn: async ({ signal }): Promise<Quiz[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as Quiz[]
        },
        enabled: !!user,
    })
}

export function useQuiz(quizId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.detail(quizId ?? ''),
        queryFn: async ({ signal }): Promise<Quiz | null> => {
            if (!quizId || !user) return null

            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .eq('user_id', user.id)
                .abortSignal(signal)
                .single()

            if (error) {
                if (error.code === 'PGRST116') return null
                throw new Error(error.message)
            }
            return data as Quiz
        },
        enabled: !!quizId && !!user,
    })
}

export function useQuizQuestions(quizId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.questions(quizId ?? ''),
        queryFn: async ({ signal }): Promise<QuizQuestion[]> => {
            if (!quizId || !user) return []

            const { data, error } = await supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('order_index', { ascending: true })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as QuizQuestion[]
        },
        enabled: !!quizId && !!user,
    })
}

export function useQuizzesByDocument(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.listByDocument(documentId ?? ''),
        queryFn: async ({ signal }): Promise<Quiz[]> => {
            if (!documentId || !user) return []

            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .eq('document_id', documentId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as Quiz[]
        },
        enabled: !!documentId && !!user,
    })
}

export function useQuizAttempts(quizId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.attempts(quizId ?? ''),
        queryFn: async ({ signal }): Promise<Attempt[]> => {
            if (!quizId || !user) return []

            const { data, error } = await supabase
                .from('attempts')
                .select('*')
                .eq('quiz_id', quizId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as Attempt[]
        },
        enabled: !!quizId && !!user,
    })
}

export function useUserAttempts() {
    const { user } = useAuth()

    return useQuery({
        queryKey: quizKeys.userAttempts(),
        queryFn: async ({ signal }): Promise<Attempt[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('attempts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as Attempt[]
        },
        enabled: !!user,
    })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useGenerateQuiz() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: GenerateQuizInput) => {
            console.log('[Quiz] Starting quiz generation...', input)

            const session = await ensureFreshSession()
            if (!session) {
                throw new Error('Your session has expired — please log in again')
            }

            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                    documentId: input.documentId,
                    questionCount: input.questionCount ?? 10,
                    difficulty: input.difficulty ?? 'mixed',
                    questionTypes: input.questionTypes ?? ['multiple_choice', 'identification', 'true_false', 'fill_in_blank'],
                    enhanceWithLlm: input.enhanceWithLlm ?? true,
                },
            })

            if (error) {
                console.error('[Quiz] Generation failed:', error.message)
                throw new Error(error.message)
            }

            console.log('[Quiz] Generation successful:', data)
            return data as { success: boolean; quizId: string; questionCount: number }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
        onError: (error) => {
            console.error('[Quiz] Generation mutation error:', error)
        },
    })
}

export function useSubmitAttempt() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (input: SubmitAttemptInput) => {
            if (!user) throw new Error('Not authenticated')

            console.log('[Quiz] Submitting attempt...', {
                quizId: input.quizId,
                score: input.score,
                total: input.totalQuestions,
            })

            const { data, error } = await supabase
                .from('attempts')
                .insert({
                    user_id: user.id,
                    quiz_id: input.quizId,
                    score: input.score,
                    total_questions: input.totalQuestions,
                    correct_answers: input.correctAnswers,
                    answers: input.answers,
                    time_taken_seconds: input.timeTakenSeconds || null,
                    started_at: input.startedAt,
                    completed_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data as Attempt
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: quizKeys.attempts(variables.quizId) })
            queryClient.invalidateQueries({ queryKey: quizKeys.userAttempts() })
        },
    })
}

export function useDeleteQuiz() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (quizId: string) => {
            const { error } = await supabase
                .from('quizzes')
                .delete()
                .eq('id', quizId)

            if (error) throw new Error(error.message)
            return quizId
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })
}
