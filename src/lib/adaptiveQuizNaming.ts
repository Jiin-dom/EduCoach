export function resolveAdaptiveQuizTaskTitle(params: {
    linkedQuizTitle?: string | null
    documentTitle: string
}) {
    const linkedQuizTitle = String(params.linkedQuizTitle || '').trim()
    if (linkedQuizTitle.length > 0) return linkedQuizTitle
    return `Adaptive quiz for ${params.documentTitle}`
}
