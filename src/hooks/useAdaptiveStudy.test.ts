import { describe, expect, it } from 'vitest'

import { resolveAdaptiveQuizTaskTitle } from '../lib/adaptiveQuizNaming'

describe('resolveAdaptiveQuizTaskTitle', () => {
    it('uses linked quiz title when available', () => {
        expect(resolveAdaptiveQuizTaskTitle({
            linkedQuizTitle: 'Quiz: Intro to Biology',
            documentTitle: 'Biology Notes',
        })).toBe('Quiz: Intro to Biology')
    })

    it('falls back to adaptive label when linked title is missing', () => {
        expect(resolveAdaptiveQuizTaskTitle({
            linkedQuizTitle: null,
            documentTitle: 'Biology Notes',
        })).toBe('Adaptive quiz for Biology Notes')
    })
})
