export type PreparationLabel = "Strong" | "Moderate" | "Limited" | "Not enough data"

export interface DocumentEstimate {
    coverage: number
    performance: number
    hasTarget: boolean
    label: PreparationLabel
    note: string | null
}

export interface GlobalEstimate {
    overallCoverage: number
    overallPerformance: number
    label: PreparationLabel
    note: string | null
}

function deriveLabel(coverage: number, performance: number): PreparationLabel {
    if (coverage < 0.25) return "Not enough data"
    if (coverage >= 0.60 && performance >= 80) return "Strong"
    if (coverage >= 0.40 && performance >= 60) return "Moderate"
    return "Limited"
}

/**
 * Per-document preparation estimate.
 * @param totalConcepts  total concepts extracted for this document
 * @param attemptedConcepts  concepts the student has attempted (total_attempts > 0)
 * @param avgMastery  average display_mastery_score of attempted concepts (0-100)
 * @param hasTarget  whether the document has an exam_date, deadline, or surfaced study goal
 */
export function computeDocumentEstimate(
    totalConcepts: number,
    attemptedConcepts: number,
    avgMastery: number,
    hasTarget: boolean,
): DocumentEstimate {
    if (totalConcepts === 0 || attemptedConcepts === 0) {
        return { coverage: 0, performance: 0, hasTarget, label: "Not enough data", note: null }
    }

    const coverage = attemptedConcepts / totalConcepts
    const performance = avgMastery

    const label = deriveLabel(coverage, performance)
    const note = !hasTarget ? "No target set" : null

    return { coverage, performance, hasTarget, label, note }
}

/**
 * Global preparation estimate across all documents.
 * @param totalConcepts  total concepts across all documents
 * @param attemptedConcepts  total attempted concepts across all documents
 * @param avgMastery  average mastery across all attempted concepts (0-100)
 */
export function computeGlobalEstimate(
    totalConcepts: number,
    attemptedConcepts: number,
    avgMastery: number,
): GlobalEstimate {
    if (totalConcepts === 0 || attemptedConcepts === 0) {
        return { overallCoverage: 0, overallPerformance: 0, label: "Not enough data", note: null }
    }

    const overallCoverage = attemptedConcepts / totalConcepts
    const overallPerformance = avgMastery

    const label = deriveLabel(overallCoverage, overallPerformance)
    const note = overallCoverage < 0.25
        ? "Study more concepts for a better picture"
        : null

    return { overallCoverage, overallPerformance, label, note }
}
