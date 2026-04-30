export function isReviewedOnDate(lastReviewedAt: string | null | undefined, dateIso: string): boolean {
    if (!lastReviewedAt) return false
    return lastReviewedAt.split('T')[0] === dateIso
}
