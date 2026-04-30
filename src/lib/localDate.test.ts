import { describe, expect, it } from 'vitest'

import { localDateFromTimestamp } from './localDate'

describe('localDateFromTimestamp', () => {
    it('normalizes timestamps to local calendar date', () => {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset()

        if (timezoneOffsetMinutes === 0) {
            // In UTC environments there is no local/UTC day boundary drift.
            expect(localDateFromTimestamp('2026-05-01T23:30:00.000Z')).toBe('2026-05-01')
            return
        }

        const localBoundaryCandidate = timezoneOffsetMinutes < 0
            ? new Date(2026, 4, 2, 0, 30, 0)
            : new Date(2026, 4, 2, 23, 30, 0)

        const isoTimestamp = localBoundaryCandidate.toISOString()
        const expectedLocalDate = [
            localBoundaryCandidate.getFullYear(),
            String(localBoundaryCandidate.getMonth() + 1).padStart(2, '0'),
            String(localBoundaryCandidate.getDate()).padStart(2, '0'),
        ].join('-')

        expect(localDateFromTimestamp(isoTimestamp)).toBe(expectedLocalDate)
    })
})
