/**
 * useStudyGoals Hook
 *
 * React Query hooks for the study_goals table.
 * Provides CRUD operations and auto-computed progress from existing mastery data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─── Types ───────────────────────────────────────────────────────────────────

export type GoalType = 'topic_mastery' | 'quiz_count' | 'overall_mastery'

export interface StudyGoal {
    id: string
    user_id: string
    title: string
    goal_type: GoalType
    target_value: number
    concept_id: string | null
    document_id: string | null
    quiz_id: string | null
    deadline: string | null
    is_completed: boolean
    completed_at: string | null
    created_at: string
    updated_at: string
}

export interface CreateGoalInput {
    title: string
    goal_type: GoalType
    target_value: number
    concept_id?: string | null
    document_id?: string | null
    quiz_id?: string | null
    deadline?: string | null
}

export interface UpdateGoalInput {
    id: string
    is_completed?: boolean
    completed_at?: string | null
    title?: string
    target_value?: number
    deadline?: string | null
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const studyGoalKeys = {
    all: ['study_goals'] as const,
    list: () => [...studyGoalKeys.all, 'list'] as const,
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useStudyGoals() {
    const { user } = useAuth()

    return useQuery({
        queryKey: studyGoalKeys.list(),
        queryFn: async (): Promise<StudyGoal[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('study_goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw new Error(error.message)
            return data ?? []
        },
        enabled: !!user,
    })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateGoal() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateGoalInput): Promise<StudyGoal> => {
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('study_goals')
                .insert({
                    user_id: user.id,
                    title: input.title,
                    goal_type: input.goal_type,
                    target_value: input.target_value,
                    concept_id: input.concept_id ?? null,
                    document_id: input.document_id ?? null,
                    quiz_id: input.quiz_id ?? null,
                    deadline: input.deadline ?? null,
                })
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studyGoalKeys.list() })
        },
    })
}

export function useUpdateGoal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: UpdateGoalInput): Promise<StudyGoal> => {
            const { id, ...updates } = input

            const { data, error } = await supabase
                .from('study_goals')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studyGoalKeys.list() })
        },
    })
}

export function useDeleteGoal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string): Promise<void> => {
            const { error } = await supabase
                .from('study_goals')
                .delete()
                .eq('id', id)

            if (error) throw new Error(error.message)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studyGoalKeys.list() })
        },
    })
}
