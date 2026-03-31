import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Document } from '@/hooks/useDocuments'
import { learningKeys } from '@/hooks/useLearning'
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
        },
    })
}

