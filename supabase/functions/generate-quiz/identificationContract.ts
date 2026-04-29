export const IDENTIFICATION_MAX_WORDS = 8
export const IDENTIFICATION_MAX_CHARS = 80

const IDENTIFICATION_LONG_FORM_PROMPT_RE = /^(explain|describe|compare|analyze|why|how)\b/i
const IDENTIFICATION_SENTENCE_MARKER_RE = /[.!?]|[,;:]/
const GENERIC_IDENTIFICATION_PROMPT_RE = /\b(what|which|identify|name)\b.*\b(term|concept|topic|passage|statement|description)\b/i

export interface IdentificationContractQuestion {
    chunk_id: string
    question_type: string
    question_text: string
    options?: string[] | null
    correct_answer: string
    difficulty_label: string
    explanation?: string
    question_context?: string | null
}

export function isIdentificationAnswerContractValid(answer: string): boolean {
    const trimmed = answer.trim()
    if (!trimmed) return false
    if (trimmed.length > IDENTIFICATION_MAX_CHARS) return false
    if (trimmed.split(/\s+/).filter(Boolean).length > IDENTIFICATION_MAX_WORDS) return false
    if (IDENTIFICATION_SENTENCE_MARKER_RE.test(trimmed)) return false
    return true
}

function hasUsefulQuestionContext(context: string | null | undefined): boolean {
    const trimmed = (context || '').trim()
    return trimmed.length >= 25 && /\b(is|are|was|were|has|have|can|will|does|do|means|refers|uses|enables|provides|introduce|introduces)\b/i.test(trimmed)
}

export function isIdentificationPromptContractValid(prompt: string, questionContext?: string | null): boolean {
    const trimmed = prompt.trim()
    if (IDENTIFICATION_LONG_FORM_PROMPT_RE.test(trimmed)) return false
    if (GENERIC_IDENTIFICATION_PROMPT_RE.test(trimmed) && !hasUsefulQuestionContext(questionContext)) return false
    return true
}

export function filterInvalidIdentificationQuestions<T extends IdentificationContractQuestion>(questions: T[]): T[] {
    return questions.filter((question) => {
        if (question.question_type !== "identification") {
            return true
        }

        return isIdentificationAnswerContractValid(question.correct_answer)
            && isIdentificationPromptContractValid(question.question_text, question.question_context)
    })
}
