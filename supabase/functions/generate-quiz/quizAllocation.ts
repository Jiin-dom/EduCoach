export type QuizTypeId = 'identification' | 'multiple_choice' | 'true_false' | 'fill_in_blank'

const STABLE_TYPE_ORDER: QuizTypeId[] = [
    'multiple_choice',
    'true_false',
    'fill_in_blank',
    'identification',
]

export type QuizTypeTargets = Partial<Record<QuizTypeId, number>>

export function computeBalancedQuizTypeTargets(params: {
    totalCount: number
    selectedTypes: string[]
}): { stableSelectedTypes: QuizTypeId[]; targetsByType: QuizTypeTargets } {
    const { totalCount, selectedTypes } = params

    const normalized = Array.from(new Set((selectedTypes || []).map(String))) as string[]
    const stableSelectedTypes = STABLE_TYPE_ORDER.filter((t) => normalized.includes(t))

    if (!Number.isFinite(totalCount) || totalCount <= 0 || stableSelectedTypes.length === 0) {
        return { stableSelectedTypes, targetsByType: {} }
    }

    const k = stableSelectedTypes.length
    const base = Math.floor(totalCount / k)
    const remainder = totalCount % k

    const targetsByType: QuizTypeTargets = {}
    for (let i = 0; i < stableSelectedTypes.length; i++) {
        targetsByType[stableSelectedTypes[i]] = base + (i < remainder ? 1 : 0)
    }

    return { stableSelectedTypes, targetsByType }
}

export function countQuestionsByType(questions: Array<{ question_type: string }>): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const q of questions) {
        const t = q.question_type
        counts[t] = (counts[t] || 0) + 1
    }
    return counts
}

