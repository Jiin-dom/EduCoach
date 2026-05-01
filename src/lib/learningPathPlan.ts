import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "./quizDeadlines"
import { todayLocalDateString } from "./localDate"

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
    last_reviewed_at?: string | null
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
    taskKey?: string
    clickable?: boolean
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

function wasReviewedOnDate(mastery: LearningPathMasteryInput, date: string): boolean {
    return toDateOnly(mastery.last_reviewed_at) === date
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
    availableStudyDays?: string[] | null
}): LearningPathPlan {
    const docsById = new Map(input.documents.map((document) => [document.id, document]))
    const todayStr = todayLocalDateString()

    const plannedReviews = input.masteryRows
        .filter((m) => {
            const doc = docsById.get(m.document_id || "")
            const docDeadline = toDateOnly(doc?.exam_date || doc?.deadline)
            if (docDeadline && m.due_date > docDeadline) return false
            if (m.due_date === todayStr && wasReviewedOnDate(m, todayStr)) return false
            return true
        })
        .map<PlannedReviewPlanItem>((mastery) => ({
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

    const horizonDays = 14
    const dailyStudyMinutes = Number(input.dailyStudyMinutes ?? 30)
    const maxTasksPerDay = Math.max(2, Math.round(dailyStudyMinutes / 30))
    const generatedAdaptiveTasks: AdaptiveTaskPlanItem[] = []
    const reviewedTodayConceptIds = new Set(
        input.masteryRows
            .filter((m) => wasReviewedOnDate(m, todayStr))
            .map((m) => m.concept_id),
    )

    const adaptiveTaskItems = input.adaptiveTasks
        .filter((task) => {
            if (task.scheduledDate !== todayStr) return true
            if (task.conceptIds.length !== 1) return true
            if (task.type !== "review") return true
            return !reviewedTodayConceptIds.has(task.conceptIds[0])
        })
        .map<AdaptiveTaskPlanItem>((task) => ({
            kind: "adaptive_task",
            id: task.id,
            date: task.scheduledDate,
            priorityScore: Number(task.priorityScore ?? 0),
            scheduledTime: null,
            task,
        }))

    const masteryByDoc = new Map<string, LearningPathMasteryInput[]>()
    for (const m of input.masteryRows) {
        if (!m.document_id) continue
        const list = masteryByDoc.get(m.document_id) || []
        list.push(m)
        masteryByDoc.set(m.document_id, list)
    }

    // Keep virtual plan generation stable: do not let manually-rescheduled/persisted
    // adaptive tasks rebalance unrelated generated tasks across days.
    const tasksPerDay = new Map<string, number>()
    const incrementDay = (date: string) => tasksPerDay.set(date, (tasksPerDay.get(date) || 0) + 1)

    const getDayOfWeek = (dateStr: string): string => {
        const d = new Date(dateStr + "T00:00:00Z")
        const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        return days[d.getUTCDay()]
    }

    const isStudyDay = (dateStr: string): boolean => {
        if (!input.availableStudyDays || input.availableStudyDays.length === 0) return true
        return input.availableStudyDays.includes(getDayOfWeek(dateStr))
    }

    const addDays = (dateStr: string, days: number): string => {
        const d = new Date(dateStr + "T00:00:00Z")
        d.setUTCDate(d.getUTCDate() + days)
        return d.toISOString().split("T")[0]
    }

    const addStudyDays = (dateStr: string, days: number): string => {
        let current = dateStr
        let remaining = days
        while (remaining > 0) {
            current = addDays(current, 1)
            if (isStudyDay(current)) {
                remaining--
            }
        }
        return current
    }

    const canSchedule = (date: string, docDeadline: string | null): boolean =>
        (tasksPerDay.get(date) || 0) < maxTasksPerDay && (!docDeadline || date <= docDeadline)

    for (const [docId, concepts] of masteryByDoc.entries()) {
        const sortedConcepts = [...concepts].sort((a, b) => b.priority_score - a.priority_score)
        const doc = docsById.get(docId)
        const docDeadline = toDateOnly(doc?.exam_date || doc?.deadline)

        for (const concept of sortedConcepts) {
            let startDay = concept.due_date < todayStr ? todayStr : concept.due_date
            while (!isStudyDay(startDay) && startDay < addDays(todayStr, 30)) {
                startDay = addDays(startDay, 1)
            }
            if (startDay === todayStr && wasReviewedOnDate(concept, todayStr)) {
                continue
            }

            if (concept.display_mastery_level === "needs_review") {
                const d1 = startDay
                const d2 = addStudyDays(startDay, 1)
                const d3 = addStudyDays(startDay, 2)

                if (canSchedule(d1, docDeadline)) {
                    generatedAdaptiveTasks.push(createVirtualTask(concept, "review", d1, "needs_review"))
                    incrementDay(d1)
                }
                if (canSchedule(d2, docDeadline)) {
                    generatedAdaptiveTasks.push(createVirtualTask(concept, "flashcards", d2, "needs_review"))
                    incrementDay(d2)
                }
                if (canSchedule(d3, docDeadline)) {
                    generatedAdaptiveTasks.push(createVirtualTask(concept, "quiz", d3, "needs_review"))
                    incrementDay(d3)
                }
            } else if (concept.display_mastery_level === "developing") {
                const d1 = startDay
                const d2 = addStudyDays(startDay, 3)

                if (canSchedule(d1, docDeadline)) {
                    generatedAdaptiveTasks.push(createVirtualTask(concept, "flashcards", d1, "developing"))
                    incrementDay(d1)
                }
                if (canSchedule(d2, docDeadline)) {
                    generatedAdaptiveTasks.push(createVirtualTask(concept, "quiz", d2, "developing"))
                    incrementDay(d2)
                }
            } else {
                const d1 = startDay
                if (canSchedule(d1, docDeadline)) {
                    const type = concept.total_attempts === 0 ? "review" : "quiz"
                    generatedAdaptiveTasks.push(createVirtualTask(concept, type, d1, "due_today"))
                    incrementDay(d1)
                }
            }
        }

        // Multi-concept quiz scheduling based on weakness count
        const weakConcepts = sortedConcepts.filter(
            (c) =>
                (c.display_mastery_level === "needs_review" || c.display_mastery_level === "developing") &&
                !wasReviewedOnDate(c, todayStr),
        )
        if (weakConcepts.length > 0) {
            const quizInterval = weakConcepts.length >= 5 ? 1 : weakConcepts.length >= 3 ? 2 : 3
            let quizDay = addStudyDays(todayStr, quizInterval)
            for (let q = 0; q < horizonDays && quizDay <= addDays(todayStr, horizonDays); q++) {
                if (canSchedule(quizDay, docDeadline)) {
                    generatedAdaptiveTasks.push(
                        createMultiConceptVirtualTask(weakConcepts, quizDay, doc?.title || "Untitled document"),
                    )
                    incrementDay(quizDay)
                }
                quizDay = addStudyDays(quizDay, quizInterval)
            }
        }
    }

    // Fill empty study days within the horizon
    for (let i = 0; i < horizonDays; i++) {
        const date = addDays(todayStr, i)
        if (isStudyDay(date) && (tasksPerDay.get(date) || 0) === 0) {
            const candidate = input.masteryRows
                .filter((m) => {
                    if (m.due_date > date) return false
                    if (date === todayStr && wasReviewedOnDate(m, todayStr)) return false
                    const doc = docsById.get(m.document_id || "")
                    const docDeadline = toDateOnly(doc?.exam_date || doc?.deadline)
                    if (docDeadline && date > docDeadline) return false
                    return true
                })
                .sort((a, b) => b.priority_score - a.priority_score)[0]

            if (candidate) {
                const type = (tasksPerDay.get(addDays(date, -1)) || 0) > 0 ? "flashcards" : "review"
                generatedAdaptiveTasks.push(createVirtualTask(candidate, type, date, "due_today"))
                incrementDay(date)
            }
        }
    }

    const crystallizedVirtualSourceIds = new Set(
        adaptiveTaskItems
            .map((item) => item.task.taskKey)
            .filter((key): key is string => !!key && key.startsWith("manual:virtual-"))
            .map((key) => key.slice("manual:".length)),
    )

    const filteredGeneratedAdaptiveTasks = generatedAdaptiveTasks.filter(
        (task) => !crystallizedVirtualSourceIds.has(task.task.id),
    )

    const allAdaptiveTasks = [...adaptiveTaskItems, ...filteredGeneratedAdaptiveTasks]

    const scheduledTaskConceptKeys = new Set(
        allAdaptiveTasks.map((t) => `${t.task.conceptIds[0]}-${t.date}`),
    )
    const filteredPlannedReviews = plannedReviews.filter(
        (pr) => !scheduledTaskConceptKeys.has(`${pr.conceptId}-${pr.date}`),
    )

    assignScheduledTimes({
        plannedReviews: filteredPlannedReviews,
        adaptiveTasks: allAdaptiveTasks,
        dailyStudyMinutes,
        preferredStudyTimeStart: input.preferredStudyTimeStart ?? null,
        preferredStudyTimeEnd: input.preferredStudyTimeEnd ?? null,
    })

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

    const baselinePlannedReviews = filteredPlannedReviews
        .filter((item) => item.source === "baseline")
        .sort(comparePlanItems)
    const performancePlannedReviews = filteredPlannedReviews
        .filter((item) => item.source === "performance")
        .sort(comparePlanItems)
    const sortedAdaptiveTasks = allAdaptiveTasks.sort(comparePlanItems)
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

function createVirtualTask(
    mastery: LearningPathMasteryInput,
    type: "quiz" | "flashcards" | "review",
    date: string,
    reason: "due_today" | "needs_review" | "developing",
): AdaptiveTaskPlanItem {
    const docTitle = mastery.document_title || "Untitled document"
    const conceptName = mastery.concept_name

    let title = ""
    let description = ""
    if (type === "quiz") {
        title = `Quiz: ${conceptName}`
        description = `Test your knowledge of this concept from ${docTitle}.`
    } else if (type === "flashcards") {
        title = `Flashcards: ${conceptName}`
        description = `Review cards for ${conceptName}.`
    } else {
        title = `Review: ${conceptName}`
        description = `Read through the core material for ${conceptName}.`
    }

    return {
        kind: "adaptive_task",
        id: `virtual-${type}-${mastery.concept_id}-${date}`,
        date,
        priorityScore: mastery.priority_score,
        scheduledTime: null,
        task: {
            id: `virtual-${type}-${mastery.concept_id}-${date}`,
            type,
            status: "needs_generation",
            reason,
            documentId: mastery.document_id || "",
            documentTitle: docTitle,
            conceptIds: [mastery.concept_id],
            conceptNames: [conceptName],
            scheduledDate: date,
            priorityScore: mastery.priority_score,
            count: type === "quiz" ? 10 : 1,
            title,
            description,
            clickable: true,
        },
    }
}

function createMultiConceptVirtualTask(
    concepts: LearningPathMasteryInput[],
    date: string,
    documentTitle: string,
): AdaptiveTaskPlanItem {
    const conceptIds = concepts.map((c) => c.concept_id)
    const conceptNames = concepts.map((c) => c.concept_name)
    const displayNames = conceptNames.slice(0, 3).join(", ")
    const overflow = conceptNames.length > 3 ? ` & ${conceptNames.length - 3} more` : ""
    const topPriority = Math.max(...concepts.map((c) => c.priority_score))
    const docId = concepts[0]?.document_id || ""

    return {
        kind: "adaptive_task",
        id: `virtual-multi-quiz-${docId}-${date}`,
        date,
        priorityScore: topPriority,
        scheduledTime: null,
        task: {
            id: `virtual-multi-quiz-${docId}-${date}`,
            type: "quiz",
            status: "needs_generation",
            reason: "needs_review",
            documentId: docId,
            documentTitle,
            conceptIds,
            conceptNames,
            scheduledDate: date,
            priorityScore: topPriority,
            count: Math.max(10, Math.min(20, concepts.length * 2)),
            title: `Adaptive Quiz: ${displayNames}${overflow}`,
            description: `Multi-concept quiz covering ${concepts.length} weak topics from ${documentTitle}.`,
            clickable: true,
        },
    }
}

export function getLearningPathItemsForDate(items: LearningPathPlanItem[], date: string) {
    return items.filter((item) => item.date === date).sort(comparePlanItems)
}
