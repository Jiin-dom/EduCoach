import { describe, expect, it } from "vitest"

import {
    buildLearningPathPlan,
    getLearningPathItemsForDate,
    type LearningPathAdaptiveTaskInput,
    type LearningPathDocumentInput,
    type LearningPathMasteryInput,
    type LearningPathQuizInput,
} from "./learningPathPlan"

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

        expect(plan.baselinePlannedReviews).toHaveLength(1)
        expect(plan.performancePlannedReviews).toHaveLength(1)
        expect(plan.baselinePlannedReviews[0]).toMatchObject({
            kind: "planned_review",
            source: "baseline",
            conceptName: "Arrays",
        })
        expect(plan.performancePlannedReviews[0]).toMatchObject({
            kind: "planned_review",
            source: "performance",
            conceptName: "Trees",
        })
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

    it("returns date-sorted calendar items that include planned reviews, adaptive tasks, and goals", () => {
        const plan = buildLearningPathPlan({
            masteryRows: [makeMastery({ due_date: "2026-04-10" })],
            adaptiveTasks: [makeAdaptiveTask({ scheduledDate: "2026-04-09" })],
            documents: [makeDocument({ exam_date: "2026-04-11T00:00:00.000Z" })],
            quizzes: [],
        })

        expect(plan.items.map((item) => item.date)).toEqual([
            "2026-04-09",
            "2026-04-10",
            "2026-04-11",
        ])
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

        expect(items).toHaveLength(3)
        expect(items.map((item) => item.kind)).toEqual([
            "adaptive_task",
            "planned_review",
            "goal_marker",
        ])
    })
})
