/**
 * useLearning Hook
 *
 * React Query hooks for the Phase 5 learning intelligence engine.
 * Provides mastery queries, due-topic queries, analytics stats,
 * and the key useProcessQuizResults mutation that drives WMS + SM-2.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
    computeMastery,
    calculateSM2,
    mapScoreToQuality,
    calculatePriorityScore,
    conceptAccuracyPercent,
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
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const learningKeys = {
    all: ['learning'] as const,
    mastery: () => [...learningKeys.all, 'mastery'] as const,
    masteryByDocument: (docId: string) => [...learningKeys.mastery(), { docId }] as const,
    dueTopics: () => [...learningKeys.all, 'due'] as const,
    weakTopics: () => [...learningKeys.all, 'weak'] as const,
    stats: () => [...learningKeys.all, 'stats'] as const,
    attemptLog: (conceptId?: string) => [...learningKeys.all, 'log', conceptId] as const,
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
                    ? supabase.from('documents').select('id, title').in('id', docIds)
                    : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
            ])

            const conceptMap = new Map((conceptsRes.data || []).map((c) => [c.id, c]))
            const docMap = new Map((docsRes.data || []).map((d) => [d.id, d]))

            return masteryRows.map((row) => {
                const concept = conceptMap.get(row.concept_id)
                const doc = row.document_id ? docMap.get(row.document_id) : null
                return {
                    ...row,
                    concept_name: concept?.name ?? 'Unknown',
                    concept_category: concept?.category ?? null,
                    concept_difficulty: concept?.difficulty_level ?? null,
                    document_title: doc?.title ?? null,
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

    const today = new Date().toISOString().split('T')[0]
    const due = (all || []).filter((m) => m.due_date <= today)
        .sort((a, b) => b.priority_score - a.priority_score)

    return { data: due, ...rest }
}

/**
 * Weakest concepts (needs_review), ordered by lowest mastery.
 */
export function useWeakTopics(limit = 5) {
    const { data: all, ...rest } = useConceptMasteryList()

    const weak = (all || [])
        .filter((m) => m.mastery_level === 'needs_review')
        .sort((a, b) => a.mastery_score - b.mastery_score)
        .slice(0, limit)

    return { data: weak, ...rest }
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
                    .select('mastery_score, mastery_level')
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

            const mastery = masteryRes.data || []
            const attempts = attemptsRes.data || []

            const scores = mastery.map((m) => Number(m.mastery_score))
            const avgMastery = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0

            const attemptScores = attempts.map((a) => Number(a.score)).filter((s) => !isNaN(s))
            const avgScore = attemptScores.length > 0
                ? Math.round(attemptScores.reduce((a, b) => a + b, 0) / attemptScores.length)
                : 0

            // Study streak: count consecutive days with at least one attempt
            let streak = 0
            if (attempts.length > 0) {
                const dates = [...new Set(
                    attempts
                        .filter((a) => a.completed_at)
                        .map((a) => new Date(a.completed_at!).toISOString().split('T')[0]),
                )].sort().reverse()

                const today = new Date()
                today.setHours(0, 0, 0, 0)

                for (let i = 0; i < dates.length; i++) {
                    const expected = new Date(today)
                    expected.setDate(expected.getDate() - i)
                    const expectedStr = expected.toISOString().split('T')[0]
                    if (dates[i] === expectedStr) {
                        streak++
                    } else {
                        break
                    }
                }
            }

            return {
                totalConcepts: mastery.length,
                masteredCount: mastery.filter((m) => m.mastery_level === 'mastered').length,
                developingCount: mastery.filter((m) => m.mastery_level === 'developing').length,
                needsReviewCount: mastery.filter((m) => m.mastery_level === 'needs_review').length,
                averageMastery: avgMastery,
                quizzesCompleted: attempts.length,
                averageScore: avgScore,
                studyStreak: streak,
            }
        },
        enabled: !!user,
    })
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
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (input: ProcessQuizResultsInput) => {
            if (!user) throw new Error('Not authenticated')

            const { attemptId, quizId, answers, questions, documentId } = input

            // Build a lookup: question_id -> question metadata
            const questionMap = new Map(questions.map((q) => [q.id, q]))

            // ── Step 1: Resolve concept_ids ─────────────────────────────
            // Many quiz_questions may have concept_id = null (Edge Function
            // didn't set it). Resolve via source_chunk_id -> concepts lookup,
            // or fall back to document-level concepts.

            const needsResolution = questions.filter((q) => !q.concept_id)

            let chunkToConceptMap = new Map<string, string>()
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

            // ── Step 2: Fan out per-question logs ───────────────────────
            const logRows = answers.map((ans) => {
                const q = questionMap.get(ans.question_id)
                return {
                    user_id: user.id,
                    question_id: ans.question_id,
                    quiz_id: quizId,
                    attempt_id: attemptId,
                    concept_id: resolveConceptId(q),
                    document_id: documentId,
                    is_correct: ans.is_correct,
                    user_answer: ans.user_answer,
                    question_difficulty: q?.difficulty_level ?? null,
                    time_spent_seconds: null,
                }
            })

            const { error: logError } = await supabase
                .from('question_attempt_log')
                .insert(logRows)

            if (logError) {
                console.error('[Learning] Failed to insert question logs:', logError)
                throw new Error(logError.message)
            }

            // ── Step 3: Group answers by concept ────────────────────────
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

            // ── Step 4: For each concept, recompute WMS + SM-2 ─────────
            for (const [conceptId, currentAnswers] of conceptAnswers.entries()) {
                // Fetch ALL recent logs for this concept (not just this quiz)
                const { data: allLogs, error: logsError } = await supabase
                    .from('question_attempt_log')
                    .select('is_correct, question_difficulty, time_spent_seconds, attempted_at')
                    .eq('user_id', user.id)
                    .eq('concept_id', conceptId)
                    .order('attempted_at', { ascending: false })
                    .limit(10)

                if (logsError) {
                    console.error('[Learning] Failed to fetch logs for concept:', conceptId, logsError)
                    continue
                }

                const attemptLogs: AttemptLogEntry[] = (allLogs || []).map((l) => ({
                    is_correct: l.is_correct,
                    question_difficulty: l.question_difficulty as AttemptLogEntry['question_difficulty'],
                    time_spent_seconds: l.time_spent_seconds,
                    attempted_at: l.attempted_at,
                }))

                // WMS computation
                const wmsResult = computeMastery(attemptLogs)

                // SM-2: compute quality from this quiz's concept accuracy
                const quizAccuracy = conceptAccuracyPercent(currentAnswers)
                const quality = mapScoreToQuality(quizAccuracy)

                // Fetch existing mastery row (for SM-2 state)
                const { data: existing } = await supabase
                    .from('user_concept_mastery')
                    .select('repetition, interval_days, ease_factor')
                    .eq('user_id', user.id)
                    .eq('concept_id', conceptId)
                    .maybeSingle()

                const sm2Result = calculateSM2({
                    quality,
                    repetition: existing?.repetition ?? 0,
                    interval: existing?.interval_days ?? 0,
                    easeFactor: existing?.ease_factor ?? 2.5,
                })

                // Priority score
                const priorityResult = calculatePriorityScore(
                    wmsResult.finalMastery,
                    sm2Result.dueDate,
                    wmsResult.confidence,
                )

                const totalAttempts = attemptLogs.length
                const correctAttempts = attemptLogs.filter((l) => l.is_correct).length

                // ── Step 5: Upsert into user_concept_mastery ────────────
                const { error: upsertError } = await supabase
                    .from('user_concept_mastery')
                    .upsert(
                        {
                            user_id: user.id,
                            concept_id: conceptId,
                            document_id: documentId,
                            mastery_score: wmsResult.finalMastery,
                            confidence: wmsResult.confidence,
                            mastery_level: wmsResult.masteryLevel,
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
                }
            }

            return { processedConcepts: conceptAnswers.size }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: learningKeys.all })
        },
        onError: (error) => {
            console.error('[Learning] Process quiz results failed:', error)
        },
    })
}
