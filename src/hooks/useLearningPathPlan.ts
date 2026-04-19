import { useMemo } from "react"

import { useAdaptiveStudyTasks } from "@/hooks/useAdaptiveStudy"
import { useDocuments } from "@/hooks/useDocuments"
import { useConceptMasteryList } from "@/hooks/useLearning"
import { useQuizzes } from "@/hooks/useQuizzes"
import { buildLearningPathPlan } from "@/lib/learningPathPlan"
import { filterLearningPathPlan, type LearningPathPlanScopeFilter } from "@/lib/learningPathScope"

export function useLearningPathPlan(scopeFilter?: LearningPathPlanScopeFilter) {
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
            })

            return filterLearningPathPlan(fullPlan, scopeFilter)
        },
        [adaptiveTasksQuery.data, documentsQuery.data, masteryQuery.data, quizzesQuery.data, scopeFilter],
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
