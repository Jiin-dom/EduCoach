/**
 * useLearning Hook
 *
 * React Query hooks for the Phase 5 learning intelligence engine.
 * Provides mastery queries, due-topic queries, analytics stats,
 * and the key useProcessQuizResults mutation that drives WMS + SM-2.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { adaptiveStudyKeys } from '@/hooks/useAdaptiveStudy'
import { scheduleDocumentGoalWindow } from '@/services/goalWindowScheduling'
import { ensureAdaptiveReviewQuizForDocument } from '@/services/adaptiveStudy'
import {
    computeMastery,
    calculateSM2,
    mapScoreToQuality,
    calculatePriorityScore,
    getMasteryLevelWithDecay,
    conceptAccuracyPercent,
    todayUTC,
    type AttemptLogEntry,
} from '@/lib/learningAlgorithms'
import type { AttemptAnswer, QuizQuestion } from '@/hooks/useQuizzes'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConceptMasteryRow {
    id: string
    user_id: string
    concept_id: string
    document_id: string | null
    mastery_score: number
    confidence: number
    mastery_level: 'needs_review' | 'developing' | 'mastered'
    total_attempts: number
    correct_attempts: number
    last_attempt_at: string | null
    repetition: number
    interval_days: number
    ease_factor: number
    due_date: string
    last_reviewed_at: string | null
    priority_score: number
    created_at: string
    updated_at: string
}

export interface ConceptMasteryWithDetails extends ConceptMasteryRow {
    concept_name: string
    concept_category: string | null
    concept_difficulty: string | null
    document_title: string | null
    document_exam_date: string | null
    /** Mastery after time-based decay (display only, raw value unchanged) */
    display_mastery_score: number
    /** Mastery level after decay */
    display_mastery_level: 'needs_review' | 'developing' | 'mastered'
}

export interface LearningStats {
    totalConcepts: number
    masteredCount: number
    developingCount: number
    needsReviewCount: number
    averageMastery: number
    quizzesCompleted: number
    averageScore: number
    studyStreak: number
}

export interface ProcessQuizResultsInput {
    attemptId: string
    quizId: string
    answers: AttemptAnswer[]
    questions: QuizQuestion[]
    documentId: string
    /** Per-question time in seconds, keyed by question_id. */
    timePerQuestion?: Record<string, number>
}

export interface LearningConfig {
    confidence_k: number
    sm2_default_ef: number
    quality_thresholds: number[]
    priority_w_weakness: number
    priority_w_deadline: number
    priority_w_practice: number
    mastery_threshold_mastered: number
    mastery_threshold_developing: number
    confidence_threshold_mastered: number
}

export type AttemptLogSourceType = 'quiz' | 'flashcard'

interface AttemptLogInsertBase {
    user_id: string
    concept_id: string | null
    document_id: string | null
    is_correct: boolean
    user_answer: string | null
    question_difficulty: 'beginner' | 'intermediate' | 'advanced' | null
    time_spent_seconds: number | null
    attempt_index: number
    source_type: AttemptLogSourceType
}

export interface QuizAttemptLogInsert extends AttemptLogInsertBase {
    source_type: 'quiz'
    question_id: string
    quiz_id: string
    attempt_id: string
    flashcard_id: null
}

export interface FlashcardAttemptLogInsert extends AttemptLogInsertBase {
    source_type: 'flashcard'
    flashcard_id: string
    question_id: null
    quiz_id: null
    attempt_id: null
}

const DEFAULT_CONFIG: LearningConfig = {
    confidence_k: 3,
    sm2_default_ef: 2.5,
    quality_thresholds: [90, 80, 65, 50, 30],
    priority_w_weakness: 0.65,
    priority_w_deadline: 0.25,
    priority_w_practice: 0.10,
    mastery_threshold_mastered: 80,
    mastery_threshold_developing: 60,
    confidence_threshold_mastered: 0.67,
}

function normalizeLearningConfig(data: Record<string, unknown> | null | undefined): LearningConfig {
    if (!data) return DEFAULT_CONFIG
    const parsedThresholds = Array.isArray(data.quality_thresholds)
        ? data.quality_thresholds.map((v) => Number(v)).filter((v) => Number.isFinite(v))
        : []
    return {
        confidence_k: Number(data.confidence_k) || DEFAULT_CONFIG.confidence_k,
        sm2_default_ef: Number(data.sm2_default_ef) || DEFAULT_CONFIG.sm2_default_ef,
        quality_thresholds: parsedThresholds.length >= 5 ? parsedThresholds : DEFAULT_CONFIG.quality_thresholds,
        priority_w_weakness: Number(data.priority_w_weakness) || DEFAULT_CONFIG.priority_w_weakness,
        priority_w_deadline: Number(data.priority_w_deadline) || DEFAULT_CONFIG.priority_w_deadline,
        priority_w_practice: Number(data.priority_w_practice) || DEFAULT_CONFIG.priority_w_practice,
        mastery_threshold_mastered: Number(data.mastery_threshold_mastered) || DEFAULT_CONFIG.mastery_threshold_mastered,
        mastery_threshold_developing: Number(data.mastery_threshold_developing) || DEFAULT_CONFIG.mastery_threshold_developing,
        confidence_threshold_mastered: Number(data.confidence_threshold_mastered) || DEFAULT_CONFIG.confidence_threshold_mastered,
    }
}

export async function loadLearningConfigForUser(userId?: string | null): Promise<LearningConfig> {
    if (!userId) return DEFAULT_CONFIG

    const { data, error } = await supabase
        .from('learning_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (error || !data) return DEFAULT_CONFIG
    return normalizeLearningConfig(data as unknown as Record<string, unknown>)
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const learningKeys = {
    all: ['learning'] as const,
    config: () => [...learningKeys.all, 'config'] as const,
    mastery: () => [...learningKeys.all, 'mastery'] as const,
    masteryByDocument: (docId: string) => [...learningKeys.mastery(), { docId }] as const,
    dueTopics: () => [...learningKeys.all, 'due'] as const,
    weakTopics: () => [...learningKeys.all, 'weak'] as const,
    stats: () => [...learningKeys.all, 'stats'] as const,
    attemptLog: (conceptId?: string) => [...learningKeys.all, 'log', conceptId] as const,
    masteryTimeline: (conceptId?: string) => [...learningKeys.all, 'timeline', conceptId] as const,
}

// ─── Config Query ───────────────────────────────────────────────────────────

/**
 * Fetches the user's learning_config row (or falls back to defaults).
 * Config is cached aggressively since it rarely changes.
 */
export function useLearningConfig() {
    const { user } = useAuth()

    return useQuery({
        queryKey: learningKeys.config(),
        queryFn: async (): Promise<LearningConfig> => loadLearningConfigForUser(user?.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 30, // 30 minutes
    })
}

/** Synchronous accessor for config -- returns cached value or defaults. */
export function getLearningConfigDefaults(): LearningConfig {
    return DEFAULT_CONFIG
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all concept mastery rows for the current user,
 * joined with concept name/category and document title.
 */
export function useConceptMasteryList() {
    const { user } = useAuth()

    return useQuery({
        queryKey: learningKeys.mastery(),
        queryFn: async ({ signal }): Promise<ConceptMasteryWithDetails[]> => {
            if (!user) return []

            const { data: masteryRows, error } = await supabase
                .from('user_concept_mastery')
                .select('*')
                .eq('user_id', user.id)
                .order('priority_score', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            if (!masteryRows || masteryRows.length === 0) return []

            const conceptIds = [...new Set(masteryRows.map((r) => r.concept_id))]
            const docIds = [...new Set(masteryRows.map((r) => r.document_id).filter(Boolean))] as string[]

            const [conceptsRes, docsRes] = await Promise.all([
                supabase.from('concepts').select('id, name, category, difficulty_level').in('id', conceptIds),
                docIds.length > 0
                    ? supabase.from('documents').select('id, title, exam_date').in('id', docIds)
                    : Promise.resolve({ data: [] as { id: string; title: string, exam_date: string | null }[], error: null }),
            ])

            const conceptMap = new Map((conceptsRes.data || []).map((c) => [c.id, c]))
            const docMap = new Map((docsRes.data || []).map((d) => [d.id, d]))

            return masteryRows.map((row) => {
                const concept = conceptMap.get(row.concept_id)
                const doc = row.document_id ? docMap.get(row.document_id) : null
                
                // If there's an exam date, it acts as a hard deadline.
                // If the scheduled SM-2 due_date is AFTER the exam, we pull it forward to the exam date.
                let effectiveDueDate = row.due_date;
                if (doc?.exam_date) {
                    const examDateOnly = doc.exam_date.split('T')[0];
                    if (row.due_date > examDateOnly) {
                        effectiveDueDate = examDateOnly;
                    }
                }

                // Apply mastery decay for overdue concepts using the effective due date
                const { displayMastery, displayLevel } = getMasteryLevelWithDecay(
                    Number(row.mastery_score),
                    Number(row.confidence),
                    effectiveDueDate,
                    Number(row.interval_days) || 1,
                )
                return {
                    ...row,
                    due_date: effectiveDueDate,
                    concept_name: concept?.name ?? 'Unknown',
                    concept_category: concept?.category ?? null,
                    concept_difficulty: concept?.difficulty_level ?? null,
                    document_title: doc?.title ?? null,
                    document_exam_date: doc?.exam_date ?? null,
                    display_mastery_score: displayMastery,
                    display_mastery_level: displayLevel,
                } as ConceptMasteryWithDetails
            })
        },
        enabled: !!user,
    })
}

/**
 * Mastery rows for a single document's concepts.
 */
export function useConceptMasteryByDocument(documentId: string | undefined) {
    const { data: all, ...rest } = useConceptMasteryList()

    const filtered = documentId
        ? (all || []).filter((m) => m.document_id === documentId)
        : []

    return { data: filtered, ...rest }
}

/**
 * Concepts due today or overdue (SM-2 due_date <= today).
 */
export function useDueTopics() {
    const { data: all, ...rest } = useConceptMasteryList()

    const today = todayUTC()
    const due = (all || [])
        // Exclude bootstrap placeholders; due/review should reflect real performance only.
        .filter((m) => m.total_attempts > 0 && m.due_date <= today)
        .sort((a, b) => b.priority_score - a.priority_score)

    return { data: due, ...rest }
}

/**
 * Weakest concepts (needs_review), ordered by lowest mastery.
 */
export function useWeakTopics(limit = 5) {
    const { data: all, ...rest } = useConceptMasteryList()

    const weak = (all || [])
        // Exclude bootstrap placeholders created during file goal-window scheduling.
        // Weak topics should only appear after at least one real student attempt.
        .filter((m) => m.total_attempts > 0 && m.mastery_level === 'needs_review')
        .sort((a, b) => a.mastery_score - b.mastery_score)
        .slice(0, limit)

    return { data: weak, ...rest }
}

/**
 * Reschedule a concept's review "deadline" by updating `due_date` for that
 * user/concept row.
 *
 * Notes:
 * - This intentionally does NOT rerun WMS/SM-2 recomputation; it only changes
 *   the displayed schedule.
 * - We also update `priority_score` because it depends on the due date and
 *   drives sorting in the Learning Path UI.
 */
export function useRescheduleConceptDueDate() {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const { data: learningConfig } = useLearningConfig()

    return useMutation({
        mutationFn: async (input: {
            conceptId: string
            newDueDate: string // UTC YYYY-MM-DD
            masteryScore: number
            confidence: number
        }) => {
            if (!user) throw new Error('Not authenticated')

            const cfg = learningConfig ?? DEFAULT_CONFIG
            const priority = calculatePriorityScore(
                input.masteryScore,
                input.newDueDate,
                input.confidence,
                {
                    weakness: cfg.priority_w_weakness,
                    deadline: cfg.priority_w_deadline,
                    practice: cfg.priority_w_practice,
                },
            )

            const { error } = await supabase
                .from('user_concept_mastery')
                .update({
                    due_date: input.newDueDate,
                    priority_score: priority.priorityScore,
                })
                .eq('user_id', user.id)
                .eq('concept_id', input.conceptId)

            if (error) throw new Error(error.message)

            return { conceptId: input.conceptId, newDueDate: input.newDueDate }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
        },
    })
}

/**
 * Aggregated learning statistics for the current user.
 */
export function useLearningStats() {
    const { user } = useAuth()

    return useQuery({
        queryKey: learningKeys.stats(),
        queryFn: async ({ signal }): Promise<LearningStats> => {
            if (!user) {
                return {
                    totalConcepts: 0, masteredCount: 0, developingCount: 0,
                    needsReviewCount: 0, averageMastery: 0, quizzesCompleted: 0,
                    averageScore: 0, studyStreak: 0,
                }
            }

            const [masteryRes, attemptsRes] = await Promise.all([
                supabase
                    .from('user_concept_mastery')
                    .select('mastery_score, mastery_level, confidence, due_date, interval_days, total_attempts')
                    .eq('user_id', user.id)
                    .abortSignal(signal),
                supabase
                    .from('attempts')
                    .select('score, completed_at')
                    .eq('user_id', user.id)
                    .not('completed_at', 'is', null)
                    .order('completed_at', { ascending: false })
                    .abortSignal(signal),
            ])

            if (masteryRes.error) throw new Error(masteryRes.error.message)
            if (attemptsRes.error) throw new Error(attemptsRes.error.message)

            // Exclude bootstrap placeholders from performance analytics.
            const mastery = (masteryRes.data || []).filter((m) => Number(m.total_attempts ?? 0) > 0)
            const attempts = attemptsRes.data || []

            // Apply mastery decay for stats — use display values
            const decayed = mastery.map((m) => {
                const { displayMastery, displayLevel } = getMasteryLevelWithDecay(
                    Number(m.mastery_score),
                    Number(m.confidence),
                    m.due_date,
                    Number(m.interval_days) || 1,
                )
                return { displayMastery, displayLevel }
            })

            const scores = decayed.map((m) => m.displayMastery)
            const avgMastery = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0

            const attemptScores = attempts.map((a) => Number(a.score)).filter((s) => !isNaN(s))
            const avgScore = attemptScores.length > 0
                ? Math.round(attemptScores.reduce((a, b) => a + b, 0) / attemptScores.length)
                : 0

            // Study streak: consecutive UTC days with at least one attempt
            let streak = 0
            if (attempts.length > 0) {
                const dates = [...new Set(
                    attempts
                        .filter((a) => a.completed_at)
                        .map((a) => new Date(a.completed_at!).toISOString().split('T')[0]),
                )].sort().reverse()

                const todayStr = todayUTC()

                for (let i = 0; i < dates.length; i++) {
                    const d = new Date(todayStr + 'T00:00:00Z')
                    d.setUTCDate(d.getUTCDate() - i)
                    const expectedStr = d.toISOString().split('T')[0]
                    if (dates[i] === expectedStr) {
                        streak++
                    } else {
                        break
                    }
                }
            }

            return {
                totalConcepts: mastery.length,
                masteredCount: decayed.filter((m) => m.displayLevel === 'mastered').length,
                developingCount: decayed.filter((m) => m.displayLevel === 'developing').length,
                needsReviewCount: decayed.filter((m) => m.displayLevel === 'needs_review').length,
                averageMastery: avgMastery,
                quizzesCompleted: attempts.length,
                averageScore: avgScore,
                studyStreak: streak,
            }
        },
        enabled: !!user,
    })
}

// ─── Analytics: Score Trend ──────────────────────────────────────────────────

export interface ScoreTrendPoint {
    date: string
    score: number
}

/**
 * Returns daily average quiz scores for the last 30 days.
 * Used by the analytics LineChart.
 */
export function useScoreTrend() {
    const { user } = useAuth()

    return useQuery({
        queryKey: [...learningKeys.all, 'score-trend'] as const,
        queryFn: async (): Promise<ScoreTrendPoint[]> => {
            if (!user) return []

            const since = new Date()
            since.setUTCDate(since.getUTCDate() - 30)

            const { data, error } = await supabase
                .from('attempts')
                .select('score, completed_at')
                .eq('user_id', user.id)
                .not('completed_at', 'is', null)
                .gte('completed_at', since.toISOString())
                .order('completed_at')

            if (error) throw new Error(error.message)

            const dayMap = new Map<string, number[]>()
            for (const a of data ?? []) {
                if (a.score == null) continue
                const day = new Date(a.completed_at!).toISOString().split('T')[0]
                const existing = dayMap.get(day) || []
                existing.push(Number(a.score))
                dayMap.set(day, existing)
            }

            return Array.from(dayMap.entries())
                .map(([date, scores]) => ({
                    date,
                    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
        },
        enabled: !!user,
    })
}

// ─── Analytics: Study Activity ──────────────────────────────────────────────

export interface ActivityDay {
    date: string
    count: number
}

/**
 * Returns per-day question counts for the last 90 days.
 * Used by the activity heatmap.
 */
export function useStudyActivity() {
    const { user } = useAuth()

    return useQuery({
        queryKey: [...learningKeys.all, 'activity'] as const,
        queryFn: async (): Promise<ActivityDay[]> => {
            if (!user) return []

            const since = new Date()
            since.setUTCDate(since.getUTCDate() - 90)

            const { data, error } = await supabase
                .from('question_attempt_log')
                .select('attempted_at')
                .eq('user_id', user.id)
                .gte('attempted_at', since.toISOString())

            if (error) throw new Error(error.message)

            const dayMap = new Map<string, number>()
            for (const row of data ?? []) {
                const day = new Date(row.attempted_at).toISOString().split('T')[0]
                dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
            }

            return Array.from(dayMap.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date))
        },
        enabled: !!user,
    })
}

// ─── Analytics: Mastery Timeline ─────────────────────────────────────────────

export interface MasteryTimelinePoint {
    date: string
    mastery: number
}

/**
 * Returns daily average mastery snapshots for the last 30 days.
 * If conceptId is provided, returns that concept's timeline only.
 * Otherwise, returns the aggregate (average across all concepts).
 */
export function useMasteryTimeline(conceptId?: string) {
    const { user } = useAuth()

    return useQuery({
        queryKey: learningKeys.masteryTimeline(conceptId),
        queryFn: async (): Promise<MasteryTimelinePoint[]> => {
            if (!user) return []

            const since = new Date()
            since.setUTCDate(since.getUTCDate() - 30)

            let query = supabase
                .from('mastery_snapshots')
                .select('mastery_score, recorded_at')
                .eq('user_id', user.id)
                .gte('recorded_at', since.toISOString())
                .order('recorded_at')

            if (conceptId) {
                query = query.eq('concept_id', conceptId)
            }

            const { data, error } = await query

            if (error) throw new Error(error.message)

            const dayMap = new Map<string, number[]>()
            for (const row of data ?? []) {
                const day = new Date(row.recorded_at).toISOString().split('T')[0]
                const existing = dayMap.get(day) || []
                existing.push(Number(row.mastery_score))
                dayMap.set(day, existing)
            }

            return Array.from(dayMap.entries())
                .map(([date, scores]) => ({
                    date,
                    mastery: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
        },
        enabled: !!user,
    })
}

// ─── Analytics: Study Efficiency ─────────────────────────────────────────────

export interface StudyEfficiencyData {
    totalTimeMinutes: number
    totalMasteryGained: number
    mostEfficientCategory: string | null
    categoryEfficiency: { category: string; timeMinutes: number; masteryGained: number }[]
}

/**
 * Computes study efficiency: time spent vs mastery gained.
 * Uses question_attempt_log time data and mastery_snapshots.
 */
export function useStudyEfficiency() {
    const { user } = useAuth()

    return useQuery({
        queryKey: [...learningKeys.all, 'efficiency'] as const,
        queryFn: async (): Promise<StudyEfficiencyData> => {
            const empty: StudyEfficiencyData = {
                totalTimeMinutes: 0, totalMasteryGained: 0,
                mostEfficientCategory: null, categoryEfficiency: [],
            }
            if (!user) return empty

            const since = new Date()
            since.setUTCDate(since.getUTCDate() - 30)

            const [logsRes, conceptsRes] = await Promise.all([
                supabase
                    .from('question_attempt_log')
                    .select('concept_id, time_spent_seconds, is_correct')
                    .eq('user_id', user.id)
                    .gte('attempted_at', since.toISOString()),
                supabase
                    .from('user_concept_mastery')
                    .select('concept_id, mastery_score')
                    .eq('user_id', user.id),
            ])

            if (logsRes.error || conceptsRes.error) return empty

            const logs = logsRes.data || []
            const mastery = conceptsRes.data || []

            const conceptIds = [...new Set(logs.map(l => l.concept_id).filter(Boolean))]
            if (conceptIds.length === 0) return empty

            // Fetch concept categories
            const { data: conceptDetails } = await supabase
                .from('concepts')
                .select('id, category')
                .in('id', conceptIds)

            const categoryMap = new Map((conceptDetails || []).map(c => [c.id, c.category || 'Uncategorized']))
            const masteryMap = new Map(mastery.map(m => [m.concept_id, Number(m.mastery_score)]))

            // Aggregate time per category
            const catTime = new Map<string, number>()
            const catMastery = new Map<string, number[]>()
            let totalTime = 0

            for (const log of logs) {
                if (!log.concept_id) continue
                const cat = categoryMap.get(log.concept_id) || 'Uncategorized'
                const time = log.time_spent_seconds || 0
                totalTime += time
                catTime.set(cat, (catTime.get(cat) || 0) + time)

                const ms = masteryMap.get(log.concept_id)
                if (ms != null) {
                    const existing = catMastery.get(cat) || []
                    existing.push(ms)
                    catMastery.set(cat, existing)
                }
            }

            const categoryEfficiency = Array.from(catTime.entries()).map(([category, timeSec]) => {
                const scores = catMastery.get(category) || []
                const avgMastery = scores.length > 0
                    ? scores.reduce((a, b) => a + b, 0) / scores.length
                    : 0
                return {
                    category,
                    timeMinutes: Math.round(timeSec / 60),
                    masteryGained: Math.round(avgMastery),
                }
            }).sort((a, b) => {
                const effA = a.timeMinutes > 0 ? a.masteryGained / a.timeMinutes : 0
                const effB = b.timeMinutes > 0 ? b.masteryGained / b.timeMinutes : 0
                return effB - effA
            })

            const totalMasteryGained = mastery.length > 0
                ? Math.round(mastery.reduce((s, m) => s + Number(m.mastery_score), 0) / mastery.length)
                : 0

            return {
                totalTimeMinutes: Math.round(totalTime / 60),
                totalMasteryGained,
                mostEfficientCategory: categoryEfficiency.length > 0 ? categoryEfficiency[0].category : null,
                categoryEfficiency,
            }
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    })
}

// ─── Analytics: Concept Velocity ─────────────────────────────────────────────

export interface ConceptVelocity {
    avgDaysToReview: number | null
    avgDaysToDeveloping: number | null
    avgDaysToMastered: number | null
}

/**
 * Computes average "velocity" metrics:
 * how fast concepts move through mastery stages.
 */
export function useConceptVelocity() {
    const { user } = useAuth()

    return useQuery({
        queryKey: [...learningKeys.all, 'velocity'] as const,
        queryFn: async (): Promise<ConceptVelocity> => {
            const empty: ConceptVelocity = { avgDaysToReview: null, avgDaysToDeveloping: null, avgDaysToMastered: null }
            if (!user) return empty

            const { data: snapshots, error } = await supabase
                .from('mastery_snapshots')
                .select('concept_id, mastery_level, recorded_at')
                .eq('user_id', user.id)
                .order('recorded_at')

            if (error || !snapshots || snapshots.length === 0) return empty

            // Group snapshots by concept, find first time each level was reached
            const conceptTimelines = new Map<string, { level: string; at: Date }[]>()
            for (const snap of snapshots) {
                const timeline = conceptTimelines.get(snap.concept_id) || []
                timeline.push({ level: snap.mastery_level, at: new Date(snap.recorded_at) })
                conceptTimelines.set(snap.concept_id, timeline)
            }

            const daysToDeveloping: number[] = []
            const daysToMastered: number[] = []

            for (const [, timeline] of conceptTimelines) {
                if (timeline.length < 2) continue
                const firstAt = timeline[0].at
                const firstDeveloping = timeline.find(t => t.level === 'developing')
                const firstMastered = timeline.find(t => t.level === 'mastered')

                if (firstDeveloping) {
                    const days = (firstDeveloping.at.getTime() - firstAt.getTime()) / (1000 * 60 * 60 * 24)
                    daysToDeveloping.push(Math.max(0, Math.round(days)))
                }
                if (firstMastered) {
                    const days = (firstMastered.at.getTime() - firstAt.getTime()) / (1000 * 60 * 60 * 24)
                    daysToMastered.push(Math.max(0, Math.round(days)))
                }
            }

            const avg = (arr: number[]) => arr.length > 0
                ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10
                : null

            return {
                avgDaysToReview: null,
                avgDaysToDeveloping: avg(daysToDeveloping),
                avgDaysToMastered: avg(daysToMastered),
            }
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
    })
}

// ─── Shared: Recompute mastery for a single concept ─────────────────────────

/**
 * Fetches recent logs, runs WMS + SM-2, and upserts into user_concept_mastery.
 * Used by both quiz processing and flashcard review.
 * Accepts optional config for tunable algorithm parameters.
 */
export async function recomputeConceptMastery(
    userId: string,
    conceptId: string,
    documentId: string | null,
    sm2Quality: number,
    config: LearningConfig = DEFAULT_CONFIG,
) {
    const { data: allLogs, error: logsError } = await supabase
        .from('question_attempt_log')
        .select('is_correct, question_difficulty, time_spent_seconds, attempted_at')
        .eq('user_id', userId)
        .eq('concept_id', conceptId)
        .order('attempted_at', { ascending: false })
        .limit(10)

    if (logsError) {
        console.error('[Learning] Failed to fetch logs for concept:', conceptId, logsError)
        return
    }

    const attemptLogs: AttemptLogEntry[] = (allLogs || []).map((l) => ({
        is_correct: l.is_correct,
        question_difficulty: l.question_difficulty as AttemptLogEntry['question_difficulty'],
        time_spent_seconds: l.time_spent_seconds,
        attempted_at: l.attempted_at,
    }))

    const wmsResult = computeMastery(attemptLogs, config.confidence_k)
    const masteryLevel: ConceptMasteryRow['mastery_level'] =
        wmsResult.finalMastery >= config.mastery_threshold_mastered && wmsResult.confidence >= config.confidence_threshold_mastered
            ? 'mastered'
            : (
                wmsResult.finalMastery >= config.mastery_threshold_developing
                    ? 'developing'
                    : 'needs_review'
            )

    const { data: existing } = await supabase
        .from('user_concept_mastery')
        .select('repetition, interval_days, ease_factor')
        .eq('user_id', userId)
        .eq('concept_id', conceptId)
        .maybeSingle()

    const sm2Result = calculateSM2({
        quality: sm2Quality,
        repetition: existing?.repetition ?? 0,
        interval: existing?.interval_days ?? 0,
        easeFactor: existing?.ease_factor ?? config.sm2_default_ef,
    })

    const priorityResult = calculatePriorityScore(
        wmsResult.finalMastery,
        sm2Result.dueDate,
        wmsResult.confidence,
        {
            weakness: config.priority_w_weakness,
            deadline: config.priority_w_deadline,
            practice: config.priority_w_practice,
        },
    )

    const totalAttempts = attemptLogs.length
    const correctAttempts = attemptLogs.filter((l) => l.is_correct).length

    const { error: upsertError } = await supabase
        .from('user_concept_mastery')
        .upsert(
            {
                user_id: userId,
                concept_id: conceptId,
                document_id: documentId,
                mastery_score: wmsResult.finalMastery,
                confidence: wmsResult.confidence,
                mastery_level: masteryLevel,
                total_attempts: totalAttempts,
                correct_attempts: correctAttempts,
                last_attempt_at: new Date().toISOString(),
                repetition: sm2Result.repetition,
                interval_days: sm2Result.interval,
                ease_factor: sm2Result.easeFactor,
                due_date: sm2Result.dueDate,
                last_reviewed_at: new Date().toISOString(),
                priority_score: priorityResult.priorityScore,
            },
            { onConflict: 'user_id,concept_id' },
        )

    if (upsertError) {
        console.error('[Learning] Failed to upsert mastery for concept:', conceptId, upsertError)
        return
    }

    // Phase 6.4: Record a mastery snapshot for timeline analytics
    const { error: snapError } = await supabase
        .from('mastery_snapshots')
        .insert({
            user_id: userId,
            concept_id: conceptId,
            mastery_score: wmsResult.finalMastery,
            mastery_level: masteryLevel,
        })

    if (snapError) {
        console.warn('[Learning] Failed to insert mastery snapshot (non-fatal):', snapError.message)
    }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * THE KEY MUTATION — process quiz results through the learning engine.
 *
 * Called after useSubmitAttempt succeeds. It:
 * 1. Fans out per-question answers into question_attempt_log
 * 2. For each affected concept, recomputes WMS + SM-2
 * 3. Upserts into user_concept_mastery
 * 4. Invalidates learning caches
 */
export function useProcessQuizResults() {
    const queryClient = useQueryClient()
    const { user, profile } = useAuth()

    return useMutation({
        mutationFn: async (input: ProcessQuizResultsInput) => {
            if (!user) throw new Error('Not authenticated')
            const learningConfig = await loadLearningConfigForUser(user.id)

            const { attemptId, quizId, answers, questions, documentId, timePerQuestion } = input

            // Build a lookup: question_id -> question metadata
            const questionMap = new Map(questions.map((q) => [q.id, q]))

            // ── Step 1: Resolve concept_ids ─────────────────────────────
            // Many quiz_questions may have concept_id = null (Edge Function
            // didn't set it). Resolve via source_chunk_id -> concepts lookup,
            // or fall back to document-level concepts.

            const needsResolution = questions.filter((q) => !q.concept_id)

            const chunkToConceptMap = new Map<string, string>()
            let fallbackConceptId: string | null = null

            if (needsResolution.length > 0) {
                // Fetch concepts for this document to build chunk->concept map
                const { data: docConcepts } = await supabase
                    .from('concepts')
                    .select('id, chunk_id, importance')
                    .eq('document_id', documentId)
                    .order('importance', { ascending: false })

                if (docConcepts && docConcepts.length > 0) {
                    fallbackConceptId = docConcepts[0].id
                    for (const c of docConcepts) {
                        if (c.chunk_id && !chunkToConceptMap.has(c.chunk_id)) {
                            chunkToConceptMap.set(c.chunk_id, c.id)
                        }
                    }
                }
            }

            function resolveConceptId(q: QuizQuestion | undefined): string | null {
                if (!q) return null
                if (q.concept_id) return q.concept_id
                if (q.source_chunk_id && chunkToConceptMap.has(q.source_chunk_id)) {
                    return chunkToConceptMap.get(q.source_chunk_id)!
                }
                return fallbackConceptId
            }

            // ── Step 2: Compute attempt_index per concept ────────────────
            const conceptIdsForIndex = new Set<string>()
            for (const ans of answers) {
                const cid = resolveConceptId(questionMap.get(ans.question_id))
                if (cid) conceptIdsForIndex.add(cid)
            }

            const attemptIndexMap = new Map<string, number>()
            if (conceptIdsForIndex.size > 0) {
                const { data: countRows } = await supabase
                    .from('question_attempt_log')
                    .select('concept_id')
                    .eq('user_id', user.id)
                    .in('concept_id', [...conceptIdsForIndex])

                const counts = new Map<string, number>()
                for (const row of countRows ?? []) {
                    if (row.concept_id) counts.set(row.concept_id, (counts.get(row.concept_id) ?? 0) + 1)
                }
                for (const [cid, cnt] of counts) attemptIndexMap.set(cid, cnt)
            }

            // ── Step 3: Fan out per-question logs ───────────────────────
            const logRows: QuizAttemptLogInsert[] = answers.map((ans) => {
                const q = questionMap.get(ans.question_id)
                const cid = resolveConceptId(q)
                const prevCount = cid ? (attemptIndexMap.get(cid) ?? 0) : 0
                if (cid) attemptIndexMap.set(cid, prevCount + 1)

                return {
                    user_id: user.id,
                    question_id: ans.question_id,
                    quiz_id: quizId,
                    attempt_id: attemptId,
                    source_type: 'quiz',
                    flashcard_id: null,
                    concept_id: cid,
                    document_id: documentId,
                    is_correct: ans.is_correct,
                    user_answer: ans.user_answer,
                    question_difficulty: q?.difficulty_level ?? null,
                    time_spent_seconds: timePerQuestion?.[ans.question_id] ?? null,
                    attempt_index: prevCount + 1,
                }
            })

            const { error: logError } = await supabase
                .from('question_attempt_log')
                .insert(logRows)

            if (logError) {
                console.error('[Learning] Failed to insert question logs:', logError)
                throw new Error(logError.message)
            }

            // ── Step 4: Group answers by concept ────────────────────────
            const conceptAnswers = new Map<string, typeof logRows>()
            for (const row of logRows) {
                if (!row.concept_id) continue
                const existing = conceptAnswers.get(row.concept_id) || []
                existing.push(row)
                conceptAnswers.set(row.concept_id, existing)
            }

            if (conceptAnswers.size === 0) {
                console.warn('[Learning] No concepts resolved for any question -- mastery update skipped')
                return { processedConcepts: 0 }
            }

            // ── Step 5: For each concept, recompute WMS + SM-2 ─────────
            for (const [conceptId, currentAnswers] of conceptAnswers.entries()) {
                const quizAccuracy = conceptAccuracyPercent(currentAnswers)
                const quality = mapScoreToQuality(quizAccuracy, learningConfig.quality_thresholds)
                await recomputeConceptMastery(user.id, conceptId, documentId, quality, learningConfig)
            }

            // Goal-window scheduling:
            // If the document has a file goal end-date (`documents.exam_date`), keep the plan
            // continuously adapted as mastery data changes.
            const { data: docRow } = await supabase
                .from('documents')
                .select('exam_date')
                .eq('id', documentId)
                .maybeSingle()

            const activeExamDate = docRow?.exam_date
            if (activeExamDate) {
                await scheduleDocumentGoalWindow({
                    userId: user.id,
                    documentId,
                    examDate: activeExamDate,
                    availableStudyDays: profile?.available_study_days ?? null,
                    dailyStudyMinutes: profile?.daily_study_minutes ?? 30,
                    learningConfig,
                })
            }

            try {
                await ensureAdaptiveReviewQuizForDocument({
                    userId: user.id,
                    documentId,
                })
            } catch (adaptiveQuizError) {
                console.warn('[Learning] Adaptive review quiz sync failed:', adaptiveQuizError)
            }

            return { processedConcepts: conceptAnswers.size }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
            queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })
            if (result && result.processedConcepts > 0) {
                toast.success('Mastery scores updated', {
                    description: `${result.processedConcepts} concept${result.processedConcepts > 1 ? 's' : ''} updated based on your quiz performance.`,
                })
            }
        },
        onError: (error) => {
            console.error('[Learning] Process quiz results failed:', error)
            toast.warning('Learning progress could not be updated', {
                description: 'Your quiz was scored but mastery tracking failed. It will update on your next quiz.',
            })
        },
    })
}
