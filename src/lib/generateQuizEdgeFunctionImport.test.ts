import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const edgeFunctionPath = resolve(process.cwd(), 'supabase/functions/generate-quiz/index.ts')

describe('generate-quiz edge function imports', () => {
    test('imports helper functions it calls from quizAllocation', () => {
        const source = readFileSync(edgeFunctionPath, 'utf8')
        const usesCountQuestionsByType = source.includes('countQuestionsByType(')
        const importMatch = source.match(/import\s*{\s*([^}]+)\s*}\s*from\s*["']\.\/quizAllocation\.ts["']/)

        expect(usesCountQuestionsByType).toBe(true)
        expect(importMatch?.[1]).toBeDefined()

        const importedNames = importMatch![1]
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)

        expect(importedNames).toContain('computeBalancedQuizTypeTargets')
        expect(importedNames).toContain('countQuestionsByType')
    })
})
