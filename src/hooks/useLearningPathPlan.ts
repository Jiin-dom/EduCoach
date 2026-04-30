import { useMemo } from "react"

import { useAdaptiveStudyTasks } from "@/hooks/useAdaptiveStudy"
import { useAuth } from "@/contexts/AuthContext"
import { useDocuments } from "@/hooks/useDocuments"
import { useConceptMasteryList } from "@/hooks/useLearning"
import { useQuizzes } from "@/hooks/useQuizzes"
import { buildLearningPathPlan } from "@/lib/learningPathPlan"
import { filterLearningPathPlan, type LearningPathPlanScopeFilter } from "@/lib/learningPathScope"

export function useLearningPathPlan(scopeFilter?: LearningPathPlanScopeFilter) {
    const { profile } = useAuth()
    const masteryQuery = useConceptMasteryList()
    const adaptiveTasksQuery = useAdaptiveStudyTasks()
    const documentsQuery = useDocuments()
    const quizzesQuery = useQuizzes()

    const plan = useMemo(
        () => {
            const fullPlan = buildLearningPathPlan({
                masteryRows: masteryQuery.data || [],
                adaptiveTasks: adaptiveTasksQuery.data || [],
                documents: documentsQuery.data || [],
                quizzes: quizzesQuery.data || [],
                dailyStudyMinutes: profile?.daily_study_minutes ?? 30,
                preferredStudyTimeStart: profile?.preferred_study_time_start ?? null,
                preferredStudyTimeEnd: profile?.preferred_study_time_end ?? null,
                availableStudyDays: profile?.available_study_days ?? null,
            })

            return filterLearningPathPlan(fullPlan, scopeFilter)
        },
        [
            adaptiveTasksQuery.data,
            documentsQuery.data,
            masteryQuery.data,
            profile?.available_study_days,
            profile?.daily_study_minutes,
            profile?.preferred_study_time_end,
            profile?.preferred_study_time_start,
            quizzesQuery.data,
            scopeFilter,
        ],
    )

    return {
        ...plan,
        isLoading:
            masteryQuery.isLoading ||
            adaptiveTasksQuery.isLoading ||
            documentsQuery.isLoading ||
            quizzesQuery.isLoading,
        isError:
            masteryQuery.isError ||
            adaptiveTasksQuery.isError ||
            documentsQuery.isError ||
            quizzesQuery.isError,
    }
}
