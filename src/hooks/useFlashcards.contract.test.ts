import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, 'useFlashcards.ts'), 'utf8')

describe('useReviewFlashcard contract', () => {
    it('keeps flashcard ratings card-scoped instead of recomputing concept mastery', () => {
        expect(source).toContain(".from('flashcards')")
        expect(source).toContain('.update(updates)')
        expect(source).not.toContain("source_type: 'flashcard'")
        expect(source).not.toContain(".from('question_attempt_log')")
        expect(source).not.toContain('recomputeConceptMastery(')
    })
})
