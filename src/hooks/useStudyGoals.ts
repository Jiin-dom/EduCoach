import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { StudyGoal } from "@/types/studyGoals"

const studyGoalKeys = {
    all: ['study-goals'] as const,
    list: () => [...studyGoalKeys.all, 'list'] as const,
}

/**
 * Read-only hook for study_goals.
 * Phase 8 of the remediation plan: surface existing rows
 * before committing to CRUD operations.
 */
export function useStudyGoals() {
    const { user } = useAuth()

    return useQuery({
        queryKey: studyGoalKeys.list(),
        queryFn: async ({ signal }): Promise<StudyGoal[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('study_goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return (data ?? []) as StudyGoal[]
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    })
}
