import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type AdaptiveStudyTaskType = 'quiz' | 'flashcards' | 'review'
export type AdaptiveStudyTaskReason = 'due_today' | 'needs_review' | 'developing'
export type AdaptiveStudyTaskStatus = 'ready' | 'needs_generation' | 'generating'

interface AdaptiveStudyTaskRow {
    id: string
    user_id: string
    document_id: string
    task_key: string
    task_type: AdaptiveStudyTaskType
    status: 'pending_generation' | 'generating' | 'ready' | 'archived'
    reason: AdaptiveStudyTaskReason | null
    scheduled_date: string | null
    priority_score: number
    concept_ids: string[]
    concept_count: number
    linked_quiz_id: string | null
    metadata: Record<string, unknown> | null
    last_synced_at: string
    created_at: string
    updated_at: string
}

export interface AdaptiveStudyTask {
    id: string
    type: AdaptiveStudyTaskType
    status: AdaptiveStudyTaskStatus
    reason: AdaptiveStudyTaskReason
    documentId: string
    documentTitle: string
    conceptIds: string[]
    conceptNames: string[]
    scheduledDate: string
    priorityScore: number
    count: number
    title: string
    description: string
    quizId?: string
}

export const adaptiveStudyKeys = {
    all: ['adaptive-study'] as const,
}

function reasonRank(reason: AdaptiveStudyTaskReason) {
    switch (reason) {
        case 'due_today':
            return 3
        case 'needs_review':
            return 2
        default:
            return 1
    }
}

function buildConceptSummary(conceptNames: string[], limit: number) {
    const visibleNames = conceptNames.filter(Boolean).slice(0, limit)
    if (visibleNames.length === 0) return 'your priority concepts'
    if (conceptNames.length > limit) return `${visibleNames.join(', ')} and more`
    return visibleNames.join(', ')
}

function mapTaskStatus(status: AdaptiveStudyTaskRow['status']): AdaptiveStudyTaskStatus {
    if (status === 'pending_generation') return 'needs_generation'
    if (status === 'generating') return 'generating'
    return 'ready'
}

export function useAdaptiveStudyTasks() {
    const { user } = useAuth()

    return useQuery({
        queryKey: adaptiveStudyKeys.all,
        queryFn: async ({ signal }): Promise<AdaptiveStudyTask[]> => {
            if (!user) return []

            const { data: taskRows, error: taskError } = await supabase
                .from('adaptive_study_tasks')
                .select('*')
                .eq('user_id', user.id)
                .neq('status', 'archived')
                .order('scheduled_date', { ascending: true })
                .order('priority_score', { ascending: false })
                .abortSignal(signal)

            if (taskError) throw new Error(taskError.message)
            if (!taskRows || taskRows.length === 0) return []

            const rows = taskRows as AdaptiveStudyTaskRow[]
            const documentIds = [...new Set(rows.map((row) => row.document_id))]
            const conceptIds = [...new Set(rows.flatMap((row) => row.concept_ids || []))]

            const [docsRes, conceptsRes] = await Promise.all([
                supabase
                    .from('documents')
                    .select('id, title')
                    .in('id', documentIds)
                    .abortSignal(signal),
                conceptIds.length > 0
                    ? supabase
                        .from('concepts')
                        .select('id, name')
                        .in('id', conceptIds)
                        .abortSignal(signal)
                    : Promise.resolve({
                        data: [] as { id: string; name: string }[],
                        error: null,
                    }),
            ])

            if (docsRes.error) throw new Error(docsRes.error.message)
            if (conceptsRes.error) throw new Error(conceptsRes.error.message)

            const docsById = new Map((docsRes.data || []).map((doc) => [doc.id, doc.title]))
            const conceptsById = new Map((conceptsRes.data || []).map((concept) => [concept.id, concept.name]))

            const tasks = rows.map((row) => {
                const metadata = row.metadata || {}
                const conceptNames = (row.concept_ids || []).map((id) => conceptsById.get(id) || 'Unknown concept')
                const documentTitle = docsById.get(row.document_id) || 'Untitled document'
                const dueCount = Number(metadata.dueCount ?? 0)
                const totalCount = Number(metadata.totalCount ?? 0)
                const questionCount = Number(metadata.questionCount ?? 0)
                const reason = row.reason || 'developing'

                let count = row.concept_count
                let title = ''
                let description = ''

                if (row.task_type === 'quiz') {
                    count = questionCount || Math.max(5, Math.min(12, row.concept_count * 2))
                    title = `Adaptive quiz for ${documentTitle}`
                    description = `Focused on ${buildConceptSummary(conceptNames, 3)}.`
                } else if (row.task_type === 'flashcards') {
                    count = totalCount || row.concept_count
                    title = `Flashcard review for ${documentTitle}`
                    description = dueCount > 0
                        ? `${dueCount} due card${dueCount === 1 ? '' : 's'} linked to your weak or due concepts.`
                        : `${count} flashcard${count === 1 ? '' : 's'} linked to weak or developing concepts.`
                } else {
                    count = row.concept_count
                    title = `Concept review for ${documentTitle}`
                    description = `Review ${buildConceptSummary(conceptNames, 4)}.`
                }

                return {
                    id: row.id,
                    type: row.task_type,
                    status: mapTaskStatus(row.status),
                    reason,
                    documentId: row.document_id,
                    documentTitle,
                    conceptIds: row.concept_ids || [],
                    conceptNames,
                    scheduledDate: row.scheduled_date || new Date().toISOString().split('T')[0],
                    priorityScore: Number(row.priority_score),
                    count,
                    title,
                    description,
                    quizId: row.linked_quiz_id || undefined,
                } satisfies AdaptiveStudyTask
            })

            return tasks.sort((a, b) => {
                if (a.scheduledDate !== b.scheduledDate) {
                    return a.scheduledDate.localeCompare(b.scheduledDate)
                }
                if (reasonRank(a.reason) !== reasonRank(b.reason)) {
                    return reasonRank(b.reason) - reasonRank(a.reason)
                }
                if (a.priorityScore !== b.priorityScore) {
                    return b.priorityScore - a.priorityScore
                }
                const typeOrder = { quiz: 0, flashcards: 1, review: 2 }
                return typeOrder[a.type] - typeOrder[b.type]
            })
        },
        enabled: !!user,
        refetchInterval: (query) => {
            const tasks = query.state.data as AdaptiveStudyTask[] | undefined
            return tasks?.some((task) => task.status === 'generating') ? 4000 : false
        },
    })
}

export function useRescheduleAdaptiveStudyTask() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (input: { taskId: string; newScheduledDate: string }) => {
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase.rpc('reschedule_adaptive_study_task', {
                p_task_id: input.taskId,
                p_new_date: input.newScheduledDate,
            })

            if (error) throw new Error(error.message)
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
        },
    })
}
