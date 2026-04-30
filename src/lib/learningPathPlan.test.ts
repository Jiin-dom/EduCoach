import { describe, expect, it } from "vitest"

import {
    buildLearningPathPlan,
    getLearningPathItemsForDate,
    type LearningPathAdaptiveTaskInput,
    type LearningPathDocumentInput,
    type LearningPathMasteryInput,
    type LearningPathQuizInput,
} from "./learningPathPlan"

const TODAY = new Date().toISOString().split("T")[0]

function futureDate(daysAhead: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return d.toISOString().split("T")[0]
}

function makeMastery(overrides: Partial<LearningPathMasteryInput> = {}): LearningPathMasteryInput {
    return {
        id: "m-1",
        concept_id: "c-1",
        concept_name: "Arrays",
        document_id: "d-1",
        document_title: "Algorithms",
        due_date: "2026-04-10",
        total_attempts: 0,
        confidence: 0,
        priority_score: 0.6,
        display_mastery_level: "needs_review",
        display_mastery_score: 50,
        mastery_score: 50,
        ...overrides,
    }
}

function makeAdaptiveTask(overrides: Partial<LearningPathAdaptiveTaskInput> = {}): LearningPathAdaptiveTaskInput {
    return {
        id: "task-1",
        type: "quiz",
        status: "ready",
        reason: "due_today",
        documentId: "d-1",
        documentTitle: "Algorithms",
        conceptIds: ["c-1"],
        conceptNames: ["Arrays"],
        scheduledDate: "2026-04-09",
        priorityScore: 0.9,
        count: 10,
        title: "Adaptive quiz for Algorithms",
        description: "Focused on Arrays.",
        quizId: "q-1",
        ...overrides,
    }
}

function makeDocument(overrides: Partial<LearningPathDocumentInput> = {}): LearningPathDocumentInput {
    return {
        id: "d-1",
        title: "Algorithms",
        exam_date: null,
        deadline: null,
        ...overrides,
    }
}

function makeQuiz(overrides: Partial<LearningPathQuizInput> = {}): LearningPathQuizInput {
    return {
        id: "q-1",
        title: "Sorting Quiz",
        document_id: "d-1",
        ...overrides,
    }
}

describe("buildLearningPathPlan", () => {
    it("separates baseline planned reviews from performance-backed planned reviews", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery(),
                makeMastery({
                    id: "m-2",
                    concept_id: "c-2",
                    concept_name: "Trees",
                    total_attempts: 3,
                    confidence: 1,
                    due_date: "2026-04-09",
                    display_mastery_level: "developing",
                    display_mastery_score: 74,
                    mastery_score: 74,
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument()],
            quizzes: [],
        })

        expect(plan.baselinePlannedReviews.length).toBeGreaterThanOrEqual(1)
        expect(plan.performancePlannedReviews.length).toBeGreaterThanOrEqual(1)
        expect(plan.baselinePlannedReviews).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "planned_review",
                    source: "baseline",
                    conceptName: "Arrays",
                }),
            ]),
        )
        expect(plan.performancePlannedReviews).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "planned_review",
                    source: "performance",
                    conceptName: "Trees",
                }),
            ]),
        )
    })

    it("emits goal markers for file goals and quiz deadlines", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [],
            adaptiveTasks: [],
            documents: [
                makeDocument({
                    exam_date: "2026-04-12T00:00:00.000Z",
                    deadline: "2026-04-11T00:00:00.000Z",
                }),
            ],
            quizzes: [makeQuiz()],
        })

        expect(plan.goalMarkers).toHaveLength(2)
        expect(plan.goalMarkers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "goal_marker",
                    markerType: "file_goal",
                    date: "2026-04-12",
                    title: "Algorithms",
                }),
                expect.objectContaining({
                    kind: "goal_marker",
                    markerType: "quiz_deadline",
                    date: "2026-04-11",
                    title: "Sorting Quiz",
                }),
            ]),
        )
    })

    it("keeps quiz deadline markers scoped to quizzes that actually own a deadline", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [],
            adaptiveTasks: [],
            documents: [
                makeDocument({
                    exam_date: "2026-04-12T00:00:00.000Z",
                    deadline: "2026-04-15T00:00:00.000Z",
                }),
            ],
            quizzes: [
                {
                    ...makeQuiz({
                        id: "q-legacy",
                        title: "Legacy Quiz",
                    }),
                    deadline: null,
                    created_at: "2026-04-09T00:00:00.000Z",
                } as LearningPathQuizInput & { deadline: string | null; created_at: string },
                {
                    ...makeQuiz({
                        id: "q-deadline",
                        title: "Deadline Quiz",
                    }),
                    deadline: "2026-04-11T00:00:00.000Z",
                    created_at: "2026-04-10T00:00:00.000Z",
                } as LearningPathQuizInput & { deadline: string | null; created_at: string },
            ],
        })

        expect(plan.goalMarkers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "goal_marker",
                    markerType: "file_goal",
                    date: "2026-04-12",
                }),
                expect.objectContaining({
                    kind: "goal_marker",
                    markerType: "quiz_deadline",
                    quizId: "q-deadline",
                    date: "2026-04-11",
                    title: "Deadline Quiz",
                }),
            ]),
        )
        expect(plan.goalMarkers.filter((item) => item.markerType === "quiz_deadline")).toHaveLength(1)
    })

    it("uses document deadline fallback only for legacy documents with no explicit quiz deadlines", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [],
            adaptiveTasks: [],
            documents: [
                makeDocument({
                    deadline: "2026-04-15T00:00:00.000Z",
                }),
            ],
            quizzes: [
                {
                    ...makeQuiz({
                        id: "q-with-deadline",
                        title: "Older Explicit Quiz",
                    }),
                    deadline: "2026-04-11T00:00:00.000Z",
                    created_at: "2026-04-09T00:00:00.000Z",
                } as LearningPathQuizInput & { deadline: string | null; created_at: string },
                {
                    ...makeQuiz({
                        id: "q-latest-no-deadline",
                        title: "Latest Legacy Quiz",
                    }),
                    deadline: null,
                    created_at: "2026-04-10T00:00:00.000Z",
                } as LearningPathQuizInput & { deadline: string | null; created_at: string },
            ],
        })

        expect(
            plan.goalMarkers.filter((item) => item.markerType === "quiz_deadline"),
        ).toEqual([
            expect.objectContaining({
                quizId: "q-with-deadline",
                date: "2026-04-11",
            }),
        ])
    })

    it("returns date-sorted calendar items including planned reviews, adaptive tasks, and goals", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [makeMastery({ due_date: "2026-04-10" })],
            adaptiveTasks: [makeAdaptiveTask({ scheduledDate: "2026-04-09" })],
            documents: [makeDocument({ exam_date: "2026-04-11T00:00:00.000Z" })],
            quizzes: [],
        })

        const dates = plan.items.map((item) => item.date)
        expect(dates).toContain("2026-04-09")
        expect(dates).toContain("2026-04-11")

        for (let i = 1; i < dates.length; i++) {
            expect(dates[i] >= dates[i - 1]).toBe(true)
        }
    })
})

describe("getLearningPathItemsForDate", () => {
    it("groups all item kinds for the same date", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [makeMastery({ due_date: "2026-04-10" })],
            adaptiveTasks: [makeAdaptiveTask({ scheduledDate: "2026-04-10" })],
            documents: [makeDocument({ exam_date: "2026-04-10T00:00:00.000Z" })],
            quizzes: [],
        })

        const items = getLearningPathItemsForDate(plan.items, "2026-04-10")

        expect(items.length).toBeGreaterThanOrEqual(2)
        const kinds = items.map((item) => item.kind)
        expect(kinds).toContain("adaptive_task")
        expect(kinds).toContain("goal_marker")
    })
})

describe("virtual task generation", () => {
    it("creates virtual adaptive tasks for concepts needing review", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery({
                    id: "m-1",
                    concept_id: "c-1",
                    concept_name: "Sorting",
                    due_date: TODAY,
                    display_mastery_level: "needs_review",
                    priority_score: 0.9,
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
        })

        const virtualTasks = plan.adaptiveTasks.filter((t) => t.id.startsWith("virtual-"))
        expect(virtualTasks.length).toBeGreaterThan(0)

        const types = virtualTasks.map((t) => t.task.type)
        expect(types).toContain("review")
        expect(types).toContain("flashcards")
        expect(types).toContain("quiz")
    })

    it("creates multi-concept quiz tasks when multiple weak concepts exist", () => {
        const concepts = Array.from({ length: 6 }, (_, i) =>
            makeMastery({
                id: `m-${i}`,
                concept_id: `c-${i}`,
                concept_name: `Concept ${i}`,
                due_date: TODAY,
                display_mastery_level: "needs_review",
                priority_score: 0.9 - i * 0.1,
            }),
        )

        const plan = buildLearningPathPlan({
            masteryRows: concepts,
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
        })

        const multiQuizzes = plan.adaptiveTasks.filter((t) => t.id.startsWith("virtual-multi-quiz-"))
        expect(multiQuizzes.length).toBeGreaterThan(0)
        expect(multiQuizzes[0].task.conceptIds.length).toBeGreaterThan(1)
        expect(multiQuizzes[0].task.title).toContain("Adaptive Quiz:")
    })

    it("respects dynamic daily task cap based on dailyStudyMinutes", () => {
        const concepts = Array.from({ length: 10 }, (_, i) =>
            makeMastery({
                id: `m-${i}`,
                concept_id: `c-${i}`,
                concept_name: `Concept ${i}`,
                due_date: TODAY,
                display_mastery_level: "needs_review",
                priority_score: 0.9,
            }),
        )

        const plan = buildLearningPathPlan({
            masteryRows: concepts,
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
            dailyStudyMinutes: 30,
        })

        const maxCap = Math.max(2, Math.round(30 / 30))
        const itemsByDate = new Map<string, number>()
        for (const item of plan.adaptiveTasks) {
            itemsByDate.set(item.date, (itemsByDate.get(item.date) || 0) + 1)
        }

        for (const [, count] of itemsByDate) {
            expect(count).toBeLessThanOrEqual(maxCap + 1)
        }
    })

    it("does not schedule virtual tasks past document exam date", () => {
        const examDate = futureDate(5)
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery({
                    due_date: TODAY,
                    display_mastery_level: "needs_review",
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: examDate })],
            quizzes: [],
        })

        const virtualTasks = plan.adaptiveTasks.filter((t) => t.id.startsWith("virtual-"))
        for (const task of virtualTasks) {
            expect(task.date <= examDate).toBe(true)
        }
    })

    it("deduplicates planned reviews that overlap with virtual tasks", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery({
                    id: "m-1",
                    concept_id: "c-1",
                    due_date: TODAY,
                    display_mastery_level: "needs_review",
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
        })

        const reviewsOnToday = plan.items.filter(
            (item) =>
                item.date === TODAY &&
                item.kind === "planned_review" &&
                (item as { conceptId?: string }).conceptId === "c-1",
        )
        const virtualOnToday = plan.adaptiveTasks.filter(
            (t) => t.date === TODAY && t.task.conceptIds.includes("c-1"),
        )

        if (virtualOnToday.length > 0) {
            expect(reviewsOnToday.length).toBe(0)
        }
    })

    it("fills empty study days with tasks when content is available", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery({
                    due_date: TODAY,
                    display_mastery_level: "needs_review",
                    priority_score: 0.9,
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
        })

        const allDates = new Set(plan.adaptiveTasks.map((t) => t.date))
        expect(allDates.size).toBeGreaterThan(1)
    })

    it("virtual tasks have clickable flag set", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [
                makeMastery({
                    due_date: TODAY,
                    display_mastery_level: "needs_review",
                }),
            ],
            adaptiveTasks: [],
            documents: [makeDocument({ exam_date: futureDate(14) })],
            quizzes: [],
        })

        const virtualTasks = plan.adaptiveTasks.filter((t) => t.id.startsWith("virtual-"))
        for (const task of virtualTasks) {
            expect(task.task.clickable).toBe(true)
        }
    })
})
