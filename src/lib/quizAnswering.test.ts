import { describe, expect, it } from "vitest"
import type { QuizQuestion } from "@/hooks/useQuizzes"
import { isAnswerCorrect } from "./quizAnswering"

function makeQuestion(overrides: Partial<QuizQuestion>): QuizQuestion {
    return {
        id: "q1",
        quiz_id: "quiz-1",
        concept_id: null,
        source_chunk_id: null,
        question_type: "identification",
        question_text: "What term is being described?",
        options: null,
        correct_answer: "Activation Function",
        explanation: null,
        difficulty_level: "intermediate",
        order_index: 0,
        created_at: "2026-04-11T00:00:00.000Z",
        ...overrides,
    }
}

describe("isAnswerCorrect", () => {
    it("accepts normalized exact matches for identification", () => {
        expect(
            isAnswerCorrect(makeQuestion({ question_type: "identification" }), "activation function"),
        ).toBe(true)
    })

    it("accepts small identification typos within the short-answer tolerance", () => {
        expect(
            isAnswerCorrect(makeQuestion({ question_type: "identification" }), "activtion function"),
        ).toBe(true)
    })

    it("rejects definition paragraphs when the correct identification answer is a term", () => {
        expect(
            isAnswerCorrect(
                makeQuestion({ question_type: "identification", correct_answer: "Deep Learning" }),
                "Deep learning is a subfield of machine learning focused on layered representations.",
            ),
        ).toBe(false)
    })

    it("keeps fill-in-the-blank grading separate from identification grading", () => {
        expect(
            isAnswerCorrect(
                makeQuestion({
                    question_type: "fill_in_blank",
                    correct_answer: "Activation Function",
                }),
                "Activation Functon",
            ),
        ).toBe(true)
    })
})
