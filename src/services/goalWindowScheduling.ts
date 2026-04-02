import { supabase } from '@/lib/supabase'
import { calculatePriorityScore, todayUTC } from '@/lib/learningAlgorithms'
import type { LearningConfig } from '@/hooks/useLearning'

type StudyDayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const farFutureDate = '2099-12-31'
type SchedulingMasteryRow = {
    concept_id: string
    mastery_score: number
    confidence: number
    due_date: string | null
    total_attempts: number
}
const DEFAULT_LEARNING_CONFIG: LearningConfig = {
    confidence_k: 3,
    sm2_default_ef: 2.5,
    quality_thresholds: [90, 80, 65, 50, 30],
    priority_w_weakness: 0.65,
    priority_w_deadline: 0.25,
    priority_w_practice: 0.10,
    mastery_threshold_mastered: 80,
    mastery_threshold_developing: 60,
    confidence_threshold_mastered: 0.67,
}

function mapUtcDayToStudyDayId(utcDayIndex: number): StudyDayId {
    // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
    switch (utcDayIndex) {
        case 0:
            return 'sun'
        case 1:
            return 'mon'
        case 2:
            return 'tue'
        case 3:
            return 'wed'
        case 4:
            return 'thu'
        case 5:
            return 'fri'
        default:
            return 'sat'
    }
}

function computeCapacityPerDay(dailyStudyMinutes: number): number {
    // Heuristic: treat one "topic session" as ~30 minutes of focused work.
    // The calendar is date-based only, so this capacity determines how many
    // concept due_date assignments land on each day.
    const minutesPerSession = 30
    const safe = Number.isFinite(dailyStudyMinutes) ? dailyStudyMinutes : 30
    return Math.max(1, Math.round(safe / minutesPerSession))
}

function buildAvailableDateSlots(params: {
    windowStart: string // UTC YYYY-MM-DD
    windowEnd: string // UTC YYYY-MM-DD
    availableStudyDays: string[] | null | undefined
}): string[] {
    const { windowStart, windowEnd, availableStudyDays } = params

    const allowed = Array.isArray(availableStudyDays) && availableStudyDays.length > 0
        ? new Set(availableStudyDays)
        : null

    const start = new Date(windowStart + 'T00:00:00Z')
    const end = new Date(windowEnd + 'T00:00:00Z')

    const slots: string[] = []
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        const studyDayId = mapUtcDayToStudyDayId(d.getUTCDay())
        if (!allowed || allowed.has(studyDayId)) {
            slots.push(d.toISOString().split('T')[0])
        }
    }

    // Safety fallback so scheduling always has at least one slot.
    return slots.length > 0 ? slots : [windowStart]
}

export async function scheduleDocumentGoalWindow(params: {
    userId: string
    documentId: string
    examDate: string // ISO or YYYY-MM-DD
    availableStudyDays: string[] | null | undefined
    dailyStudyMinutes: number
    learningConfig?: LearningConfig
}) {
    const { userId, documentId, examDate, availableStudyDays, dailyStudyMinutes, learningConfig } = params

    const effectiveCfg = learningConfig ?? DEFAULT_LEARNING_CONFIG

    const windowStart = todayUTC()
    const windowEnd = examDate.split('T')[0]

    if (!windowEnd) return { updated: 0, createdPlaceholders: 0 }

    // 1) Get all concept IDs extracted from this document.
    const { data: conceptRows, error: conceptErr } = await supabase
        .from('concepts')
        .select('id')
        .eq('document_id', documentId)

    if (conceptErr) throw new Error(conceptErr.message)

    const conceptIds = (conceptRows ?? []).map((c) => c.id).filter(Boolean)
    if (conceptIds.length === 0) return { updated: 0, createdPlaceholders: 0 }

    // 2) Fetch existing mastery state for these concepts.
    const { data: masteryRows, error: masteryErr } = await supabase
        .from('user_concept_mastery')
        .select('concept_id, mastery_score, confidence, due_date, total_attempts, mastery_level, document_id')
        .eq('user_id', userId)
        .in('concept_id', conceptIds)

    if (masteryErr) throw new Error(masteryErr.message)

    const masteryMap = new Map<string, SchedulingMasteryRow>()
    for (const row of masteryRows ?? []) {
        if (!row.concept_id) continue
        masteryMap.set(row.concept_id, {
            concept_id: row.concept_id,
            mastery_score: Number(row.mastery_score ?? 50),
            confidence: Number(row.confidence ?? 0),
            due_date: (row.due_date as string | null) ?? null,
            total_attempts: Number((row as unknown as { total_attempts?: number })?.total_attempts ?? 0),
        })
    }

    // 3) Bootstrap placeholder rows for concepts that don't have mastery yet.
    const missing = conceptIds.filter((cid) => !masteryMap.has(cid))

    if (missing.length > 0) {
        const placeholderRows = missing.map((cid) => ({
            user_id: userId,
            concept_id: cid,
            document_id: documentId,
            mastery_score: 50,
            confidence: 0,
            mastery_level: 'needs_review',
            total_attempts: 0,
            correct_attempts: 0,
            last_attempt_at: null,
            repetition: 0,
            interval_days: 1,
            ease_factor: Number(effectiveCfg.sm2_default_ef),
            due_date: windowStart,
            last_reviewed_at: null,
            priority_score: 0,
        }))

        const { error: insertErr } = await supabase
            .from('user_concept_mastery')
            .upsert(placeholderRows, { onConflict: 'user_id,concept_id' })

        if (insertErr) throw new Error(insertErr.message)

        // Add defaults into the in-memory map so we can schedule them now.
        for (const cid of missing) {
            masteryMap.set(cid, {
                concept_id: cid,
                mastery_score: 50,
                confidence: 0,
                due_date: windowStart,
                total_attempts: 0,
            })
        }
    }

    const availableSlots = buildAvailableDateSlots({
        windowStart,
        windowEnd,
        availableStudyDays,
    })

    const capacityPerDay = computeCapacityPerDay(dailyStudyMinutes)

    // 4) Decide which concepts need goal-window due-date reassignment:
    // - placeholders (no attempts yet)
    // - any existing concept whose due_date is AFTER windowEnd
    const needsReassign = conceptIds.filter((cid) => {
        const row = masteryMap.get(cid)
        if (!row) return true
        if (row.total_attempts === 0) return true
        if (!row.due_date) return true
        return row.due_date > windowEnd
    })

    if (needsReassign.length === 0) {
        return { updated: 0, createdPlaceholders: missing.length }
    }

    // 5) Order by urgency seed (weakness/practice prioritized; deadline pressure is constant at windowEnd).
    const weights = {
        weakness: Number(effectiveCfg.priority_w_weakness),
        deadline: Number(effectiveCfg.priority_w_deadline),
        practice: Number(effectiveCfg.priority_w_practice),
    }

    const seeded = needsReassign
        .map((cid) => {
            const row = masteryMap.get(cid)!
            const mastery = row.mastery_score
            const confidence = row.confidence
            const seed = calculatePriorityScore(mastery, windowEnd, confidence, weights).priorityScore
            return { cid, seed }
        })
        .sort((a, b) => b.seed - a.seed)

    // 6) Allocate sequentially across available slots, stacking overflow on the last available day.
    const dueAssignments = new Map<string, string>()
    for (let i = 0; i < seeded.length; i++) {
        const slotIdx = Math.min(Math.floor(i / capacityPerDay), availableSlots.length - 1)
        dueAssignments.set(seeded[i].cid, availableSlots[slotIdx])
    }

    // 7) Persist due_date + priority_score for reassigned concepts.
    const upserts = seeded.map(({ cid }) => {
        const row = masteryMap.get(cid)!
        const mastery = row.mastery_score
        const confidence = row.confidence
        const newDueDate = dueAssignments.get(cid)!
        const priority = calculatePriorityScore(mastery, newDueDate, confidence, weights).priorityScore

        return {
            user_id: userId,
            concept_id: cid,
            due_date: newDueDate,
            priority_score: priority,
        }
    })

    const { error: upsertErr } = await supabase
        .from('user_concept_mastery')
        .upsert(upserts, { onConflict: 'user_id,concept_id' })

    if (upsertErr) throw new Error(upsertErr.message)

    return { updated: upserts.length, createdPlaceholders: missing.length }
}

export async function deactivateDocumentGoalWindowPlaceholders(params: {
    userId: string
    documentId: string
    learningConfig?: LearningConfig
}) {
    const { userId, documentId, learningConfig } = params

    const effectiveCfg = learningConfig ?? DEFAULT_LEARNING_CONFIG

    // Pull all concept IDs for the document so we can target only its placeholders.
    const { data: conceptRows, error: conceptErr } = await supabase
        .from('concepts')
        .select('id')
        .eq('document_id', documentId)

    if (conceptErr) throw new Error(conceptErr.message)

    const conceptIds = (conceptRows ?? []).map((c) => c.id).filter(Boolean)
    if (conceptIds.length === 0) return { updated: 0 }

    // Only "bootstrap placeholders" are those with no attempts yet.
    // We "deactivate" them by pushing due_date far into the future.
    const weights = {
        weakness: Number(effectiveCfg.priority_w_weakness),
        deadline: Number(effectiveCfg.priority_w_deadline),
        practice: Number(effectiveCfg.priority_w_practice),
    }

    const priority = calculatePriorityScore(50, farFutureDate, 0, weights).priorityScore

    const { error: updateErr } = await supabase
        .from('user_concept_mastery')
        .update({ due_date: farFutureDate, priority_score: priority })
        .eq('user_id', userId)
        .in('concept_id', conceptIds)
        .eq('total_attempts', 0)

    if (updateErr) throw new Error(updateErr.message)

    return { updated: conceptIds.length }
}

