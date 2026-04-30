import { useMemo } from 'react'
import type { Attempt, Quiz } from '@/hooks/useQuizzes'
import type { AdaptiveStudyTask } from '@/hooks/useAdaptiveStudy'
import { localDateFromTimestamp, todayLocalDateString } from '@/lib/localDate'

export function shouldSuppressAdaptiveQuizTask(args: {
    taskType: AdaptiveStudyTask['type']
    taskDocumentId: string
    taskScheduledDate: string
    todayLocal: string
    completedAdaptiveDocumentIdsToday: Set<string>
}) {
    const { taskType, taskDocumentId, taskScheduledDate, todayLocal, completedAdaptiveDocumentIdsToday } = args
    if (taskType !== 'quiz') return false
    if (!completedAdaptiveDocumentIdsToday.has(taskDocumentId)) return false
    return taskScheduledDate === todayLocal
}

export function useAdaptiveQuizPolicies(params: {
    quizzes: Quiz[]
    attempts: Attempt[]
    adaptiveTasks: AdaptiveStudyTask[]
}) {
    const { quizzes, attempts, adaptiveTasks } = params

    return useMemo(() => {
        const todayLocal = todayLocalDateString()
        const completedQuizIds = new Set(
            attempts
                .filter((a) => !!a.completed_at)
                .map((a) => a.quiz_id),
        )

        const adaptiveLinkedQuizIds = new Set(
            adaptiveTasks
                .filter((task) => task.type === 'quiz' && !!task.quizId)
                .map((task) => task.quizId as string),
        )

        const ADAPTIVE_PREFIXES = ['Adaptive:', 'Baseline:', 'Review:', 'Review Quiz:']
        const isAdaptiveQuiz = (quiz: Quiz) =>
            adaptiveLinkedQuizIds.has(quiz.id) || ADAPTIVE_PREFIXES.some((p) => quiz.title.startsWith(p))

        const completedAdaptiveQuizIdsToday = new Set(
            attempts
                .filter((a) => localDateFromTimestamp(a.completed_at) === todayLocal)
                .map((a) => a.quiz_id)
                .filter((quizId) => {
                    const quiz = quizzes.find((q) => q.id === quizId)
                    return quiz ? isAdaptiveQuiz(quiz) : false
                }),
        )

        const completedAdaptiveDocumentIdsToday = new Set(
            quizzes
                .filter((quiz) => completedAdaptiveQuizIdsToday.has(quiz.id))
                .map((quiz) => quiz.document_id),
        )

        const reusableReadyQuizIdByDocument = new Map<string, string>()
        for (const quiz of quizzes) {
            if (quiz.status !== 'ready') continue
            if (completedQuizIds.has(quiz.id)) continue
            if (!reusableReadyQuizIdByDocument.has(quiz.document_id)) {
                reusableReadyQuizIdByDocument.set(quiz.document_id, quiz.id)
            }
        }

        const hasReusableReadyQuizForDocument = (documentId: string) =>
            reusableReadyQuizIdByDocument.has(documentId)

        return {
            todayLocal,
            completedAdaptiveDocumentIdsToday,
            reusableReadyQuizIdByDocument,
            hasReusableReadyQuizForDocument,
        }
    }, [adaptiveTasks, attempts, quizzes])
}

