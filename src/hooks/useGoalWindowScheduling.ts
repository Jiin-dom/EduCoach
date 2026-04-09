import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Document } from '@/hooks/useDocuments'
import { useDocuments, documentKeys } from '@/hooks/useDocuments'
import { learningKeys } from '@/hooks/useLearning'
import { adaptiveStudyKeys } from '@/hooks/useAdaptiveStudy'
import { quizKeys } from '@/hooks/useQuizzes'
import {
    scheduleDocumentGoalWindow,
    deactivateDocumentGoalWindowPlaceholders,
} from '@/services/goalWindowScheduling'

export function useScheduleDocumentGoalWindow() {
    const queryClient = useQueryClient()
    const { user, profile } = useAuth()

    return useMutation({
        mutationFn: async (input: { document: Pick<Document, 'id' | 'exam_date'>; examDate: string | null }) => {
            if (!user) throw new Error('Not authenticated')

            const examDate = input.examDate
            if (!examDate) return { updated: 0, createdPlaceholders: 0 }

            return scheduleDocumentGoalWindow({
                userId: user.id,
                documentId: input.document.id,
                examDate,
                availableStudyDays: profile?.available_study_days ?? null,
                dailyStudyMinutes: profile?.daily_study_minutes ?? 30,
            })
        },
        onSuccess: () => {
            // Learning-path calendar and topic lists depend on mastery due_date + priority_score.
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })
}

export function useDeactivateDocumentGoalWindowPlaceholders() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (input: { documentId: string }) => {
            if (!user) throw new Error('Not authenticated')
            return deactivateDocumentGoalWindowPlaceholders({
                userId: user.id,
                documentId: input.documentId,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })
}

export function useReplanLearningPath() {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const { data: documents = [] } = useDocuments()
    const [progress, setProgress] = useState({ done: 0, total: 0 })

    const mutation = useMutation({
        mutationFn: async (input: { availableStudyDays: string[]; dailyStudyMinutes: number }) => {
            if (!user) throw new Error('Not authenticated')

            const docsWithExamDate = documents.filter((document) => !!document.exam_date)
            const total = docsWithExamDate.length
            setProgress({ done: 0, total })

            if (total === 0) {
                return { total: 0, success: 0, failed: 0 }
            }

            let success = 0
            let failed = 0

            for (const document of docsWithExamDate) {
                try {
                    await scheduleDocumentGoalWindow({
                        userId: user.id,
                        documentId: document.id,
                        examDate: document.exam_date!,
                        availableStudyDays: input.availableStudyDays,
                        dailyStudyMinutes: input.dailyStudyMinutes,
                    })
                    success++
                } catch {
                    failed++
                } finally {
                    setProgress((current) => ({
                        total,
                        done: Math.min(current.done + 1, total),
                    }))
                }
            }

            return { total, success, failed }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            queryClient.invalidateQueries({ queryKey: documentKeys.all })
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })

    return {
        ...mutation,
        progress,
    }
}

