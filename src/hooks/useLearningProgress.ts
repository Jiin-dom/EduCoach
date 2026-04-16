/**
 * useLearningProgress Hook
 *
 * Provides weekly progress metrics by querying question_attempt_log
 * for attempts in the last 7 days.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface WeeklyProgress {
    conceptsImproved: number
    newConceptsTracked: number
    masteryDelta: number
    questionsAnswered: number
    quizzesCompleted: number
}

export function useWeeklyProgress() {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['learning', 'weekly-progress'],
        queryFn: async ({ signal }): Promise<WeeklyProgress> => {
            if (!user) {
                return { conceptsImproved: 0, newConceptsTracked: 0, masteryDelta: 0, questionsAnswered: 0, quizzesCompleted: 0 }
            }

            const sevenDaysAgo = new Date()
            sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
            const since = sevenDaysAgo.toISOString()

            // Get recent attempt logs (question-level)
            const { data: recentLogs, error: logError } = await supabase
                .from('question_attempt_log')
                .select('concept_id, is_correct, attempted_at')
                .eq('user_id', user.id)
                .gte('attempted_at', since)
                .abortSignal(signal)

            if (logError) throw new Error(logError.message)
            const logs = recentLogs || []

            // Get recent quiz attempts
            const { data: recentAttempts, error: attemptError } = await supabase
                .from('attempts')
                .select('id, completed_at')
                .eq('user_id', user.id)
                .not('completed_at', 'is', null)
                .gte('completed_at', since)
                .abortSignal(signal)

            if (attemptError) throw new Error(attemptError.message)

            // Count unique concepts that have at least one correct answer this week
            const conceptsWithCorrect = new Set(
                logs.filter(l => l.is_correct).map(l => l.concept_id)
            )

            // Count new concepts = concepts that have their FIRST ever attempt this week
            // We approximate by checking which concepts in recent logs have total_attempts = 1
            // in the mastery table (or we just count unique concepts from logs since it's simpler)
            const allConceptIds = [...new Set(logs.map(l => l.concept_id).filter(Boolean))]

            let newConceptsTracked = 0
            if (allConceptIds.length > 0) {
                const { data: masteryData } = await supabase
                    .from('user_concept_mastery')
                    .select('concept_id, total_attempts, created_at')
                    .eq('user_id', user.id)
                    .in('concept_id', allConceptIds)

                if (masteryData) {
                    newConceptsTracked = masteryData.filter(m =>
                        m.created_at && new Date(m.created_at) >= sevenDaysAgo
                    ).length
                }
            }

            // Real mastery delta from mastery_snapshots (before/after comparison)
            let masteryDelta = 0
            if (allConceptIds.length > 0) {
                // Current scores: latest snapshot per concept within the window
                const { data: currentSnapshots } = await supabase
                    .from('mastery_snapshots')
                    .select('concept_id, mastery_score, recorded_at')
                    .eq('user_id', user.id)
                    .in('concept_id', allConceptIds)
                    .gte('recorded_at', since)
                    .order('recorded_at', { ascending: false })

                // Before scores: latest snapshot per concept BEFORE the window
                const { data: beforeSnapshots } = await supabase
                    .from('mastery_snapshots')
                    .select('concept_id, mastery_score, recorded_at')
                    .eq('user_id', user.id)
                    .in('concept_id', allConceptIds)
                    .lt('recorded_at', since)
                    .order('recorded_at', { ascending: false })

                if (currentSnapshots && currentSnapshots.length > 0) {
                    // Dedupe to latest per concept
                    const latestCurrent = new Map<string, number>()
                    for (const s of currentSnapshots) {
                        if (!latestCurrent.has(s.concept_id)) {
                            latestCurrent.set(s.concept_id, Number(s.mastery_score))
                        }
                    }
                    const latestBefore = new Map<string, number>()
                    if (beforeSnapshots) {
                        for (const s of beforeSnapshots) {
                            if (!latestBefore.has(s.concept_id)) {
                                latestBefore.set(s.concept_id, Number(s.mastery_score))
                            }
                        }
                    }

                    // Only compute delta for concepts that have both before and current
                    const deltas: number[] = []
                    for (const [conceptId, currentScore] of latestCurrent) {
                        const beforeScore = latestBefore.get(conceptId)
                        if (beforeScore !== undefined) {
                            deltas.push(currentScore - beforeScore)
                        }
                    }
                    if (deltas.length > 0) {
                        masteryDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
                    }
                }
            }

            return {
                conceptsImproved: conceptsWithCorrect.size,
                newConceptsTracked,
                masteryDelta,
                questionsAnswered: logs.length,
                quizzesCompleted: (recentAttempts || []).length,
            }
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
