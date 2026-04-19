export interface QuizDeadlineLike {
    id: string
    document_id: string
    deadline?: string | null
    created_at?: string | null
}

function toTimestamp(value: string | null | undefined) {
    if (!value) return Number.NEGATIVE_INFINITY
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export function buildLatestQuizIdByDocument(quizzes: QuizDeadlineLike[]) {
    const latestByDocument = new Map<string, QuizDeadlineLike>()

    for (const quiz of quizzes) {
        const current = latestByDocument.get(quiz.document_id)
        if (!current) {
            latestByDocument.set(quiz.document_id, quiz)
            continue
        }

        const currentTimestamp = toTimestamp(current.created_at)
        const nextTimestamp = toTimestamp(quiz.created_at)

        if (nextTimestamp > currentTimestamp) {
            latestByDocument.set(quiz.document_id, quiz)
            continue
        }

        if (nextTimestamp === currentTimestamp && quiz.id.localeCompare(current.id) > 0) {
            latestByDocument.set(quiz.document_id, quiz)
        }
    }

    return new Map(
        Array.from(latestByDocument.entries()).map(([documentId, quiz]) => [documentId, quiz.id]),
    )
}

export function buildDocumentsWithExplicitQuizDeadlines(quizzes: QuizDeadlineLike[]) {
    return new Set(
        quizzes
            .filter((quiz) => !!quiz.deadline)
            .map((quiz) => quiz.document_id),
    )
}

export function getEffectiveQuizDeadline(params: {
    quiz: QuizDeadlineLike
    latestQuizIdByDocument: Map<string, string>
    documentDeadline?: string | null
    documentsWithExplicitQuizDeadlines?: Set<string>
}) {
    if (params.quiz.deadline) {
        return params.quiz.deadline
    }

    if (params.documentsWithExplicitQuizDeadlines?.has(params.quiz.document_id)) {
        return null
    }

    if (params.documentDeadline && params.latestQuizIdByDocument.get(params.quiz.document_id) === params.quiz.id) {
        return params.documentDeadline
    }

    return null
}
