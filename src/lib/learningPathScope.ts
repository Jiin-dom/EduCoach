import type { Document } from "@/hooks/useDocuments"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import type { Quiz } from "@/hooks/useQuizzes"
import type { GoalType, StudyGoal } from "@/types/studyGoals"
import type { LearningPathPlan, LearningPathPlanItem } from "@/lib/learningPathPlan"

export interface LearningPathPlanScopeFilter {
    documentId?: string
    conceptId?: string
    quizId?: string
}

export type LearningPathViewScope =
    | { kind: "document"; id: string }
    | { kind: "study_goal"; id: string }

export interface ResolvedLearningPathScope {
    kind: "document" | "study_goal"
    id: string
    title: string
    subtitle: string
    documentId: string | null
    documentTitle: string | null
    conceptId: string | null
    quizId: string | null
    goalType?: GoalType
}

function formatDateLabel(value: string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

function cleanGoalLabel(value: string | null | undefined) {
    const cleaned = value?.replace(/^Goal Name:\s*/i, "").trim()
    return cleaned ? cleaned : null
}

export function formatStudyGoalType(goalType: GoalType) {
    switch (goalType) {
        case "overall_mastery":
            return "Overall Mastery"
        case "topic_mastery":
            return "Topic Mastery"
        case "quiz_count":
            return "Quiz Practice"
        default:
            return "Study Goal"
    }
}

function getItemDocumentId(item: LearningPathPlanItem) {
    return item.kind === "adaptive_task" ? item.task.documentId : item.documentId
}

export function resolveStudyGoalDocumentId(
    goal: StudyGoal,
    quizzes: Pick<Quiz, "id" | "document_id">[],
    masteryRows: Pick<ConceptMasteryWithDetails, "concept_id" | "document_id">[],
) {
    if (goal.document_id) return goal.document_id

    if (goal.quiz_id) {
        const quizDocumentId = quizzes.find((quiz) => quiz.id === goal.quiz_id)?.document_id
        if (quizDocumentId) return quizDocumentId
    }

    if (goal.concept_id) {
        const masteryDocumentId = masteryRows.find((row) => row.concept_id === goal.concept_id)?.document_id
        if (masteryDocumentId) return masteryDocumentId
    }

    return null
}

export function resolveLearningPathScope(input: {
    scope: LearningPathViewScope
    documents: Document[]
    studyGoals: StudyGoal[]
    quizzes: Pick<Quiz, "id" | "document_id">[]
    masteryRows: Pick<ConceptMasteryWithDetails, "concept_id" | "document_id" | "document_title">[]
}): ResolvedLearningPathScope | null {
    const { scope, documents, studyGoals, quizzes, masteryRows } = input

    if (scope.kind === "document") {
        const document = documents.find((item) => item.id === scope.id)
        if (!document) return null

        const targetLabel = formatDateLabel(document.exam_date) ?? formatDateLabel(document.deadline)
        const subtitle = cleanGoalLabel(document.goal_label)
            ?? (targetLabel ? `Target ${targetLabel}` : "File-based learning path")

        return {
            kind: "document",
            id: document.id,
            title: document.title,
            subtitle,
            documentId: document.id,
            documentTitle: document.title,
            conceptId: null,
            quizId: null,
        }
    }

    const goal = studyGoals.find((item) => item.id === scope.id)
    if (!goal) return null

    const documentId = resolveStudyGoalDocumentId(goal, quizzes, masteryRows)
    const document =
        documents.find((item) => item.id === documentId)
        ?? (documentId
            ? {
                id: documentId,
                title:
                    masteryRows.find((row) => row.document_id === documentId)?.document_title
                    ?? "Untitled document",
            }
            : null)
    const deadlineLabel = formatDateLabel(goal.deadline)
    const subtitleParts = [
        formatStudyGoalType(goal.goal_type),
        document?.title ?? null,
        deadlineLabel ? `Due ${deadlineLabel}` : null,
    ].filter(Boolean)

    return {
        kind: "study_goal",
        id: goal.id,
        title: goal.title,
        subtitle: subtitleParts.join(" · ") || "Study-goal learning path",
        documentId: document?.id ?? null,
        documentTitle: document?.title ?? null,
        conceptId: goal.concept_id ?? null,
        quizId: goal.quiz_id ?? null,
        goalType: goal.goal_type,
    }
}

export function getLearningPathScopeFilter(scope: ResolvedLearningPathScope | null | undefined): LearningPathPlanScopeFilter | undefined {
    if (!scope) return undefined

    const filter: LearningPathPlanScopeFilter = {}

    if (scope.documentId) filter.documentId = scope.documentId
    if (scope.kind === "study_goal" && scope.goalType === "topic_mastery" && scope.conceptId) {
        filter.conceptId = scope.conceptId
    }
    if (scope.kind === "study_goal" && scope.goalType === "quiz_count" && scope.quizId) {
        filter.quizId = scope.quizId
    }

    return Object.keys(filter).length > 0 ? filter : undefined
}

export function matchesLearningPathScopeFilter(item: LearningPathPlanItem, filter?: LearningPathPlanScopeFilter) {
    if (!filter) return true

    const itemDocumentId = getItemDocumentId(item)
    if (filter.documentId && itemDocumentId !== filter.documentId) {
        return false
    }

    if (filter.conceptId) {
        if (item.kind === "planned_review") return item.conceptId === filter.conceptId
        if (item.kind === "adaptive_task") return item.task.conceptIds.includes(filter.conceptId)
        return false
    }

    if (filter.quizId) {
        if (item.kind === "goal_marker" && item.quizId) return item.quizId === filter.quizId
        return true
    }

    return true
}

export function filterLearningPathPlan(plan: LearningPathPlan, filter?: LearningPathPlanScopeFilter): LearningPathPlan {
    if (!filter) return plan

    return {
        items: plan.items.filter((item) => matchesLearningPathScopeFilter(item, filter)),
        baselinePlannedReviews: plan.baselinePlannedReviews.filter((item) => matchesLearningPathScopeFilter(item, filter)),
        performancePlannedReviews: plan.performancePlannedReviews.filter((item) => matchesLearningPathScopeFilter(item, filter)),
        adaptiveTasks: plan.adaptiveTasks.filter((item) => matchesLearningPathScopeFilter(item, filter)),
        goalMarkers: plan.goalMarkers.filter((item) => matchesLearningPathScopeFilter(item, filter)),
    }
}

export function matchesMasteryScope(
    row: Pick<ConceptMasteryWithDetails, "document_id" | "concept_id">,
    filter?: LearningPathPlanScopeFilter,
) {
    if (!filter) return true
    if (filter.documentId && row.document_id !== filter.documentId) return false
    if (filter.conceptId && row.concept_id !== filter.conceptId) return false
    return true
}

export function matchesQuizScope(
    quiz: Pick<Quiz, "id" | "document_id">,
    filter?: LearningPathPlanScopeFilter,
) {
    if (!filter) return true
    if (filter.quizId) return quiz.id === filter.quizId
    if (filter.documentId) return quiz.document_id === filter.documentId
    return true
}
