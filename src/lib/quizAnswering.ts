import type { QuizQuestion } from "@/hooks/useQuizzes"

function normalizeForGrading(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[.,;:!?'"()[\]{}]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

function levenshteinDistance(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
    }

    return dp[m][n]
}

function isShortAnswerMatch(userAnswer: string, correctAnswer: string): boolean {
    const normUa = normalizeForGrading(userAnswer)
    const normCa = normalizeForGrading(correctAnswer)

    if (normUa === normCa) return true

    const maxLen = Math.max(normUa.length, normCa.length)
    if (maxLen === 0) return false

    const dist = levenshteinDistance(normUa, normCa)
    return dist / maxLen <= 0.2
}

export function isAnswerCorrect(question: QuizQuestion, userAnswer: string): boolean {
    if (!userAnswer) return false

    const normalizedUserAnswer = userAnswer.toLowerCase().trim()
    const normalizedCorrectAnswer = question.correct_answer.toLowerCase().trim()

    if (question.question_type === "true_false" || question.question_type === "multiple_choice") {
        return normalizedUserAnswer === normalizedCorrectAnswer
    }

    if (question.question_type === "fill_in_blank") {
        return isShortAnswerMatch(userAnswer, question.correct_answer)
    }

    if (question.question_type === "identification") {
        return isShortAnswerMatch(userAnswer, question.correct_answer)
    }

    return false
}
