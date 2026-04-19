import type { StudyGoal } from '@/types/studyGoals'
import type { ConceptMasteryWithDetails } from '@/hooks/useLearning'
import type { Quiz, Attempt } from '@/hooks/useQuizzes'

export interface GoalProgressViewModel {
    title: string
    goalType: StudyGoal['goal_type']
    percentComplete: number
    deadlineLabel: string | null
    targetSummary: string
    currentSummary: string
    extraGoalsCount: number
}

function quizBelongsToDocument(quiz: Pick<Quiz, 'document_id'> | undefined, documentId: string): boolean {
    return Boolean(quiz && quiz.document_id === documentId)
}

/**
 * Incomplete study goals relevant to a document: direct document_id match,
 * quiz goals for quizzes on this document, or topic goals for concepts that
 * appear on this document in mastery rows.
 */
export function filterStudyGoalsForDocument(
    goals: StudyGoal[],
    documentId: string,
    quizzesById: Map<string, Pick<Quiz, 'document_id'>>,
    masteryForDocument: ConceptMasteryWithDetails[],
): StudyGoal[] {
    const conceptIdsOnDoc = new Set(masteryForDocument.map((m) => m.concept_id))

    return goals.filter((g) => {
        if (g.is_completed) return false
        if (g.document_id === documentId) return true
        if (g.quiz_id) {
            const q = quizzesById.get(g.quiz_id)
            if (quizBelongsToDocument(q, documentId)) return true
        }
        if (g.goal_type === 'topic_mastery' && g.concept_id && conceptIdsOnDoc.has(g.concept_id)) return true
        return false
    })
}

function deadlineSortKey(deadline: string | null): number {
    if (!deadline) return Number.POSITIVE_INFINITY
    const t = new Date(deadline).getTime()
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/**
 * Primary strip: overall_mastery first, else soonest deadline, else newest created_at.
 */
export function selectPrimaryStudyGoal(goals: StudyGoal[]): StudyGoal | null {
    if (goals.length === 0) return null
    const overall = goals.find((g) => g.goal_type === 'overall_mastery')
    if (overall) return overall

    const sorted = [...goals].sort((a, b) => {
        const da = deadlineSortKey(a.deadline)
        const db = deadlineSortKey(b.deadline)
        if (da !== db) return da - db
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted[0] ?? null
}

function averageDisplayMasteryPracticed(rows: ConceptMasteryWithDetails[]): number {
    const practiced = rows.filter((r) => r.total_attempts > 0)
    if (practiced.length === 0) return 0
    const sum = practiced.reduce((acc, r) => acc + Number(r.display_mastery_score), 0)
    return Math.round(sum / practiced.length)
}

function formatDeadline(deadline: string | null): string | null {
    if (!deadline) return null
    const d = new Date(deadline)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function buildGoalProgressViewModel(
    primary: StudyGoal,
    allMatching: StudyGoal[],
    masteryForDocument: ConceptMasteryWithDetails[],
    attempts: Attempt[],
): GoalProgressViewModel {
    const target = Math.max(0, Number(primary.target_value) || 0)
    let percent = 0
    let currentSummary = ''
    let targetSummary = ''

    if (primary.goal_type === 'overall_mastery') {
        const avg = averageDisplayMasteryPracticed(masteryForDocument)
        currentSummary = practicedConceptCount(masteryForDocument) === 0 ? 'No practice yet' : `${avg}% avg mastery`
        targetSummary = `${target}% target`
        percent = target > 0 ? Math.min(100, Math.round((avg / target) * 100)) : 0
    } else if (primary.goal_type === 'topic_mastery' && primary.concept_id) {
        const row = masteryForDocument.find((m) => m.concept_id === primary.concept_id)
        const score = row ? Math.round(row.display_mastery_score) : 0
        currentSummary = row && row.total_attempts > 0 ? `${score}% on topic` : 'No practice yet'
        targetSummary = `${target}% target`
        percent = target > 0 ? Math.min(100, Math.round((score / target) * 100)) : 0
    } else if (primary.goal_type === 'quiz_count' && primary.quiz_id) {
        const done = attempts.filter((a) => a.quiz_id === primary.quiz_id && a.completed_at).length
        currentSummary = `${done} quiz run${done === 1 ? '' : 's'}`
        targetSummary = `${target} target`
        percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0
    } else {
        currentSummary = '—'
        targetSummary = `${target} target`
        percent = 0
    }

    const extra = Math.max(0, allMatching.length - 1)

    return {
        title: primary.title,
        goalType: primary.goal_type,
        percentComplete: percent,
        deadlineLabel: formatDeadline(primary.deadline),
        targetSummary,
        currentSummary,
        extraGoalsCount: extra,
    }
}

function practicedConceptCount(rows: ConceptMasteryWithDetails[]): number {
    return rows.filter((r) => r.total_attempts > 0).length
}
