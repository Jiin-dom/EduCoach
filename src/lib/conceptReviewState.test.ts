import { describe, expect, it } from 'vitest'
import { isReviewedOnDate } from './conceptReviewState'

describe('isReviewedOnDate', () => {
    it('treats a concept reviewed on the selected date as reviewed today', () => {
        expect(isReviewedOnDate('2026-04-30T09:15:00.000Z', '2026-04-30')).toBe(true)
    })

    it('does not treat missing or older review dates as reviewed today', () => {
        expect(isReviewedOnDate(null, '2026-04-30')).toBe(false)
        expect(isReviewedOnDate('2026-04-29T23:59:00.000Z', '2026-04-30')).toBe(false)
    })
})
