import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, ArrowLeft, BookOpen, Target, Brain, Calendar } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

import { useDocument } from '@/hooks/useDocuments'
import { useConceptMasteryByDocument, useMasteryTimeline } from '@/hooks/useLearning'
import type { ConceptMasteryWithDetails } from '@/hooks/useLearning'
import { useUserAttempts, useQuizzes } from '@/hooks/useQuizzes'
import { useStudyGoals } from '@/hooks/useStudyGoals'
import {
    filterStudyGoalsForDocument,
    selectPrimaryStudyGoal,
    buildGoalProgressViewModel,
} from '@/lib/documentGoalAnalytics'
import { DocumentGoalProgressStrip } from '@/components/analytics/DocumentGoalProgressStrip'
import { ConceptDrillDown, PIE_COLORS, ChartTooltip } from '@/components/analytics/AnalyticsContent'

function masteryLevelBadge(level: string) {
    switch (level) {
        case 'mastered':
            return <Badge variant="secondary" className="bg-green-50 text-green-700">Mastered</Badge>
        case 'developing':
            return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Developing</Badge>
        default:
            return <Badge variant="secondary" className="bg-red-50 text-red-700">Needs Review</Badge>
    }
}

export function DocumentAnalyticsContent() {
    const { documentId } = useParams<{ documentId: string }>()
    const navigate = useNavigate()
    const docQuery = useDocument(documentId)
    const masteryQuery = useConceptMasteryByDocument(documentId)
    const goalsQuery = useStudyGoals()
    const quizzesQuery = useQuizzes()
    const attemptsQuery = useUserAttempts()

    const [drillConcept, setDrillConcept] = useState<ConceptMasteryWithDetails | null>(null)
    const { data: conceptTimeline } = useMasteryTimeline(drillConcept?.concept_id ?? undefined)

    const document = docQuery.data
    const masteryList = masteryQuery.data ?? []
    const quizzes = quizzesQuery.data ?? []
    const attempts = attemptsQuery.data ?? []
    const goals = goalsQuery.data ?? []

    const quizMap = useMemo(() => new Map(quizzes.map((q) => [q.id, q])), [quizzes])

    const performanceMasteryList = useMemo(
        () => masteryList.filter((item) => item.total_attempts > 0),
        [masteryList],
    )

    const docStats = useMemo(() => {
        const practiced = performanceMasteryList
        const scores = practiced.map((c) => Number(c.display_mastery_score))
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        return {
            totalPracticed: practiced.length,
            masteredCount: practiced.filter((c) => c.display_mastery_level === 'mastered').length,
            developingCount: practiced.filter((c) => c.display_mastery_level === 'developing').length,
            needsReviewCount: practiced.filter((c) => c.display_mastery_level === 'needs_review').length,
            averageMastery: avg,
        }
    }, [performanceMasteryList])

    const distributionData = useMemo(
        () => [
            { name: 'Mastered', value: docStats.masteredCount },
            { name: 'Developing', value: docStats.developingCount },
            { name: 'Needs Review', value: docStats.needsReviewCount },
        ],
        [docStats],
    )

    const weakForDoc = useMemo(() => {
        return [...performanceMasteryList]
            .filter((m) => m.display_mastery_level === 'needs_review')
            .sort((a, b) => a.display_mastery_score - b.display_mastery_score)
            .slice(0, 10)
    }, [performanceMasteryList])

    const quizIdsForDoc = useMemo(() => {
        return new Set(quizzes.filter((q) => q.document_id === documentId).map((q) => q.id))
    }, [quizzes, documentId])

    const recentAttemptsForDoc = useMemo(() => {
        return attempts
            .filter((a) => a.completed_at && quizIdsForDoc.has(a.quiz_id))
            .slice(0, 10)
            .map((a) => ({
                ...a,
                quizTitle: quizMap.get(a.quiz_id)?.title ?? 'Unknown Quiz',
            }))
    }, [attempts, quizIdsForDoc, quizMap])

    const matchingGoals = useMemo(() => {
        if (!documentId) return []
        return filterStudyGoalsForDocument(goals, documentId, quizMap, masteryList)
    }, [goals, documentId, quizMap, masteryList])

    const primaryGoal = useMemo(() => selectPrimaryStudyGoal(matchingGoals), [matchingGoals])

    const goalViewModel = useMemo(() => {
        if (!primaryGoal) return null
        return buildGoalProgressViewModel(primaryGoal, matchingGoals, masteryList, attempts)
    }, [primaryGoal, matchingGoals, masteryList, attempts])

    const isLoading =
        docQuery.isLoading ||
        masteryQuery.isLoading ||
        goalsQuery.isLoading ||
        quizzesQuery.isLoading ||
        attemptsQuery.isLoading

    const isError = docQuery.isError || !documentId

    if (!documentId) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Missing document.
                </CardContent>
            </Card>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (isError || !document) {
        return (
            <Card>
                <CardContent className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                    <p className="text-lg font-semibold mb-2">Could not load document</p>
                    <Button variant="outline" onClick={() => navigate('/analytics')}>
                        Back to analytics
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (drillConcept) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDrillConcept(null)} className="gap-1">
                        <ArrowLeft className="w-4 h-4" />
                        Back to file analytics
                    </Button>
                </div>
                <ConceptDrillDown
                    concept={drillConcept}
                    onBack={() => setDrillConcept(null)}
                    timeline={conceptTimeline}
                />
            </div>
        )
    }

    const examLabel = document.exam_date
        ? new Date(document.exam_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                            <Link to="/analytics" aria-label="Back to analytics">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight">This file</h1>
                    </div>
                    <p className="text-muted-foreground pl-10">{document.title}</p>
                    {examLabel && (
                        <p className="text-sm text-muted-foreground pl-10 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Study goal date: {examLabel}
                        </p>
                    )}
                </div>
                <Button variant="outline" asChild>
                    <Link to={`/files/${document.id}`}>Open in Library</Link>
                </Button>
            </div>

            {goalViewModel && <DocumentGoalProgressStrip model={goalViewModel} />}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Practiced concepts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{docStats.totalPracticed}</div>
                        <p className="text-xs text-muted-foreground">With at least one attempt</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Average mastery</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{docStats.averageMastery}%</div>
                        <p className="text-xs text-muted-foreground">Display score on this file</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Status mix</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p><span className="text-green-600 font-medium">{docStats.masteredCount}</span> mastered</p>
                            <p><span className="text-yellow-600 font-medium">{docStats.developingCount}</span> developing</p>
                            <p><span className="text-red-600 font-medium">{docStats.needsReviewCount}</span> needs review</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {docStats.totalPracticed === 0 ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">
                            Take a quiz on this file to unlock performance breakdowns here.
                        </p>
                        <Button className="mt-4" asChild>
                            <Link to={`/files/${document.id}?tab=quizPrep`}>Go to quiz prep</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Mastery distribution</CardTitle>
                            <CardDescription>Concept levels for this document</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center gap-8">
                                <ResponsiveContainer width={200} height={200}>
                                    <PieChart>
                                        <Pie
                                            data={distributionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            dataKey="value"
                                            paddingAngle={2}
                                        >
                                            {distributionData.map((_, index) => (
                                                <Cell key={index} fill={PIE_COLORS[index]} stroke="var(--background)" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-3">
                                    {distributionData.map((entry, i) => (
                                        <div key={entry.name} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                            <span className="text-sm">{entry.name}: <strong>{entry.value}</strong></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-amber-500" />
                                Weak topics (this file)
                            </CardTitle>
                            <CardDescription>Lowest mastery concepts that need review</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {weakForDoc.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No concepts flagged as needs review.</p>
                            ) : (
                                <div className="space-y-2">
                                    {weakForDoc.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setDrillConcept(c)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="font-medium truncate">{c.concept_name}</span>
                                                {masteryLevelBadge(c.display_mastery_level)}
                                            </div>
                                            <span className="font-bold text-sm shrink-0 ml-2">
                                                {Math.round(c.display_mastery_score)}%
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="w-5 h-5 text-purple-500" />
                                Concepts (this file)
                            </CardTitle>
                            <CardDescription>Tap a row for detail and mastery over time</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {performanceMasteryList.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setDrillConcept(c)}
                                        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="font-medium truncate">{c.concept_name}</span>
                                            {masteryLevelBadge(c.display_mastery_level)}
                                        </div>
                                        <span className="font-bold text-sm shrink-0 ml-2">
                                            {Math.round(c.display_mastery_score)}%
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Recent quiz attempts</CardTitle>
                    <CardDescription>Completed attempts for quizzes on this document</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentAttemptsForDoc.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No completed attempts yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {recentAttemptsForDoc.map((a) => (
                                <Link
                                    key={a.id}
                                    to={`/quizzes/${a.quiz_id}`}
                                    className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{a.quizTitle}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {a.completed_at ? new Date(a.completed_at).toLocaleString() : ''}
                                        </p>
                                    </div>
                                    <span className="font-semibold shrink-0 ml-2">{a.score ?? '—'}%</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
