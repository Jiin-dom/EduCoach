import type { QuizTypeId } from '@/types/quiz'

const STABLE_TYPE_ORDER: QuizTypeId[] = [
    'multiple_choice',
    'true_false',
    'fill_in_blank',
    'identification',
]

export type QuizTypeTargets = Partial<Record<QuizTypeId, number>>

export function computeBalancedQuizTypeTargets(params: {
    totalCount: number
    selectedTypes: QuizTypeId[]
}): { stableSelectedTypes: QuizTypeId[]; targetsByType: QuizTypeTargets } {
    const { totalCount, selectedTypes } = params

    const uniqueSelected = Array.from(new Set(selectedTypes))
    const stableSelectedTypes = STABLE_TYPE_ORDER.filter((t) => uniqueSelected.includes(t))

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

export function formatQuizTypeTargetsForHumans(params: {
    targetsByType: QuizTypeTargets
    stableSelectedTypes: QuizTypeId[]
}): string {
    const { targetsByType, stableSelectedTypes } = params

    const labelFor = (t: QuizTypeId) =>
        t === 'multiple_choice'
            ? 'Multiple Choice'
            : t === 'true_false'
                ? 'True/False'
                : t === 'fill_in_blank'
                    ? 'Fill in the Blank'
                    : 'Identification'

    const parts: string[] = []
    for (const t of stableSelectedTypes) {
        const n = targetsByType[t]
        if (!n || n <= 0) continue
        parts.push(`${n} ${labelFor(t)}`)
    }

    return parts.join(', ')
}

