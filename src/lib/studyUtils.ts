import type { Concept } from '@/hooks/useConcepts'

export function cleanDisplayText(value: string): string {
    let text = value || ''
    // Strip residual mojibake patterns
    text = text.replace(/\u00e2[\u0080-\u00bf]*/g, ' ')
    text = text.replace(/[\u00c2\u00c3][\u0080-\u00bf]/g, ' ')
    return text.replace(/\s+/g, ' ').trim()
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitIntoSentences(text: string): string[] {
    const normalized = cleanDisplayText(text)
    if (!normalized) return []
    const matches = normalized.match(/[^.!?]+[.!?]+/g)
    const sentences = matches ? [...matches] : []
    const remainder = normalized.replace(/[^.!?]+[.!?]+/g, '').trim()
    if (remainder) sentences.push(remainder)
    return sentences.map((s) => s.trim()).filter(Boolean)
}

export function buildKeywordPool(concepts: Concept[] | undefined): string[] {
    if (!concepts || concepts.length === 0) return []
    const seen = new Set<string>()
    const pool: string[] = []

    for (const concept of concepts) {
        const candidates = [concept.name, ...(concept.keywords || [])]
        for (const raw of candidates) {
            const cleaned = cleanDisplayText(raw || '')
            if (!cleaned || cleaned.length < 3) continue
            const lower = cleaned.toLowerCase()
            if (lower.includes('http') || lower.includes('www')) continue
            if (seen.has(lower)) continue
            seen.add(lower)
            pool.push(cleaned)
            if (pool.length >= 15) return pool
        }
    }
    return pool
}
