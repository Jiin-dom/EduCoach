/**
 * useQuizzes Hook
 *
 * React Query hooks for managing quizzes, questions, and attempts.
 * Follows the same patterns as useDocuments.ts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, ensureFreshSession } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { adaptiveStudyKeys } from '@/hooks/useAdaptiveStudy'
import { ALL_QUIZ_TYPES, type QuizTypeId } from '@/types/quiz'
import { buildLatestQuizIdByDocument, getEffectiveQuizDeadline } from '@/lib/quizDeadlines'

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
    deadline?: string | null
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
    question_context: string | null
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
    questionTypes?: QuizTypeId[]
    questionTypeTargets?: Partial<Record<QuizTypeId, number>>
    enhanceWithLlm?: boolean
    deadline?: string
}

export interface GenerateReviewQuizInput {
    documentId: string
    focusConceptIds: string[]
    questionCount?: number
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

type QuizSummaryRow = Pick<Quiz, 'id' | 'document_id' | 'deadline' | 'created_at'>

async function syncDocumentQuizDeadlineSummary(params: {
    userId: string
    documentId: string
    quizDeadlineLabel?: string | null
}) {
    const { data: documentQuizzes, error: quizFetchError } = await supabase
        .from('quizzes')
        .select('id, document_id, deadline, created_at')
        .eq('user_id', params.userId)
        .eq('document_id', params.documentId)

    if (quizFetchError) {
        throw new Error(quizFetchError.message)
    }

    const quizRows = (documentQuizzes || []) as QuizSummaryRow[]
    const latestQuizIdByDocument = buildLatestQuizIdByDocument(quizRows)
    const latestExplicitQuiz = quizRows
        .filter((quiz) => !!quiz.deadline)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null

    const documentDeadline = latestExplicitQuiz
        ? getEffectiveQuizDeadline({
            quiz: latestExplicitQuiz,
            latestQuizIdByDocument,
            documentDeadline: latestExplicitQuiz.deadline,
        })
        : null

    const updates: {
        deadline: string | null
        quiz_deadline_label?: string | null
    } = {
        deadline: documentDeadline,
    }

    if (typeof params.quizDeadlineLabel !== 'undefined') {
        updates.quiz_deadline_label = params.quizDeadlineLabel
    }

    const { error: documentError } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', params.documentId)
        .eq('user_id', params.userId)

    if (documentError) {
        throw new Error(documentError.message)
    }
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

    const query = useQuery({
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
        refetchInterval: (query) => {
            const quiz = query.state.data as Quiz | null | undefined
            return quiz?.status === 'generating' ? 4000 : false
        },
    })

    return query
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

            // Guard: check if a quiz is already generating for this document
            const { data: existing } = await supabase
                .from('quizzes')
                .select('id, status')
                .eq('document_id', input.documentId)
                .eq('status', 'generating')
                .limit(1)
                .maybeSingle()

            if (existing) {
                console.log('[Quiz] Quiz already generating, reusing:', existing.id)
                return { success: true, quizId: existing.id, questionCount: 0 }
            }

            try {
                const { data, error } = await supabase.functions.invoke('generate-quiz', {
                    body: {
                        documentId: input.documentId,
                        questionCount: input.questionCount ?? 10,
                        difficulty: input.difficulty ?? 'mixed',
                        questionTypes: input.questionTypes && input.questionTypes.length > 0
                            ? input.questionTypes
                            : ALL_QUIZ_TYPES,
                        questionTypeTargets: input.questionTypeTargets ?? undefined,
                        enhanceWithLlm: input.enhanceWithLlm ?? true,
                        userId: session.user.id,
                    },
                })

                if (error) {
                    console.error('[Quiz] Generation failed:', error.message)
                    throw new Error(error.message)
                }

                console.log('[Quiz] Generation successful:', data)
                const result = data as { success: boolean; quizId: string; questionCount: number }

                if (input.deadline && result.quizId) {
                    const { error: deadlineError } = await supabase
                        .from('quizzes')
                        .update({ deadline: input.deadline })
                        .eq('id', result.quizId)
                        .eq('user_id', session.user.id)

                    if (deadlineError) {
                        throw new Error(deadlineError.message)
                    }

                    await syncDocumentQuizDeadlineSummary({
                        userId: session.user.id,
                        documentId: input.documentId,
                    })
                }

                return result
            } catch (err) {
                // Recovery: if the fetch failed (timeout, network), the edge function
                // may have already created the quiz record before the client gave up.
                // Check the DB and recover instead of showing an error.
                console.warn('[Quiz] Edge function call failed, checking for server-side quiz...', (err as Error).message)

                const { data: recoveredQuiz } = await supabase
                    .from('quizzes')
                    .select('id, status')
                    .eq('document_id', input.documentId)
                    .in('status', ['generating', 'ready'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (recoveredQuiz) {
                    console.log('[Quiz] Recovered quiz from DB:', recoveredQuiz.id, recoveredQuiz.status)
                    return { success: true, quizId: recoveredQuiz.id, questionCount: 0 }
                }

                throw err
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
            queryClient.invalidateQueries({ queryKey: ['documents'] })
        },
        onError: (error) => {
            console.error('[Quiz] Generation mutation error:', error)
        },
    })
}

export function useUpdateQuizDeadline() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (input: {
            quizId: string
            documentId: string
            deadline: string | null
            quizDeadlineLabel?: string | null
        }) => {
            if (!user) {
                throw new Error('Not authenticated')
            }

            const { data, error } = await supabase
                .from('quizzes')
                .update({ deadline: input.deadline })
                .eq('id', input.quizId)
                .eq('user_id', user.id)
                .select('*')
                .single()

            if (error) {
                throw new Error(error.message)
            }

            await syncDocumentQuizDeadlineSummary({
                userId: user.id,
                documentId: input.documentId,
                quizDeadlineLabel: input.quizDeadlineLabel,
            })

            return data as Quiz
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            queryClient.invalidateQueries({ queryKey: ['documents'] })
        },
    })
}

/**
 * Generate a targeted review quiz focusing on specific weak/due concepts.
 * Used by the Learning Path "Start Review" button.
 */
export function useGenerateReviewQuiz() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: GenerateReviewQuizInput) => {
            console.log('[Quiz] Starting review quiz generation...', input)

            const session = await ensureFreshSession()
            if (!session) {
                throw new Error('Your session has expired — please log in again')
            }

            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                    documentId: input.documentId,
                    questionCount: input.questionCount ?? 10,
                    difficulty: 'mixed',
                    questionTypes: ['multiple_choice', 'identification', 'true_false', 'fill_in_blank'],
                    enhanceWithLlm: true,
                    userId: session.user.id,
                    focusConceptIds: input.focusConceptIds,
                },
            })

            if (error) {
                console.error('[Quiz] Review quiz generation failed:', error.message)
                throw new Error(error.message)
            }

            console.log('[Quiz] Review quiz generation successful:', data)
            return data as { success: boolean; quizId: string; questionCount: number }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
        },
        onError: (error) => {
            console.error('[Quiz] Review quiz generation error:', error)
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

export function useUpdateQuiz() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ quizId, updates }: { quizId: string; updates: Partial<Quiz> }) => {
            const { data, error } = await supabase
                .from('quizzes')
                .update(updates)
                .eq('id', quizId)
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data as Quiz
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
            queryClient.invalidateQueries({ queryKey: quizKeys.detail(data.id) })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
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
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
        },
    })
}
