/**
 * Learning Algorithms — Pure Functions
 *
 * Contains WMS (Weighted Mastery Score), SM-2 (Spaced Repetition),
 * and Global Scheduler (Priority Score) calculations.
 *
 * Zero side effects, zero DB calls — just math.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type MasteryLevel = 'needs_review' | 'developing' | 'mastered'

export interface AttemptLogEntry {
    is_correct: boolean
    question_difficulty: DifficultyLevel | null
    time_spent_seconds: number | null
    attempted_at: string
    source_type?: 'quiz' | 'flashcard'
    attempt_id?: string | null
    flashcard_id?: string | null
}

export interface SM2Input {
    quality: number
    repetition: number
    interval: number
    easeFactor: number
}

export interface SM2Result {
    repetition: number
    interval: number
    easeFactor: number
    dueDate: string
}

export interface MasteryResult {
    masteryScore: number
    confidence: number
    finalMastery: number
    masteryLevel: MasteryLevel
}

export interface PriorityResult {
    priorityScore: number
    deadlinePressure: number
    lowPracticePenalty: number
}

// ─── WMS: Difficulty Weights ────────────────────────────────────────────────

const DIFFICULTY_WEIGHTS: Record<DifficultyLevel, number> = {
    beginner: 1.0,
    intermediate: 1.1,
    advanced: 1.2,
}

// ─── WMS: Recency Weights (last 3 attempts) ────────────────────────────────

const RECENCY_WEIGHTS = [1.0, 0.85, 0.70]

// ─── WMS Step 1: Attempt Score ──────────────────────────────────────────────

/**
 * Score a single question attempt (0–1).
 *
 * AttemptScore = Correct × DiffWeight × TimeWeight
 *
 * Correct answers on harder questions yield higher scores.
 * Fast correct answers get a small bonus (up to 1.1×), very slow
 * answers get a mild penalty (down to 0.85×). When time is unknown
 * the weight defaults to 1.0.
 */
export function calculateAttemptScore(
    isCorrect: boolean,
    difficulty: DifficultyLevel | null,
    timeSpentSeconds?: number | null,
): number {
    if (!isCorrect) return 0

    const diffWeight = DIFFICULTY_WEIGHTS[difficulty ?? 'intermediate']

    let timeWeight = 1.0
    if (timeSpentSeconds != null && timeSpentSeconds > 0) {
        if (timeSpentSeconds <= 15) {
            timeWeight = 1.1
        } else if (timeSpentSeconds <= 30) {
            timeWeight = 1.05
        } else if (timeSpentSeconds <= 60) {
            timeWeight = 1.0
        } else if (timeSpentSeconds <= 120) {
            timeWeight = 0.95
        } else {
            timeWeight = 0.85
        }
    }

    return Math.min(1, diffWeight * timeWeight)
}

// ─── WMS Step 2+3: Topic Mastery (0–100) ────────────────────────────────────

/**
 * Compute raw topic mastery from the most recent attempts.
 *
 * Takes up to 3 most-recent attempt log entries (already sorted newest-first),
 * applies recency weights, and returns a 0–100 score.
 *
 * Formula:
 *   Mastery = 100 × Σ(AttemptScore_i × RecencyWeight_i) / Σ(RecencyWeight_i)
 */
export function calculateTopicMastery(attempts: AttemptLogEntry[]): number {
    if (attempts.length === 0) return 0

    const recent = attempts.slice(0, 3)
    let weightedSum = 0
    let weightSum = 0

    for (let i = 0; i < recent.length; i++) {
        const score = calculateAttemptScore(
            recent[i].is_correct,
            recent[i].question_difficulty,
            recent[i].time_spent_seconds,
        )
        const w = RECENCY_WEIGHTS[i] ?? 0.70
        weightedSum += score * w
        weightSum += w
    }

    if (weightSum === 0) return 0
    return Math.round((100 * weightedSum) / weightSum * 100) / 100
}

// ─── WMS Step 4: Confidence ─────────────────────────────────────────────────

/**
 * Confidence rises with more attempts.
 *   1 attempt  → 0.33
 *   2 attempts → 0.67
 *   3+ attempts → 1.00
 */
export function calculateConfidence(attemptCount: number, k = 3): number {
    return Math.min(1, attemptCount / k)
}

// ─── WMS Step 5: Final Mastery (blended with baseline) ─────────────────────

/**
 * Blend raw mastery with a neutral baseline (50) using confidence.
 *
 * FinalMastery = confidence × rawMastery + (1 − confidence) × 50
 *
 * This prevents one lucky correct answer from claiming "mastered".
 */
export function calculateFinalMastery(
    rawMastery: number,
    confidence: number,
    baseline = 50,
): number {
    const fm = confidence * rawMastery + (1 - confidence) * baseline
    return Math.round(fm * 100) / 100
}

// ─── WMS Step 6: Mastery Level ──────────────────────────────────────────────

/**
 * Convert numeric mastery + confidence into a human-readable level.
 *
 * Mastered:     finalMastery >= 80 AND confidence >= 0.67
 * Developing:   finalMastery 60–79
 * Needs Review: finalMastery < 60
 */
export function getMasteryLevel(
    finalMastery: number,
    confidence: number,
    thresholds = { mastered: 80, developing: 60, confRequired: 0.67 },
): MasteryLevel {
    if (finalMastery >= thresholds.mastered && confidence >= thresholds.confRequired) {
        return 'mastered'
    }
    if (finalMastery >= thresholds.developing) {
        return 'developing'
    }
    return 'needs_review'
}

// ─── WMS: Full Pipeline ─────────────────────────────────────────────────────

/**
 * Run the complete WMS pipeline on a set of attempt log entries.
 * Entries should be sorted newest-first.
 * `confidenceK` controls how many attempts are needed for full confidence (default 3).
 */
export function computeMastery(
    attempts: AttemptLogEntry[],
    confidenceK = 3,
    confidenceEvidenceCount?: number,
): MasteryResult {
    const rawMastery = calculateTopicMastery(attempts)
    const evidenceCount = confidenceEvidenceCount ?? attempts.length
    const confidence = calculateConfidence(evidenceCount, confidenceK)
    const finalMastery = calculateFinalMastery(rawMastery, confidence)
    const masteryLevel = getMasteryLevel(finalMastery, confidence)

    return { masteryScore: rawMastery, confidence, finalMastery, masteryLevel }
}

// ─── SM-2: Quality Mapping ──────────────────────────────────────────────────

/**
 * Map a quiz score percentage (0–100) to an SM-2 quality rating (0–5).
 *
 *   >= 90 → 5   (perfect)
 *   80–89 → 4
 *   65–79 → 3
 *   50–64 → 2
 *   30–49 → 1
 *    < 30 → 0   (blackout)
 */
export function mapScoreToQuality(
    scorePercent: number,
    thresholds = [90, 80, 65, 50, 30],
): number {
    if (scorePercent >= thresholds[0]) return 5
    if (scorePercent >= thresholds[1]) return 4
    if (scorePercent >= thresholds[2]) return 3
    if (scorePercent >= thresholds[3]) return 2
    if (scorePercent >= thresholds[4]) return 1
    return 0
}

// ─── SM-2: Schedule Calculation ─────────────────────────────────────────────

/**
 * Standard SM-2 algorithm.
 *
 * quality >= 3  → advance the schedule (longer intervals)
 * quality  < 3  → reset (go back to day 1)
 *
 * EF update: EF' = EF + (0.1 - (5-q)(0.08 + (5-q)*0.02))
 * Minimum EF: 1.3
 */
export function calculateSM2(input: SM2Input): SM2Result {
    const q = Math.max(0, Math.min(5, input.quality))
    let rep = input.repetition
    let interval = input.interval
    let ef = input.easeFactor

    if (q >= 3) {
        if (rep === 0) {
            interval = 1
        } else if (rep === 1) {
            interval = 6
        } else {
            interval = Math.round(interval * ef)
        }
        rep += 1
    } else {
        rep = 0
        interval = 1
    }

    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ef = Math.max(1.3, Math.round(ef * 100) / 100)

    const due = new Date()
    due.setUTCDate(due.getUTCDate() + interval)
    const dueDate = due.toISOString().split('T')[0]

    return { repetition: rep, interval, easeFactor: ef, dueDate }
}

// ─── Global Scheduler: Priority Score ───────────────────────────────────────

/**
 * Compute how urgently a topic should be studied.
 *
 * Priority = w1*(1 − mastery/100) + w2*deadlinePressure + w3*lowPracticePenalty
 *
 * Higher = study sooner.
 */
export function calculatePriorityScore(
    finalMastery: number,
    dueDateStr: string,
    confidence: number,
    weights = { weakness: 0.65, deadline: 0.25, practice: 0.10 },
): PriorityResult {
    const weaknessComponent = 1 - finalMastery / 100

    const todayStr = new Date().toISOString().split('T')[0]
    const todayMs = Date.UTC(+todayStr.slice(0, 4), +todayStr.slice(5, 7) - 1, +todayStr.slice(8, 10))
    const dueMs = Date.UTC(+dueDateStr.slice(0, 4), +dueDateStr.slice(5, 7) - 1, +dueDateStr.slice(8, 10))
    const daysUntilDue = Math.floor((dueMs - todayMs) / (1000 * 60 * 60 * 24))
    const deadlinePressure = Math.max(0, Math.min(1, 1 - daysUntilDue / 14))

    const lowPracticePenalty = 1 - confidence

    const priority =
        weights.weakness * weaknessComponent +
        weights.deadline * deadlinePressure +
        weights.practice * lowPracticePenalty

    return {
        priorityScore: Math.round(Math.max(0, Math.min(1, priority)) * 10000) / 10000,
        deadlinePressure,
        lowPracticePenalty,
    }
}

// ─── Mastery Decay ──────────────────────────────────────────────────────────

/**
 * Apply time-based decay to a mastery score when a concept is overdue.
 *
 * The idea: if you haven't reviewed something past its SM-2 due date,
 * your *displayed* mastery gradually decreases to encourage review.
 * The stored value stays the same — this is display-only.
 *
 * Formula:
 *   if not overdue → return mastery unchanged
 *   overdueFactor = min(1, daysOverdue / (intervalDays × 3))
 *   decayedMastery = mastery × (1 - maxDecay × overdueFactor)
 *
 * - Max 15% penalty even for severely overdue items
 * - Longer intervals (well-learned items) are more forgiving
 * - Items only 1-2 days late barely decay at all
 */
export function calculateMasteryWithDecay(
    mastery: number,
    dueDate: string | null,
    intervalDays: number,
    maxDecay = 0.15,
): number {
    if (!dueDate) return mastery

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const due = new Date(dueDate + 'T00:00:00Z')
    const diffMs = today.getTime() - due.getTime()

    // Not overdue — no decay
    if (diffMs <= 0) return mastery

    const daysOverdue = diffMs / (1000 * 60 * 60 * 24)
    // Scale: use 3× the interval as the full-decay horizon
    const horizon = Math.max(3, intervalDays * 3)
    const overdueFactor = Math.min(1, daysOverdue / horizon)

    const decayed = mastery * (1 - maxDecay * overdueFactor)
    return Math.round(Math.max(0, decayed) * 100) / 100
}

/**
 * Get mastery level using the decayed mastery score.
 * Wraps getMasteryLevel with the decayed value and original confidence.
 */
export function getMasteryLevelWithDecay(
    mastery: number,
    confidence: number,
    dueDate: string | null,
    intervalDays: number,
): { displayMastery: number; displayLevel: MasteryLevel } {
    const displayMastery = calculateMasteryWithDecay(mastery, dueDate, intervalDays)
    const displayLevel = getMasteryLevel(displayMastery, confidence)
    return { displayMastery, displayLevel }
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

/** Returns today's date as a UTC YYYY-MM-DD string, avoiding timezone drift. */
export function todayUTC(): string {
    return new Date().toISOString().split('T')[0]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute per-concept score from a set of question attempt logs
 * for SM-2 quality mapping. Returns the accuracy percentage for
 * this concept within the quiz.
 */
export function conceptAccuracyPercent(
    logs: { is_correct: boolean }[],
): number {
    if (logs.length === 0) return 0
    const correct = logs.filter((l) => l.is_correct).length
    return Math.round((correct / logs.length) * 100)
}
