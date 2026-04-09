import { useMemo } from "react"

import { useAdaptiveStudyTasks } from "@/hooks/useAdaptiveStudy"
import { useDocuments } from "@/hooks/useDocuments"
import { useConceptMasteryList } from "@/hooks/useLearning"
import { useQuizzes } from "@/hooks/useQuizzes"
import { buildLearningPathPlan } from "@/lib/learningPathPlan"

export function useLearningPathPlan() {
    const masteryQuery = useConceptMasteryList()
    const adaptiveTasksQuery = useAdaptiveStudyTasks()
    const documentsQuery = useDocuments()
    const quizzesQuery = useQuizzes()

    const plan = useMemo(
        () =>
            buildLearningPathPlan({
                masteryRows: masteryQuery.data || [],
                adaptiveTasks: adaptiveTasksQuery.data || [],
                documents: documentsQuery.data || [],
                quizzes: quizzesQuery.data || [],
            }),
        [adaptiveTasksQuery.data, documentsQuery.data, masteryQuery.data, quizzesQuery.data],
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
