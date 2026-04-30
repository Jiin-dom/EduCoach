import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const calendarSource = readFileSync(new URL("./LearningPathCalendar.tsx", import.meta.url), "utf8")
const pageSource = readFileSync(new URL("../../pages/LearningPathPage.tsx", import.meta.url), "utf8")

describe("LearningPathCalendar completed quiz contract", () => {
    it("declares and receives completed-today quizzes from LearningPathPage", () => {
        expect(calendarSource).toContain("completedTodayQuizzes?: QuizItem[]")
        expect(calendarSource).toMatch(/completedTodayQuizzes\s*=\s*\[\]/)
        expect(pageSource).toMatch(
            /<LearningPathCalendar[\s\S]*completedTodayQuizzes=\{completedTodayQuizzes\}/,
        )
    })
})
