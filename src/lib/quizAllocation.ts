import type { QuizTypeId } from '@/types/quiz'

const STABLE_TYPE_ORDER: QuizTypeId[] = [
    'multiple_choice',
    'true_false',
    'fill_in_blank',
    'identification',
]

export type QuizTypeTargets = Partial<Record<QuizTypeId, number>>

const DIFFICULTY_TYPE_WEIGHTS: Record<string, Record<QuizTypeId, number>> = {
    easy:   { true_false: 35, multiple_choice: 30, identification: 25, fill_in_blank: 10 },
    medium: { multiple_choice: 30, fill_in_blank: 25, identification: 25, true_false: 20 },
    hard:   { multiple_choice: 35, fill_in_blank: 30, identification: 20, true_false: 15 },
    mixed:  { multiple_choice: 30, true_false: 25, identification: 25, fill_in_blank: 20 },
}

export function computeBalancedQuizTypeTargets(params: {
    totalCount: number
    selectedTypes: QuizTypeId[]
    difficulty?: string
}): { stableSelectedTypes: QuizTypeId[]; targetsByType: QuizTypeTargets } {
    const { totalCount, selectedTypes, difficulty } = params

    const uniqueSelected = Array.from(new Set(selectedTypes))
    const stableSelectedTypes = STABLE_TYPE_ORDER.filter((t) => uniqueSelected.includes(t))

    if (!Number.isFinite(totalCount) || totalCount <= 0 || stableSelectedTypes.length === 0) {
        return { stableSelectedTypes, targetsByType: {} }
    }

    const weights = difficulty ? DIFFICULTY_TYPE_WEIGHTS[difficulty] : null
    if (!weights) {
        const k = stableSelectedTypes.length
        const base = Math.floor(totalCount / k)
        const remainder = totalCount % k
        const targetsByType: QuizTypeTargets = {}
        for (let i = 0; i < stableSelectedTypes.length; i++) {
            targetsByType[stableSelectedTypes[i]] = base + (i < remainder ? 1 : 0)
        }
        return { stableSelectedTypes, targetsByType }
    }

    const totalWeight = stableSelectedTypes.reduce((sum, t) => sum + (weights[t] || 0), 0)
    if (totalWeight <= 0) {
        const k = stableSelectedTypes.length
        const base = Math.floor(totalCount / k)
        const remainder = totalCount % k
        const targetsByType: QuizTypeTargets = {}
        for (let i = 0; i < stableSelectedTypes.length; i++) {
            targetsByType[stableSelectedTypes[i]] = base + (i < remainder ? 1 : 0)
        }
        return { stableSelectedTypes, targetsByType }
    }

    const targetsByType: QuizTypeTargets = {}
    let assigned = 0
    for (const t of stableSelectedTypes) {
        const raw = Math.floor((totalCount * (weights[t] || 0)) / totalWeight)
        targetsByType[t] = raw
        assigned += raw
    }

    let leftover = totalCount - assigned
    const sorted = [...stableSelectedTypes].sort((a, b) => {
        const fracA = ((totalCount * (weights[a] || 0)) / totalWeight) % 1
        const fracB = ((totalCount * (weights[b] || 0)) / totalWeight) % 1
        return fracB - fracA
    })
    for (const t of sorted) {
        if (leftover <= 0) break
        targetsByType[t] = (targetsByType[t] || 0) + 1
        leftover--
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

