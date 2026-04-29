/**
 * Unit Tests — learningAlgorithms.ts
 *
 * Tests every pure function in the learning intelligence engine.
 * Run with: npx vitest run src/lib/learningAlgorithms.test.ts
 */

import { describe, it, expect } from "vitest"
import {
    calculateAttemptScore,
    calculateTopicMastery,
    calculateConfidence,
    calculateFinalMastery,
    getMasteryLevel,
    computeMastery,
    mapScoreToQuality,
    calculateSM2,
    calculatePriorityScore,
    calculateMasteryWithDecay,
    getMasteryLevelWithDecay,
    conceptAccuracyPercent,
    todayUTC,
    type AttemptLogEntry,
} from "./learningAlgorithms"


// ─── Helper ─────────────────────────────────────────────────────────────────

function makeAttempt(
    isCorrect: boolean,
    difficulty: "beginner" | "intermediate" | "advanced" = "intermediate",
    timeSpent: number | null = null,
): AttemptLogEntry {
    return {
        is_correct: isCorrect,
        question_difficulty: difficulty,
        time_spent_seconds: timeSpent,
        attempted_at: new Date().toISOString(),
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// WMS Step 1: calculateAttemptScore
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateAttemptScore", () => {
    it("returns 0 for incorrect answers regardless of difficulty", () => {
        expect(calculateAttemptScore(false, "beginner")).toBe(0)
        expect(calculateAttemptScore(false, "intermediate")).toBe(0)
        expect(calculateAttemptScore(false, "advanced")).toBe(0)
    })

    it("applies difficulty weights for correct answers", () => {
        expect(calculateAttemptScore(true, "beginner")).toBe(1.0)
        // intermediate = 1.1, capped at 1.0
        expect(calculateAttemptScore(true, "intermediate")).toBe(1.0)
        // advanced = 1.2, capped at 1.0
        expect(calculateAttemptScore(true, "advanced")).toBe(1.0)
    })

    it("defaults to intermediate when difficulty is null", () => {
        expect(calculateAttemptScore(true, null)).toBe(1.0)
    })

    it("applies time bonus for fast correct answers (<=15s)", () => {
        // beginner(1.0) × time(1.1) = 1.1 → capped at 1.0
        expect(calculateAttemptScore(true, "beginner", 10)).toBe(1.0)
    })

    it("applies time penalty for slow answers (>120s)", () => {
        // beginner(1.0) × time(0.85) = 0.85
        expect(calculateAttemptScore(true, "beginner", 150)).toBe(0.85)
    })

    it("applies moderate time weight for 30-60s range", () => {
        // beginner(1.0) × time(1.0) = 1.0
        expect(calculateAttemptScore(true, "beginner", 45)).toBe(1.0)
    })

    it("applies 1.05x for 15-30s range", () => {
        // beginner(1.0) × time(1.05) = 1.05 → capped at 1.0
        expect(calculateAttemptScore(true, "beginner", 20)).toBe(1.0)
    })

    it("applies 0.95x for 60-120s range", () => {
        // beginner(1.0) × time(0.95) = 0.95
        expect(calculateAttemptScore(true, "beginner", 90)).toBe(0.95)
    })

    it("ignores time when null or undefined", () => {
        expect(calculateAttemptScore(true, "beginner", null)).toBe(1.0)
        expect(calculateAttemptScore(true, "beginner", undefined)).toBe(1.0)
    })

    it("returns 0 for incorrect even with fast time", () => {
        expect(calculateAttemptScore(false, "advanced", 5)).toBe(0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// WMS Step 2+3: calculateTopicMastery
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateTopicMastery", () => {
    it("returns 0 for empty attempts array", () => {
        expect(calculateTopicMastery([])).toBe(0)
    })

    it("returns 100 for single correct attempt", () => {
        // 1 correct attempt: score=1.0, weight=1.0 → 100 × 1.0/1.0 = 100
        const attempts = [makeAttempt(true, "beginner")]
        expect(calculateTopicMastery(attempts)).toBe(100)
    })

    it("returns 0 for single incorrect attempt", () => {
        const attempts = [makeAttempt(false)]
        expect(calculateTopicMastery(attempts)).toBe(0)
    })

    it("uses only the last 3 attempts", () => {
        // 4 attempts — only the 3 most recent count (should be first 3 in array = newest first)
        const attempts = [
            makeAttempt(true),  // most recent — weight 1.0
            makeAttempt(true),  // 2nd — weight 0.85
            makeAttempt(true),  // 3rd — weight 0.70
            makeAttempt(false), // 4th — excluded
        ]
        expect(calculateTopicMastery(attempts)).toBe(100)
    })

    it("applies recency weights correctly with mixed results", () => {
        // recent=correct(1.0), older=wrong(0), oldest=correct(1.0)
        // Weighted: (1.0×1.0 + 0×0.85 + 1.0×0.70) / (1.0+0.85+0.70)
        // = 1.70 / 2.55 = 0.6667 → 66.67
        const attempts = [
            makeAttempt(true, "beginner"),
            makeAttempt(false, "beginner"),
            makeAttempt(true, "beginner"),
        ]
        const result = calculateTopicMastery(attempts)
        expect(result).toBeCloseTo(66.67, 1)
    })

    it("handles two attempts correctly", () => {
        // correct(1.0×1.0) + wrong(0×0.85) / (1.0+0.85) = 1.0/1.85 ≈ 54.05
        const attempts = [makeAttempt(true, "beginner"), makeAttempt(false)]
        const result = calculateTopicMastery(attempts)
        expect(result).toBeCloseTo(54.05, 0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// WMS Step 4: calculateConfidence
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateConfidence", () => {
    it("returns 0 for 0 attempts", () => {
        expect(calculateConfidence(0)).toBe(0)
    })

    it("returns 0.33 for 1 attempt (k=3)", () => {
        expect(calculateConfidence(1)).toBeCloseTo(0.333, 2)
    })

    it("returns 0.67 for 2 attempts (k=3)", () => {
        expect(calculateConfidence(2)).toBeCloseTo(0.667, 2)
    })

    it("returns 1.0 for 3 attempts (k=3)", () => {
        expect(calculateConfidence(3)).toBe(1.0)
    })

    it("caps at 1.0 for more than k attempts", () => {
        expect(calculateConfidence(10)).toBe(1.0)
        expect(calculateConfidence(100)).toBe(1.0)
    })

    it("respects custom k parameter", () => {
        expect(calculateConfidence(2, 5)).toBeCloseTo(0.4, 2)
        expect(calculateConfidence(5, 5)).toBe(1.0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// WMS Step 5: calculateFinalMastery
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateFinalMastery", () => {
    it("returns baseline (50) when confidence is 0", () => {
        expect(calculateFinalMastery(100, 0)).toBe(50)
        expect(calculateFinalMastery(0, 0)).toBe(50)
    })

    it("returns raw mastery when confidence is 1", () => {
        expect(calculateFinalMastery(85, 1)).toBe(85)
        expect(calculateFinalMastery(0, 1)).toBe(0)
    })

    it("blends toward baseline for partial confidence", () => {
        // 0.33 × 100 + 0.67 × 50 = 33 + 33.5 = 66.5
        const result = calculateFinalMastery(100, 0.33)
        expect(result).toBeCloseTo(66.5, 0)
    })

    it("blends correctly for low mastery with partial confidence", () => {
        // 0.67 × 20 + 0.33 × 50 = 13.4 + 16.5 = 29.9
        const result = calculateFinalMastery(20, 0.67)
        expect(result).toBeCloseTo(29.9, 0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// WMS Step 6: getMasteryLevel
// ═══════════════════════════════════════════════════════════════════════════

describe("getMasteryLevel", () => {
    it("returns 'mastered' when mastery >= 80 AND confidence >= 0.67", () => {
        expect(getMasteryLevel(80, 0.67)).toBe("mastered")
        expect(getMasteryLevel(95, 1.0)).toBe("mastered")
    })

    it("returns 'developing' when mastery >= 80 but confidence < 0.67", () => {
        // High mastery but not enough data — can't be mastered
        expect(getMasteryLevel(85, 0.33)).toBe("developing")
    })

    it("returns 'developing' for mastery 60-79", () => {
        expect(getMasteryLevel(60, 1.0)).toBe("developing")
        expect(getMasteryLevel(79, 1.0)).toBe("developing")
    })

    it("returns 'needs_review' for mastery < 60", () => {
        expect(getMasteryLevel(59, 1.0)).toBe("needs_review")
        expect(getMasteryLevel(0, 0)).toBe("needs_review")
        expect(getMasteryLevel(30, 0.5)).toBe("needs_review")
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// WMS Full Pipeline: computeMastery
// ═══════════════════════════════════════════════════════════════════════════

describe("computeMastery", () => {
    it("returns needs_review for a single wrong answer", () => {
        const result = computeMastery([makeAttempt(false)])
        expect(result.masteryLevel).toBe("needs_review")
        expect(result.confidence).toBeCloseTo(0.333, 2)
        // finalMastery = 0.33 × 0 + 0.67 × 50 = 33.5
        expect(result.finalMastery).toBeCloseTo(33.33, 0)
    })

    it("returns developing for a single correct answer", () => {
        const result = computeMastery([makeAttempt(true, "beginner")])
        expect(result.masteryLevel).toBe("developing")
        expect(result.confidence).toBeCloseTo(0.333, 2)
        // finalMastery = 0.33 × 100 + 0.67 × 50 = 66.67
        expect(result.finalMastery).toBeCloseTo(66.67, 0)
    })

    it("returns mastered after 3 consecutive correct answers", () => {
        const attempts = [
            makeAttempt(true, "beginner"),
            makeAttempt(true, "beginner"),
            makeAttempt(true, "beginner"),
        ]
        const result = computeMastery(attempts)
        expect(result.masteryLevel).toBe("mastered")
        expect(result.confidence).toBe(1.0)
        expect(result.finalMastery).toBe(100)
    })

    it("returns developing for 2 correct answers (confidence ≈ 0.667 < 0.67 threshold)", () => {
        const attempts = [
            makeAttempt(true, "beginner"),
            makeAttempt(true, "beginner"),
        ]
        const result = computeMastery(attempts)
        expect(result.confidence).toBeCloseTo(0.667, 2)
        // finalMastery ≈ 0.667 × 100 + 0.333 × 50 = 83.35
        // BUT confidence 0.667 < 0.67 threshold → developing (not mastered)
        expect(result.finalMastery).toBeCloseTo(83.33, 0)
        expect(result.masteryLevel).toBe("developing")
    })

    it("handles recovery scenario (wrong then correct)", () => {
        const attempts = [
            makeAttempt(true, "beginner"),  // most recent — correct
            makeAttempt(false),              // older — wrong
        ]
        const result = computeMastery(attempts)
        // rawMastery from calculateTopicMastery: (1.0×1.0 + 0×0.85)/(1.0+0.85) ≈ 54.05
        // confidence = 2/3 ≈ 0.67
        // finalMastery ≈ 0.67 × 54.05 + 0.33 × 50 ≈ 52.71
        expect(result.masteryLevel).toBe("needs_review")
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// SM-2: mapScoreToQuality
// ═══════════════════════════════════════════════════════════════════════════

describe("mapScoreToQuality", () => {
    it("maps >= 90 to quality 5", () => {
        expect(mapScoreToQuality(90)).toBe(5)
        expect(mapScoreToQuality(100)).toBe(5)
    })

    it("maps 80-89 to quality 4", () => {
        expect(mapScoreToQuality(80)).toBe(4)
        expect(mapScoreToQuality(89)).toBe(4)
    })

    it("maps 65-79 to quality 3", () => {
        expect(mapScoreToQuality(65)).toBe(3)
        expect(mapScoreToQuality(79)).toBe(3)
    })

    it("maps 50-64 to quality 2", () => {
        expect(mapScoreToQuality(50)).toBe(2)
        expect(mapScoreToQuality(64)).toBe(2)
    })

    it("maps 30-49 to quality 1", () => {
        expect(mapScoreToQuality(30)).toBe(1)
        expect(mapScoreToQuality(49)).toBe(1)
    })

    it("maps < 30 to quality 0", () => {
        expect(mapScoreToQuality(29)).toBe(0)
        expect(mapScoreToQuality(0)).toBe(0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// SM-2: calculateSM2
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateSM2", () => {
    it("sets interval to 1 day on first successful review", () => {
        const result = calculateSM2({ quality: 4, repetition: 0, interval: 0, easeFactor: 2.5 })
        expect(result.interval).toBe(1)
        expect(result.repetition).toBe(1)
    })

    it("sets interval to 6 days on second successful review", () => {
        const result = calculateSM2({ quality: 4, repetition: 1, interval: 1, easeFactor: 2.5 })
        expect(result.interval).toBe(6)
        expect(result.repetition).toBe(2)
    })

    it("multiplies interval by ease factor on third+ review", () => {
        const result = calculateSM2({ quality: 4, repetition: 2, interval: 6, easeFactor: 2.5 })
        expect(result.interval).toBe(15) // 6 × 2.5 = 15
        expect(result.repetition).toBe(3)
    })

    it("resets to interval=1, repetition=0 on quality < 3", () => {
        const result = calculateSM2({ quality: 1, repetition: 5, interval: 30, easeFactor: 2.5 })
        expect(result.interval).toBe(1)
        expect(result.repetition).toBe(0)
    })

    it("never lets ease factor go below 1.3", () => {
        const result = calculateSM2({ quality: 0, repetition: 0, interval: 1, easeFactor: 1.3 })
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
    })

    it("increases ease factor for quality 5", () => {
        const result = calculateSM2({ quality: 5, repetition: 2, interval: 6, easeFactor: 2.5 })
        // EF' = 2.5 + (0.1 - 0 × (0.08 + 0 × 0.02)) = 2.5 + 0.1 = 2.6
        expect(result.easeFactor).toBe(2.6)
    })

    it("decreases ease factor for quality 3", () => {
        const result = calculateSM2({ quality: 3, repetition: 2, interval: 6, easeFactor: 2.5 })
        // EF' = 2.5 + (0.1 - 2×(0.08 + 2×0.02)) = 2.5 + (0.1 - 0.24) = 2.36
        expect(result.easeFactor).toBe(2.36)
    })

    it("clamps quality to 0-5 range", () => {
        const low = calculateSM2({ quality: -1, repetition: 0, interval: 0, easeFactor: 2.5 })
        expect(low.repetition).toBe(0) // quality → 0, which is < 3, so resets

        const high = calculateSM2({ quality: 10, repetition: 0, interval: 0, easeFactor: 2.5 })
        expect(high.repetition).toBe(1) // quality → 5, which is >= 3, so advances
    })

    it("produces a valid future due date string", () => {
        const result = calculateSM2({ quality: 4, repetition: 0, interval: 0, easeFactor: 2.5 })
        expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        const dueDate = new Date(result.dueDate + "T00:00:00Z")
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        expect(dueDate.getTime()).toBeGreaterThan(today.getTime())
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// SM-2 Full Progression Sequence
// ═══════════════════════════════════════════════════════════════════════════

describe("SM-2 progression sequence", () => {
    it("follows expected interval pattern for consistent quality 4", () => {
        let state = { quality: 4, repetition: 0, interval: 0, easeFactor: 2.5 }

        // Review 1: interval → 1
        let result = calculateSM2(state)
        expect(result.interval).toBe(1)
        state = { quality: 4, ...result }

        // Review 2: interval → 6
        result = calculateSM2(state)
        expect(result.interval).toBe(6)
        state = { quality: 4, ...result }

        // Review 3: interval → 6 × EF ≈ 14
        result = calculateSM2(state)
        expect(result.interval).toBeGreaterThanOrEqual(13)
        expect(result.interval).toBeLessThanOrEqual(15)
    })

    it("resets and rebuilds after a failure", () => {
        // Start with some progress
        let state = { quality: 4, repetition: 2, interval: 6, easeFactor: 2.5 }
        let result = calculateSM2(state)
        expect(result.repetition).toBe(3)

        // Fail → reset
        state = { quality: 1, ...result }
        result = calculateSM2(state)
        expect(result.interval).toBe(1)
        expect(result.repetition).toBe(0)

        // Recover
        state = { quality: 4, ...result }
        result = calculateSM2(state)
        expect(result.interval).toBe(1)
        expect(result.repetition).toBe(1)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// Global Scheduler: calculatePriorityScore
// ═══════════════════════════════════════════════════════════════════════════

describe("calculatePriorityScore", () => {
    it("gives high priority to low mastery + overdue + low confidence", () => {
        // Due yesterday
        const yesterday = new Date()
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        const overdueStr = yesterday.toISOString().split("T")[0]

        const result = calculatePriorityScore(20, overdueStr, 0.33)
        // weakness = 0.65 × (1 - 0.2) = 0.52
        // deadline ≈ 0.25 × 1.0 = 0.25
        // practice = 0.10 × 0.67 = 0.067
        expect(result.priorityScore).toBeGreaterThan(0.7)
    })

    it("gives low priority to high mastery + not due + high confidence", () => {
        // Due in 20 days
        const future = new Date()
        future.setUTCDate(future.getUTCDate() + 20)
        const futureStr = future.toISOString().split("T")[0]

        const result = calculatePriorityScore(95, futureStr, 1.0)
        // weakness = 0.65 × 0.05 = 0.0325
        // deadline = 0.25 × 0 = 0
        // practice = 0.10 × 0 = 0
        expect(result.priorityScore).toBeLessThan(0.1)
    })

    it("returns deadline pressure of 1 for overdue items", () => {
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 5)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculatePriorityScore(50, pastStr, 0.5)
        expect(result.deadlinePressure).toBe(1)
    })

    it("returns deadline pressure of 0 for far-future items", () => {
        const future = new Date()
        future.setUTCDate(future.getUTCDate() + 30)
        const futureStr = future.toISOString().split("T")[0]

        const result = calculatePriorityScore(50, futureStr, 0.5)
        expect(result.deadlinePressure).toBe(0)
    })

    it("clamps priority score between 0 and 1", () => {
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 100)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculatePriorityScore(0, pastStr, 0)
        expect(result.priorityScore).toBeLessThanOrEqual(1)
        expect(result.priorityScore).toBeGreaterThanOrEqual(0)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

describe("conceptAccuracyPercent", () => {
    it("returns 0 for empty array", () => {
        expect(conceptAccuracyPercent([])).toBe(0)
    })

    it("returns 100 when all correct", () => {
        expect(conceptAccuracyPercent([
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
        ])).toBe(100)
    })

    it("returns 0 when all wrong", () => {
        expect(conceptAccuracyPercent([
            { is_correct: false },
            { is_correct: false },
        ])).toBe(0)
    })

    it("returns correct percentage for mixed results", () => {
        expect(conceptAccuracyPercent([
            { is_correct: true },
            { is_correct: false },
            { is_correct: true },
            { is_correct: false },
        ])).toBe(50)
    })
})


describe("todayUTC", () => {
    it("returns a YYYY-MM-DD string", () => {
        const result = todayUTC()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("matches today's local app date", () => {
        const now = new Date()
        const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        expect(todayUTC()).toBe(expected)
    })
})


// ═══════════════════════════════════════════════════════════════════════════
// Mastery Decay
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateMasteryWithDecay", () => {
    it("returns mastery unchanged when not overdue", () => {
        const future = new Date()
        future.setUTCDate(future.getUTCDate() + 5)
        const futureStr = future.toISOString().split("T")[0]

        expect(calculateMasteryWithDecay(90, futureStr, 6)).toBe(90)
    })

    it("returns mastery unchanged when due date is today", () => {
        const todayStr = new Date().toISOString().split("T")[0]
        expect(calculateMasteryWithDecay(80, todayStr, 6)).toBe(80)
    })

    it("returns mastery unchanged when due date is null", () => {
        expect(calculateMasteryWithDecay(85, null, 6)).toBe(85)
    })

    it("applies partial decay when slightly overdue", () => {
        // Overdue by 3 days, interval=6 → horizon = 18
        // overdueFactor = 3/18 = 0.167
        // decayed = 90 × (1 - 0.15 × 0.167) = 90 × 0.975 ≈ 87.75
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 3)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculateMasteryWithDecay(90, pastStr, 6)
        expect(result).toBeGreaterThan(85)
        expect(result).toBeLessThan(90)
    })

    it("applies stronger decay when severely overdue", () => {
        // Overdue by 30 days, interval=6 → horizon = 18
        // overdueFactor = min(1, 30/18) = 1.0
        // decayed = 90 × (1 - 0.15 × 1.0) = 90 × 0.85 = 76.5
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 30)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculateMasteryWithDecay(90, pastStr, 6)
        expect(result).toBeCloseTo(76.5, 0)
    })

    it("caps decay at maxDecay (15% by default)", () => {
        // Even 100 days overdue shouldn't reduce more than 15%
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 100)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculateMasteryWithDecay(100, pastStr, 6)
        // 100 × 0.85 = 85 minimum
        expect(result).toBeGreaterThanOrEqual(85)
    })

    it("is more forgiving for longer intervals (well-learned items)", () => {
        // Same 10 days overdue, but interval=30 vs interval=3
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 10)
        const pastStr = past.toISOString().split("T")[0]

        const shortInterval = calculateMasteryWithDecay(90, pastStr, 3)  // horizon=9
        const longInterval = calculateMasteryWithDecay(90, pastStr, 30)  // horizon=90

        // Long interval should decay LESS
        expect(longInterval).toBeGreaterThan(shortInterval)
    })

    it("never returns below 0", () => {
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 365)
        const pastStr = past.toISOString().split("T")[0]

        const result = calculateMasteryWithDecay(5, pastStr, 1, 0.99)
        expect(result).toBeGreaterThanOrEqual(0)
    })
})


describe("getMasteryLevelWithDecay", () => {
    it("downgrades mastered to developing when heavily overdue", () => {
        // mastery=82, confidence=1.0 → normally "mastered"
        // But 30 days overdue with interval=6 → decay to ~69.7 → "developing"
        const past = new Date()
        past.setUTCDate(past.getUTCDate() - 30)
        const pastStr = past.toISOString().split("T")[0]

        const { displayLevel, displayMastery } = getMasteryLevelWithDecay(82, 1.0, pastStr, 6)
        expect(displayMastery).toBeLessThan(80)
        expect(displayLevel).toBe("developing")
    })

    it("keeps mastered level when not overdue", () => {
        const future = new Date()
        future.setUTCDate(future.getUTCDate() + 5)
        const futureStr = future.toISOString().split("T")[0]

        const { displayLevel, displayMastery } = getMasteryLevelWithDecay(90, 1.0, futureStr, 6)
        expect(displayMastery).toBe(90)
        expect(displayLevel).toBe("mastered")
    })
})
