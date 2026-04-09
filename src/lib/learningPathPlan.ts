export type LearningPathMasterySource = "baseline" | "performance"

export interface LearningPathMasteryInput {
    id: string
    concept_id: string
    concept_name: string
    document_id: string | null
    document_title: string | null
    due_date: string
    total_attempts: number
    confidence: number
    priority_score: number
    display_mastery_level: "needs_review" | "developing" | "mastered"
    display_mastery_score: number
    mastery_score: number
    document_exam_date?: string | null
}

export interface LearningPathAdaptiveTaskInput {
    id: string
    type: "quiz" | "flashcards" | "review"
    status: "ready" | "needs_generation" | "generating"
    reason: "due_today" | "needs_review" | "developing"
    documentId: string
    documentTitle: string
    conceptIds: string[]
    conceptNames: string[]
    scheduledDate: string
    priorityScore: number
    count: number
    title: string
    description: string
    quizId?: string
}

export interface LearningPathDocumentInput {
    id: string
    title: string
    exam_date?: string | null
    deadline?: string | null
}

export interface LearningPathQuizInput {
    id: string
    title: string
    document_id: string
}

export interface PlannedReviewPlanItem {
    kind: "planned_review"
    id: string
    date: string
    source: LearningPathMasterySource
    conceptId: string
    conceptName: string
    documentId: string | null
    documentTitle: string | null
    priorityScore: number
    mastery: LearningPathMasteryInput
}

export interface AdaptiveTaskPlanItem {
    kind: "adaptive_task"
    id: string
    date: string
    priorityScore: number
    task: LearningPathAdaptiveTaskInput
}

export interface GoalMarkerPlanItem {
    kind: "goal_marker"
    id: string
    date: string
    markerType: "file_goal" | "quiz_deadline"
    documentId: string
    quizId?: string
    title: string
    documentTitle: string
}

export type LearningPathPlanItem =
    | PlannedReviewPlanItem
    | AdaptiveTaskPlanItem
    | GoalMarkerPlanItem

export interface LearningPathPlan {
    items: LearningPathPlanItem[]
    baselinePlannedReviews: PlannedReviewPlanItem[]
    performancePlannedReviews: PlannedReviewPlanItem[]
    adaptiveTasks: AdaptiveTaskPlanItem[]
    goalMarkers: GoalMarkerPlanItem[]
}

function toDateOnly(value: string | null | undefined): string | null {
    if (!value) return null
    return value.split("T")[0] ?? null
}

function kindOrder(item: LearningPathPlanItem) {
    switch (item.kind) {
        case "adaptive_task":
            return 0
        case "planned_review":
            return 1
        default:
            return 2
    }
}

function itemPriority(item: LearningPathPlanItem) {
    if (item.kind === "goal_marker") return 0
    return item.priorityScore
}

function comparePlanItems(a: LearningPathPlanItem, b: LearningPathPlanItem) {
    if (a.date !== b.date) return a.date.localeCompare(b.date)

    const kindDelta = kindOrder(a) - kindOrder(b)
    if (kindDelta !== 0) return kindDelta

    if (a.kind === "planned_review" && b.kind === "planned_review" && a.source !== b.source) {
        return a.source === "performance" ? -1 : 1
    }

    const priorityDelta = itemPriority(b) - itemPriority(a)
    if (priorityDelta !== 0) return priorityDelta

    return a.id.localeCompare(b.id)
}

export function buildLearningPathPlan(input: {
    masteryRows: LearningPathMasteryInput[]
    adaptiveTasks: LearningPathAdaptiveTaskInput[]
    documents: LearningPathDocumentInput[]
    quizzes: LearningPathQuizInput[]
}): LearningPathPlan {
    const plannedReviews = input.masteryRows.map<PlannedReviewPlanItem>((mastery) => ({
        kind: "planned_review",
        id: mastery.id,
        date: mastery.due_date,
        source: mastery.total_attempts > 0 ? "performance" : "baseline",
        conceptId: mastery.concept_id,
        conceptName: mastery.concept_name,
        documentId: mastery.document_id,
        documentTitle: mastery.document_title,
        priorityScore: Number(mastery.priority_score ?? 0),
        mastery,
    }))

    const adaptiveTaskItems = input.adaptiveTasks.map<AdaptiveTaskPlanItem>((task) => ({
        kind: "adaptive_task",
        id: task.id,
        date: task.scheduledDate,
        priorityScore: Number(task.priorityScore ?? 0),
        task,
    }))

    const docsById = new Map(input.documents.map((document) => [document.id, document]))
    const goalMarkers: GoalMarkerPlanItem[] = []

    for (const document of input.documents) {
        const examDate = toDateOnly(document.exam_date)
        if (examDate) {
            goalMarkers.push({
                kind: "goal_marker",
                id: `file-goal:${document.id}`,
                date: examDate,
                markerType: "file_goal",
                documentId: document.id,
                title: document.title,
                documentTitle: document.title,
            })
        }
    }

    for (const quiz of input.quizzes) {
        const parentDocument = docsById.get(quiz.document_id)
        const deadline = toDateOnly(parentDocument?.deadline)
        if (!parentDocument || !deadline) continue

        goalMarkers.push({
            kind: "goal_marker",
            id: `quiz-deadline:${quiz.id}`,
            date: deadline,
            markerType: "quiz_deadline",
            documentId: parentDocument.id,
            quizId: quiz.id,
            title: quiz.title,
            documentTitle: parentDocument.title,
        })
    }

    const baselinePlannedReviews = plannedReviews
        .filter((item) => item.source === "baseline")
        .sort(comparePlanItems)
    const performancePlannedReviews = plannedReviews
        .filter((item) => item.source === "performance")
        .sort(comparePlanItems)
    const sortedAdaptiveTasks = adaptiveTaskItems.sort(comparePlanItems)
    const sortedGoalMarkers = goalMarkers.sort(comparePlanItems)

    const items = [
        ...sortedAdaptiveTasks,
        ...baselinePlannedReviews,
        ...performancePlannedReviews,
        ...sortedGoalMarkers,
    ].sort(comparePlanItems)

    return {
        items,
        baselinePlannedReviews,
        performancePlannedReviews,
        adaptiveTasks: sortedAdaptiveTasks,
        goalMarkers: sortedGoalMarkers,
    }
}

export function getLearningPathItemsForDate(items: LearningPathPlanItem[], date: string) {
    return items.filter((item) => item.date === date).sort(comparePlanItems)
}
