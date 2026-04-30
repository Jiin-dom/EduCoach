import { supabase, ensureFreshSession } from '@/lib/supabase'
import type { Quiz } from '@/hooks/useQuizzes'

const ADAPTIVE_QUIZ_TITLE_PREFIXES = ['Adaptive:', 'Baseline:', 'Review:', 'Review Quiz:']

export interface AdaptiveReviewQuizSyncResult {
    status: 'generated' | 'reused' | 'skipped'
    quizId?: string
}

type MasterySelectionRow = {
    concept_id: string | null
    mastery_level: 'needs_review' | 'developing' | 'mastered'
    due_date: string
    priority_score: number
    last_attempt_at: string | null
}

function buildReviewQuestionCount(conceptCount: number) {
    return Math.max(10, Math.min(20, conceptCount * 2))
}

function pickFocusConceptIds(rows: MasterySelectionRow[]): string[] {
    const today = new Date().toISOString().split('T')[0]

    const actionable = rows.filter((row) => !!row.concept_id)
    const urgent = actionable
        .filter((row) =>
            row.due_date <= today ||
            row.mastery_level === 'needs_review' ||
            row.mastery_level === 'developing',
        )

    const urgentIds = new Set(urgent.map((row) => row.concept_id as string))
    const reinforcement = actionable.filter((row) =>
        !urgentIds.has(row.concept_id as string) &&
        row.due_date > today &&
        (row.mastery_level === 'developing' || row.mastery_level === 'mastered'),
    )

    const selected = [...urgent, ...reinforcement]
    return selected.map((row) => row.concept_id as string)
}

export async function ensureAdaptiveReviewQuizForDocument(params: {
    userId: string
    documentId: string
}): Promise<AdaptiveReviewQuizSyncResult> {
    const { userId, documentId } = params

    const { data: masteryRows, error: masteryError } = await supabase
        .from('user_concept_mastery')
        .select('concept_id, mastery_level, due_date, priority_score, last_attempt_at')
        .eq('user_id', userId)
        .eq('document_id', documentId)
        .order('priority_score', { ascending: false })

    if (masteryError) {
        throw new Error(masteryError.message)
    }

    const focusConceptIds = pickFocusConceptIds((masteryRows || []) as MasterySelectionRow[])
    const reviewable = (masteryRows || []).filter((row) => row.concept_id && focusConceptIds.includes(row.concept_id))

    if (reviewable.length === 0) {
        return { status: 'skipped' }
    }

    const latestConceptAttemptAt = reviewable
        .map((row) => row.last_attempt_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null

    const { data: reviewQuizzes, error: reviewQuizError } = await supabase
        .from('quizzes')
        .select('id, title, status, created_at, updated_at')
        .eq('user_id', userId)
        .eq('document_id', documentId)
        .or(ADAPTIVE_QUIZ_TITLE_PREFIXES.map((p) => `title.ilike.${p}%`).join(','))
        .in('status', ['generating', 'ready'])
        .order('created_at', { ascending: false })

    if (reviewQuizError) {
        throw new Error(reviewQuizError.message)
    }

    const quizzes = (reviewQuizzes || []) as Pick<Quiz, 'id' | 'title' | 'status' | 'created_at' | 'updated_at'>[]
    const generatingQuiz = quizzes.find((quiz) => quiz.status === 'generating')
    if (generatingQuiz) {
        return { status: 'reused', quizId: generatingQuiz.id }
    }

    const freshestReadyQuiz = quizzes.find((quiz) => {
        if (quiz.status !== 'ready') return false
        if (!latestConceptAttemptAt) return true
        return quiz.created_at >= latestConceptAttemptAt
    })

    if (freshestReadyQuiz) {
        return { status: 'reused', quizId: freshestReadyQuiz.id }
    }

    const session = await ensureFreshSession()
    if (!session) {
        return { status: 'skipped' }
    }

    const questionCount = buildReviewQuestionCount(focusConceptIds.length)
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
            documentId,
            questionCount,
            difficulty: 'mixed',
            questionTypes: ['multiple_choice', 'identification', 'true_false', 'fill_in_blank'],
            enhanceWithLlm: true,
            userId: session.user.id,
            focusConceptIds,
        },
    })

    if (error) {
        throw new Error(error.message)
    }

    const quizId = (data as { quizId?: string } | null)?.quizId
    return quizId
        ? { status: 'generated', quizId }
        : { status: 'skipped' }
}
