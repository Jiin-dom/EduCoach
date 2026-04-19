import { describe, expect, it } from "vitest"

import { type Document } from "@/hooks/useDocuments"
import { type ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { type Quiz } from "@/hooks/useQuizzes"
import { type StudyGoal } from "@/types/studyGoals"
import { type LearningPathPlan } from "@/lib/learningPathPlan"
import {
    filterLearningPathPlan,
    getLearningPathScopeFilter,
    matchesQuizScope,
    resolveLearningPathScope,
} from "@/lib/learningPathScope"

const documents: Document[] = [
    {
        id: "doc-1",
        user_id: "user-1",
        title: "Biology Notes",
        goal_label: "Goal Name: Midterm mastery",
        quiz_deadline_label: null,
        file_name: "biology.pdf",
        file_path: "biology.pdf",
        file_type: "pdf",
        file_size: 100,
        status: "ready",
        error_message: null,
        summary: null,
        structured_summary: null,
        concept_count: 4,
        processed_by: "pure_nlp",
        processing_quality: 92,
        deadline: "2026-05-20T00:00:00.000Z",
        exam_date: "2026-05-18T00:00:00.000Z",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
    },
]

const masteryRows: ConceptMasteryWithDetails[] = [
    {
        id: "mastery-1",
        user_id: "user-1",
        concept_id: "concept-1",
        document_id: "doc-1",
        mastery_score: 48,
        confidence: 0.7,
        mastery_level: "needs_review",
        total_attempts: 3,
        correct_attempts: 1,
        last_attempt_at: "2026-04-10T00:00:00.000Z",
        repetition: 1,
        interval_days: 2,
        ease_factor: 2.5,
        due_date: "2026-04-20",
        last_reviewed_at: "2026-04-10T00:00:00.000Z",
        priority_score: 0.9,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        concept_name: "Cell division",
        concept_category: "Biology",
        concept_difficulty: "intermediate",
        document_title: "Biology Notes",
        document_exam_date: "2026-05-18T00:00:00.000Z",
        display_mastery_score: 48,
        display_mastery_level: "needs_review",
    },
]

const quizzes: Quiz[] = [
    {
        id: "quiz-1",
        user_id: "user-1",
        document_id: "doc-1",
        title: "Biology Quiz",
        description: null,
        question_count: 10,
        difficulty: "mixed",
        time_limit_minutes: null,
        status: "ready",
        error_message: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
    },
]

const studyGoals: StudyGoal[] = [
    {
        id: "goal-topic",
        user_id: "user-1",
        title: "Master cell division",
        goal_type: "topic_mastery",
        target_value: 80,
        concept_id: "concept-1",
        document_id: null,
        quiz_id: null,
        deadline: "2026-05-10T00:00:00.000Z",
        is_completed: false,
        completed_at: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
    },
    {
        id: "goal-quiz",
        user_id: "user-1",
        title: "Complete biology quiz twice",
        goal_type: "quiz_count",
        target_value: 2,
        concept_id: null,
        document_id: null,
        quiz_id: "quiz-1",
        deadline: "2026-05-20T00:00:00.000Z",
        is_completed: false,
        completed_at: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
    },
]

const plan: LearningPathPlan = {
    items: [
        {
            kind: "planned_review",
            id: "review-1",
            date: "2026-04-20",
            source: "performance",
            conceptId: "concept-1",
            conceptName: "Cell division",
            documentId: "doc-1",
            documentTitle: "Biology Notes",
            priorityScore: 0.9,
            mastery: masteryRows[0],
        },
        {
            kind: "goal_marker",
            id: "goal-marker-1",
            date: "2026-05-20",
            markerType: "quiz_deadline",
            documentId: "doc-1",
            quizId: "quiz-1",
            title: "Biology Quiz",
            documentTitle: "Biology Notes",
        },
        {
            kind: "adaptive_task",
            id: "task-1",
            date: "2026-04-21",
            priorityScore: 0.8,
            task: {
                id: "task-1",
                type: "quiz",
                status: "ready",
                reason: "needs_review",
                documentId: "doc-1",
                documentTitle: "Biology Notes",
                conceptIds: ["concept-1"],
                conceptNames: ["Cell division"],
                scheduledDate: "2026-04-21",
                priorityScore: 0.8,
                count: 6,
                title: "Adaptive quiz",
                description: "Review cell division",
                quizId: "quiz-1",
            },
        },
    ],
    baselinePlannedReviews: [],
    performancePlannedReviews: [
        {
            kind: "planned_review",
            id: "review-1",
            date: "2026-04-20",
            source: "performance",
            conceptId: "concept-1",
            conceptName: "Cell division",
            documentId: "doc-1",
            documentTitle: "Biology Notes",
            priorityScore: 0.9,
            mastery: masteryRows[0],
        },
    ],
    adaptiveTasks: [
        {
            kind: "adaptive_task",
            id: "task-1",
            date: "2026-04-21",
            priorityScore: 0.8,
            task: {
                id: "task-1",
                type: "quiz",
                status: "ready",
                reason: "needs_review",
                documentId: "doc-1",
                documentTitle: "Biology Notes",
                conceptIds: ["concept-1"],
                conceptNames: ["Cell division"],
                scheduledDate: "2026-04-21",
                priorityScore: 0.8,
                count: 6,
                title: "Adaptive quiz",
                description: "Review cell division",
                quizId: "quiz-1",
            },
        },
    ],
    goalMarkers: [
        {
            kind: "goal_marker",
            id: "goal-marker-1",
            date: "2026-05-20",
            markerType: "quiz_deadline",
            documentId: "doc-1",
            quizId: "quiz-1",
            title: "Biology Quiz",
            documentTitle: "Biology Notes",
        },
    ],
}

describe("learningPathScope", () => {
    it("resolves a topic mastery goal through mastery rows", () => {
        const resolved = resolveLearningPathScope({
            scope: { kind: "study_goal", id: "goal-topic" },
            documents,
            studyGoals,
            quizzes,
            masteryRows,
        })

        expect(resolved).not.toBeNull()
        expect(resolved?.documentId).toBe("doc-1")
        expect(resolved?.conceptId).toBe("concept-1")
    })

    it("builds a quiz-scoped filter for quiz-count goals", () => {
        const resolved = resolveLearningPathScope({
            scope: { kind: "study_goal", id: "goal-quiz" },
            documents,
            studyGoals,
            quizzes,
            masteryRows,
        })

        const filter = getLearningPathScopeFilter(resolved)

        expect(filter).toEqual({
            documentId: "doc-1",
            quizId: "quiz-1",
        })
        expect(matchesQuizScope(quizzes[0], filter)).toBe(true)
    })

    it("filters a plan down to the selected topic goal context", () => {
        const resolved = resolveLearningPathScope({
            scope: { kind: "study_goal", id: "goal-topic" },
            documents,
            studyGoals,
            quizzes,
            masteryRows,
        })
        const filter = getLearningPathScopeFilter(resolved)
        const filtered = filterLearningPathPlan(plan, filter)

        expect(filtered.performancePlannedReviews).toHaveLength(1)
        expect(filtered.adaptiveTasks).toHaveLength(1)
        expect(filtered.goalMarkers).toHaveLength(0)
    })
})
