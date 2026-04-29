import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "./quizDeadlines"

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
    goal_label?: string | null
    quiz_deadline_label?: string | null
}

export interface LearningPathQuizInput {
    id: string
    title: string
    document_id: string
    deadline?: string | null
    created_at?: string | null
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
    scheduledTime: string | null
    mastery: LearningPathMasteryInput
}

export interface AdaptiveTaskPlanItem {
    kind: "adaptive_task"
    id: string
    date: string
    priorityScore: number
    scheduledTime: string | null
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

    const timeA = a.kind === "goal_marker" ? null : a.scheduledTime
    const timeB = b.kind === "goal_marker" ? null : b.scheduledTime
    if (timeA && timeB && timeA !== timeB) {
        return timeA.localeCompare(timeB)
    }
    if (timeA && !timeB) return -1
    if (!timeA && timeB) return 1

    const kindDelta = kindOrder(a) - kindOrder(b)
    if (kindDelta !== 0) return kindDelta

    if (a.kind === "planned_review" && b.kind === "planned_review" && a.source !== b.source) {
        return a.source === "performance" ? -1 : 1
    }

    const priorityDelta = itemPriority(b) - itemPriority(a)
    if (priorityDelta !== 0) return priorityDelta

    return a.id.localeCompare(b.id)
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
    if (!value) return null
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
    return (hours * 60) + minutes
}

function toTimeLabel(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min((23 * 60) + 59, totalMinutes))
    const hours = Math.floor(clamped / 60)
    const minutes = clamped % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function assignScheduledTimes(params: {
    plannedReviews: PlannedReviewPlanItem[]
    adaptiveTasks: AdaptiveTaskPlanItem[]
    dailyStudyMinutes: number
    preferredStudyTimeStart?: string | null
    preferredStudyTimeEnd?: string | null
}) {
    const {
        plannedReviews,
        adaptiveTasks,
        dailyStudyMinutes,
        preferredStudyTimeStart,
        preferredStudyTimeEnd,
    } = params
    const startMinutes = parseTimeToMinutes(preferredStudyTimeStart)
    const endMinutes = parseTimeToMinutes(preferredStudyTimeEnd)
    const hasValidWindow = startMinutes != null && endMinutes != null && endMinutes > startMinutes
    const dailyMinutes = Math.max(15, Number.isFinite(dailyStudyMinutes) ? dailyStudyMinutes : 30)
    const anchorStart = hasValidWindow ? startMinutes! : (18 * 60)
    const preferredWindowDuration = hasValidWindow ? (endMinutes! - startMinutes!) : dailyMinutes
    // Prefer fitting inside the selected window, but if it's too tight keep minutes feasibility.
    const placementSpanMinutes = Math.max(preferredWindowDuration, dailyMinutes)

    const allSchedulable = [...adaptiveTasks, ...plannedReviews].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        const priorityDelta = Number(b.priorityScore) - Number(a.priorityScore)
        if (priorityDelta !== 0) return priorityDelta
        return a.id.localeCompare(b.id)
    })

    const byDate = new Map<string, Array<PlannedReviewPlanItem | AdaptiveTaskPlanItem>>()
    for (const item of allSchedulable) {
        const list = byDate.get(item.date) || []
        list.push(item)
        byDate.set(item.date, list)
    }

    for (const dayItems of byDate.values()) {
        const count = dayItems.length
        if (count === 0) continue
        const stepMinutes = Math.max(15, Math.floor(placementSpanMinutes / count))
        for (let i = 0; i < dayItems.length; i++) {
            dayItems[i].scheduledTime = toTimeLabel(anchorStart + (i * stepMinutes))
        }
    }
}

export function buildLearningPathPlan(input: {
    masteryRows: LearningPathMasteryInput[]
    adaptiveTasks: LearningPathAdaptiveTaskInput[]
    documents: LearningPathDocumentInput[]
    quizzes: LearningPathQuizInput[]
    dailyStudyMinutes?: number
    preferredStudyTimeStart?: string | null
    preferredStudyTimeEnd?: string | null
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
        scheduledTime: null,
        mastery,
    }))

    const adaptiveTaskItems = input.adaptiveTasks.map<AdaptiveTaskPlanItem>((task) => ({
        kind: "adaptive_task",
        id: task.id,
        date: task.scheduledDate,
        priorityScore: Number(task.priorityScore ?? 0),
        scheduledTime: null,
        task,
    }))

    assignScheduledTimes({
        plannedReviews,
        adaptiveTasks: adaptiveTaskItems,
        dailyStudyMinutes: Number(input.dailyStudyMinutes ?? 30),
        preferredStudyTimeStart: input.preferredStudyTimeStart ?? null,
        preferredStudyTimeEnd: input.preferredStudyTimeEnd ?? null,
    })

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
                title: document.goal_label || document.title,
                documentTitle: document.title,
            })
        }
    }

    const latestQuizIdByDocument = buildLatestQuizIdByDocument(input.quizzes)
    const documentsWithExplicitQuizDeadlines = buildDocumentsWithExplicitQuizDeadlines(input.quizzes)

    for (const quiz of input.quizzes) {
        const parentDocument = docsById.get(quiz.document_id)
        const deadline = toDateOnly(
            getEffectiveQuizDeadline({
                quiz,
                latestQuizIdByDocument,
                documentDeadline: parentDocument?.deadline,
                documentsWithExplicitQuizDeadlines,
            }),
        )
        if (!parentDocument || !deadline) continue

        goalMarkers.push({
            kind: "goal_marker",
            id: `quiz-deadline:${quiz.id}`,
            date: deadline,
            markerType: "quiz_deadline",
            documentId: parentDocument.id,
            quizId: quiz.id,
            title: parentDocument.quiz_deadline_label || quiz.title,
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
