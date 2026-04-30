import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    TrendingUp,
    Target,
    Brain,
    Calendar,
    Flame,
    BookOpen,
    AlertTriangle,

    ArrowLeft,

    Zap,
    Timer,
    Gauge,
    Sparkles,
    Trophy,
    Activity,
    ChevronRight,
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid,
    PieChart, Pie, Cell,
} from "recharts"
import {
    useLearningStats, useConceptMasteryList, useWeakTopics,
    useScoreTrend, useStudyActivity, useMasteryTimeline,
} from "@/hooks/useLearning"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { useUserAttempts, useQuizzes } from "@/hooks/useQuizzes"
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap"

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

function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-primary/5">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card className="border-primary/5">
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="md:col-span-2 h-[300px] rounded-2xl" />
                <Skeleton className="h-[300px] rounded-2xl" />
            </div>
        </div>
    )
}

export const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0]
        const name = label || item.name || item.payload.name
        return (
            <div className="rounded-xl border border-primary/20 bg-background/90 p-3 shadow-xl backdrop-blur-md">
                <p className="mb-1 text-sm font-bold">{name}</p>
                <div className="flex items-center gap-2 text-sm">
                    <div 
                        className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" 
                        style={{ backgroundColor: item.color || item.fill || 'var(--primary)' }} 
                    />
                    <span className="text-muted-foreground">Value:</span>
                    <span className="font-bold text-primary">{item.value}%</span>
                </div>
            </div>
        )
    }
    return null
}

export const PIE_COLORS = [
    'oklch(0.65 0.25 160)', // Mastered - Green
    'oklch(0.75 0.2 80)',   // Developing - Yellow
    'oklch(0.65 0.25 30)',  // Needs Review - Red
]

export function ConceptDrillDown({ concept, onBack, timeline }: { concept: ConceptMasteryWithDetails; onBack: () => void; timeline?: { date: string; mastery: number }[] }) {
    return (
        <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.04] via-background to-background shadow-lg overflow-hidden">
            <CardHeader className="border-b bg-background/40 backdrop-blur-sm px-4 py-4 md:px-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={onBack} className="shrink-0 h-9 w-9 rounded-xl border-primary/20 hover:bg-primary/10">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-xl font-bold tracking-tight truncate max-w-[200px] md:max-w-none">
                                {concept.concept_name}
                            </CardTitle>
                            {masteryLevelBadge(concept.display_mastery_level)}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            {concept.document_title ?? 'Unknown document'}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="relative group overflow-hidden rounded-2xl border border-primary/10 bg-background p-4 transition-all hover:bg-primary/[0.02] hover:shadow-md">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <p className="text-2xl font-black text-primary">{Math.round(concept.display_mastery_score)}%</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Mastery Score</p>
                    </div>
                    <div className="relative group overflow-hidden rounded-2xl border border-primary/10 bg-background p-4 transition-all hover:bg-primary/[0.02] hover:shadow-md">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 group-hover:scale-110 transition-transform">
                            <Gauge className="h-5 w-5" />
                        </div>
                        <p className="text-2xl font-black">{Math.round(concept.confidence * 100)}%</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Confidence</p>
                    </div>
                    <div className="relative group overflow-hidden rounded-2xl border border-primary/10 bg-background p-4 transition-all hover:bg-primary/[0.02] hover:shadow-md">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
                            <Zap className="h-5 w-5" />
                        </div>
                        <p className="text-2xl font-black">{concept.total_attempts}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Total Attempts</p>
                    </div>
                    <div className="relative group overflow-hidden rounded-2xl border border-primary/10 bg-background p-4 transition-all hover:bg-primary/[0.02] hover:shadow-md">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <p className="text-2xl font-black">{concept.correct_attempts}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Correct Answers</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Mastery Progress</span>
                        <span className="text-primary">{Math.round(concept.display_mastery_score)}/100</span>
                    </div>
                    <Progress value={concept.mastery_score} className="h-3 rounded-full bg-primary/10" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-primary/5 bg-muted/30 p-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 mb-4 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            Review Statistics
                        </h4>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Due Date</p>
                                <p className="text-sm font-bold mt-0.5">{concept.due_date}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Interval</p>
                                <p className="text-sm font-bold mt-0.5">{concept.interval_days} days</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Ease Factor</p>
                                <p className="text-sm font-bold mt-0.5">{concept.ease_factor}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Last Reviewed</p>
                                <p className="text-sm font-bold mt-0.5">
                                    {concept.last_reviewed_at 
                                        ? new Date(concept.last_reviewed_at).toLocaleDateString()
                                        : "Never"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {timeline && timeline.length > 1 ? (
                        <div className="rounded-2xl border border-primary/5 bg-muted/30 p-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Mastery Trend
                            </h4>
                            <div className="h-[120px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={timeline} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                        <XAxis dataKey="date" hide />
                                        <YAxis domain={[0, 100]} hide />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Line 
                                            type="monotone" 
                                            dataKey="mastery" 
                                            stroke="var(--primary)" 
                                            strokeWidth={3} 
                                            dot={false}
                                            animationDuration={1500}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-primary/10 flex flex-col items-center justify-center p-6 text-center">
                            <Activity className="h-8 w-8 text-muted-foreground opacity-20 mb-2" />
                            <p className="text-xs text-muted-foreground font-medium">Keep practicing to unlock mastery trends</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function AnalyticsContent() {
    const { data: stats, isLoading: statsLoading, isError: statsError } = useLearningStats()
    const { data: masteryList, isLoading: masteryLoading, isError: masteryError } = useConceptMasteryList()
    const { data: weakTopics } = useWeakTopics(10)
    const { data: attempts } = useUserAttempts()
    const { data: quizzes } = useQuizzes()
    const { data: scoreTrend } = useScoreTrend()
    const { data: studyActivity } = useStudyActivity()
    const { data: globalTimeline } = useMasteryTimeline()

    const [drillDownConcept, setDrillDownConcept] = useState<ConceptMasteryWithDetails | null>(null)
    const [selectedPerformanceDocumentId, setSelectedPerformanceDocumentId] = useState<string | null>(null)

    const { data: conceptTimeline } = useMasteryTimeline(drillDownConcept?.concept_id ?? undefined)
    const performanceMasteryList = useMemo(
        () => (masteryList || []).filter((item) => item.total_attempts > 0),
        [masteryList],
    )

    const quizMap = useMemo(() => {
        return new Map((quizzes || []).map((q) => [q.id, q]))
    }, [quizzes])

    const recentAttempts = useMemo(() => {
        return (attempts || [])
            .filter((a) => a.completed_at)
            .slice(0, 10)
            .map((a) => ({
                ...a,
                quizTitle: quizMap.get(a.quiz_id)?.title ?? 'Unknown Quiz',
            }))
    }, [attempts, quizMap])

    const performanceByDocument = useMemo(() => {
        const groups = new Map<string, { title: string; concepts: typeof masteryList }>()
        for (const item of performanceMasteryList) {
            const key = item.document_id ?? 'unknown'
            const title = item.document_title ?? 'Unknown Document'
            if (!groups.has(key)) {
                groups.set(key, { title, concepts: [] })
            }
            groups.get(key)!.concepts!.push(item)
        }

        return Array.from(groups.entries()).map(([docId, group]) => {
            const scores = group.concepts!.map((c) => Number(c.display_mastery_score))
            const avg = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0
            return {
                documentId: docId,
                title: group.title,
                averageMastery: avg,
                conceptCount: group.concepts!.length,
                masteredCount: group.concepts!.filter((c) => c.display_mastery_level === 'mastered').length,
            }
        }).sort((a, b) => b.averageMastery - a.averageMastery)
    }, [performanceMasteryList])

    const distributionData = useMemo(() => [
        { name: 'Mastered', value: stats?.masteredCount ?? 0 },
        { name: 'Developing', value: stats?.developingCount ?? 0 },
        { name: 'Needs Review', value: stats?.needsReviewCount ?? 0 },
    ], [stats])

    const isLoading = statsLoading || masteryLoading
    const scoreState = (stats?.averageScore ?? 0) >= 80
        ? "Excellent"
        : (stats?.averageScore ?? 0) >= 60
            ? "Improving"
            : "Early stage"
    const scoreStateColor = (stats?.averageScore ?? 0) >= 80
        ? "text-green-600"
        : (stats?.averageScore ?? 0) >= 60
            ? "text-amber-600"
            : "text-slate-600"
    const performanceAverage = performanceByDocument.length > 0
        ? Math.round(
            performanceByDocument.reduce((sum, item) => sum + item.averageMastery, 0) / performanceByDocument.length,
        )
        : 0
    const topDocument = performanceByDocument[0]
    const strongestConcept = performanceMasteryList.reduce<ConceptMasteryWithDetails | null>(
        (best, item) => {
            if (!best) return item
            return Number(item.display_mastery_score) > Number(best.display_mastery_score) ? item : best
        },
        null,
    )
    const selectedDocumentId =
        selectedPerformanceDocumentId && performanceByDocument.some((d) => d.documentId === selectedPerformanceDocumentId)
            ? selectedPerformanceDocumentId
            : (topDocument?.documentId ?? null)
    const selectedDocumentData = selectedDocumentId
        ? performanceByDocument.find((d) => d.documentId === selectedDocumentId) ?? null
        : null
    const conceptsForSelectedDocument = selectedDocumentId
        ? performanceMasteryList.filter((c) => (c.document_id ?? "unknown") === selectedDocumentId)
        : performanceMasteryList

    return (
        <div className="space-y-6">
            <Card className="border-primary/10 bg-gradient-to-r from-primary/[0.08] via-background to-background">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Your learning snapshot</p>
                            <p className="text-sm text-muted-foreground">
                                Focus next on weak topics and trends to keep momentum.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                        <div className="rounded-lg border bg-background/90 px-3 py-2 text-center">
                            <p className="text-xs text-muted-foreground">Mastered</p>
                            <p className="font-semibold">{stats?.masteredCount ?? 0}</p>
                        </div>
                        <div className="rounded-lg border bg-background/90 px-3 py-2 text-center">
                            <p className="text-xs text-muted-foreground">Streak</p>
                            <p className="font-semibold">{stats?.studyStreak ?? 0}d</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <AnalyticsSkeleton />
            ) : (statsError || masteryError) ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <p className="text-lg font-semibold mb-2">Could not load analytics</p>
                        <p className="text-muted-foreground mb-4">
                            Something went wrong while fetching your learning data. Please try refreshing the page.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-primary/15 bg-gradient-to-b from-primary/5 to-background">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Concepts Tracked</CardTitle>
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                                    <Target className="h-4 w-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-2xl font-bold">{stats?.totalConcepts ?? 0}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="text-green-600">{stats?.masteredCount ?? 0} mastered</span>
                                    <span>·</span>
                                    <span className="text-yellow-600">{stats?.developingCount ?? 0} developing</span>
                                    <span>·</span>
                                    <span className="text-red-600">{stats?.needsReviewCount ?? 0} needs review</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                                    <Brain className="h-4 w-4 text-blue-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.quizzesCompleted ?? 0}</div>
                                <p className="text-xs text-muted-foreground">Total attempts</p>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
                                    <Trophy className="h-4 w-4 text-emerald-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.averageScore ?? 0}%</div>
                                <p className={`text-xs font-medium ${scoreStateColor}`}>{scoreState}</p>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/10">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.studyStreak ?? 0} days</div>
                                <p className="text-xs text-muted-foreground">
                                    {(stats?.studyStreak ?? 0) > 0 ? "Keep it up!" : "Start a streak today"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Study Activity Heatmap */}
                    {studyActivity && studyActivity.length > 0 && (
                        <Card className="border-primary/10">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" />
                                    Study Activity
                                </CardTitle>
                                <CardDescription>Questions answered per day over the last 90 days</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ActivityHeatmap data={studyActivity} />
                            </CardContent>
                        </Card>
                    )}

                    <Tabs defaultValue="performance" className="w-full">
                        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1 md:grid-cols-4">
                            <TabsTrigger value="performance" className="h-9 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">Performance</TabsTrigger>
                            <TabsTrigger value="trends" className="h-9 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">Trends</TabsTrigger>
                            <TabsTrigger value="weak-topics" className="h-9 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">Weak Topics</TabsTrigger>
                            <TabsTrigger value="history" className="h-9 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">Quiz History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="performance" className="mt-6 space-y-6">
                            {drillDownConcept ? (
                                <ConceptDrillDown
                                    concept={drillDownConcept}
                                    onBack={() => setDrillDownConcept(null)}
                                    timeline={conceptTimeline}
                                />
                            ) : performanceByDocument.length === 0 ? (
                                <Card>
                                    <CardContent className="text-center py-12">
                                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                        <p className="text-muted-foreground">
                                            No performance data yet. Take some quizzes to see your progress.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <Card className="md:col-span-1 border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background overflow-hidden relative">
                                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                                <Activity className="w-32 h-32 text-primary" />
                                            </div>
                                            <CardContent className="p-4 md:p-5 relative z-10 h-full flex flex-col">
                                                <div className="mb-4">
                                                    <h3 className="text-base font-bold tracking-tight">Performance</h3>
                                                    <p className="text-xs text-muted-foreground">Overall review stats</p>
                                                    <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                                                        {performanceAverage}% mastery
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2.5 flex-1 overflow-y-auto">
                                                    <div className="group flex items-center gap-3 rounded-xl border border-primary/10 bg-background/60 backdrop-blur-sm p-3 transition-all hover:border-primary/30 hover:bg-background/80 hover:shadow-md">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
                                                            <BookOpen className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Documents</p>
                                                            <p className="text-lg font-black leading-none">{performanceByDocument.length}</p>
                                                        </div>
                                                    </div>
                                                    <div className="group flex items-center gap-3 rounded-xl border border-primary/10 bg-background/60 backdrop-blur-sm p-3 transition-all hover:border-primary/30 hover:bg-background/80 hover:shadow-md">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600 group-hover:scale-110 transition-transform">
                                                            <Trophy className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Top File</p>
                                                            <p className="truncate text-sm font-bold leading-none">{topDocument?.title ?? "N/A"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="group flex items-center gap-3 rounded-xl border border-primary/10 bg-background/60 backdrop-blur-sm p-3 transition-all hover:border-primary/30 hover:bg-background/80 hover:shadow-md">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
                                                            <Zap className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Best Topic</p>
                                                            <p className="truncate text-sm font-bold leading-none">{strongestConcept?.concept_name ?? "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="md:col-span-2 border-primary/10 bg-background/40 backdrop-blur-sm">
                                            <CardHeader className="pb-2 pt-4 px-4">
                                                <CardTitle className="text-sm font-bold tracking-tight">Mastery Distribution</CardTitle>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-1">
                                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                                                    <div className="md:col-span-3 mx-auto w-full max-w-[320px]">
                                                        <ResponsiveContainer width="100%" height={260}>
                                                            <PieChart>
                                                                <Pie
                                                                    data={distributionData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={80}
                                                                    outerRadius={115}
                                                                    dataKey="value"
                                                                    paddingAngle={2}
                                                                >
                                                                    {distributionData.map((_, index) => (
                                                                        <Cell key={index} fill={PIE_COLORS[index]} stroke="var(--background)" strokeWidth={2} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip content={<ChartTooltip />} />
                                                                <text
                                                                    x="50%"
                                                                    y="50%"
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                    className="fill-foreground font-black text-2xl"
                                                                >
                                                                    {distributionData.reduce((acc, curr) => acc + curr.value, 0)}
                                                                </text>
                                                                <text
                                                                    x="50%"
                                                                    y="60%"
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                    className="fill-muted-foreground font-bold text-[10px] uppercase tracking-widest"
                                                                >
                                                                    Concepts
                                                                </text>
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="md:col-span-2 space-y-2">
                                                        {distributionData.map((entry, i) => (
                                                            <div key={entry.name} className="flex items-center justify-between rounded-xl border border-primary/5 bg-background/50 px-3 py-2.5 transition-all hover:bg-background/80 hover:shadow-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <div 
                                                                        className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor]" 
                                                                        style={{ backgroundColor: PIE_COLORS[i], color: PIE_COLORS[i] }} 
                                                                    />
                                                                    <span className="text-xs font-bold text-foreground/80">{entry.name}</span>
                                                                </div>
                                                                <span className="text-xs font-black text-primary">{entry.value} concepts</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                                        <Card className="xl:col-span-3 border-primary/10">
                                            <CardHeader>
                                                <CardTitle>Performance by Document</CardTitle>
                                            <CardDescription>Select a document card to open detailed performance analytics</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={Math.max(220, performanceByDocument.length * 52)}>
                                                    <BarChart 
                                                        data={performanceByDocument} 
                                                        layout="vertical" 
                                                        margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                                                        barSize={24}
                                                    >
                                                        <defs>
                                                            <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                                                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                                                                <stop offset="100%" stopColor="var(--primary)" stopOpacity={1} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                                                        <XAxis 
                                                            type="number" 
                                                            domain={[0, 100]} 
                                                            tickFormatter={(v) => `${v}%`} 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                                        />
                                                        <YAxis 
                                                            dataKey="title" 
                                                            type="category" 
                                                            width={120} 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 }}
                                                        />
                                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--primary)', opacity: 0.05 }} />
                                                        <Bar 
                                                            name="Mastery"
                                                            dataKey="averageMastery" 
                                                            fill="url(#barGradient)" 
                                                            radius={[0, 6, 6, 0]}
                                                            background={{ fill: 'var(--muted)', radius: 6, opacity: 0.4 }}
                                                            animationDuration={1500}
                                                            animationEasing="ease-out"
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                                <div className="mt-4 border-t pt-4">
                                                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Open document analytics
                                                    </p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                        {performanceByDocument
                                                            .filter((d) => d.documentId !== "unknown")
                                                            .map((d) => (
                                                                <button
                                                                    key={d.documentId}
                                                                    type="button"
                                                                    onClick={() => setSelectedPerformanceDocumentId(d.documentId)}
                                                                    className={`group relative overflow-hidden w-full rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                                                                        selectedDocumentId === d.documentId 
                                                                            ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20" 
                                                                            : "border-primary/5 bg-background hover:border-primary/30 hover:bg-primary/[0.02]"
                                                                    }`}
                                                                >
                                                                    {selectedDocumentId === d.documentId && (
                                                                        <div className="absolute top-0 right-0 p-1">
                                                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                        </div>
                                                                    )}
                                                                    <div className="mb-3 flex items-start justify-between gap-2">
                                                                        <span className="truncate font-bold text-sm tracking-tight">{d.title}</span>
                                                                        <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                                                                            {d.averageMastery}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <Progress value={d.averageMastery} className="h-1.5 bg-primary/10" />
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">
                                                                        <span className="flex items-center gap-1">
                                                                            <Target className="w-3 h-3" />
                                                                            {d.masteredCount}/{d.conceptCount} mastered
                                                                        </span>
                                                                        <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                                                                            {selectedDocumentId === d.documentId ? "Active" : "View detail"}
                                                                            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="xl:col-span-2 border-primary/10">
                                            <CardHeader>
                                                <CardTitle>Topic Explorer</CardTitle>
                                                <CardDescription>
                                                    {selectedDocumentData
                                                        ? `Topics inside ${selectedDocumentData.title}`
                                                        : "Select a document to view its topics"}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {selectedDocumentData && selectedDocumentData.documentId !== "unknown" && (
                                                    <div className="mb-3">
                                                        <Link
                                                            to={`/analytics/document/${selectedDocumentData.documentId}`}
                                                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                                        >
                                                            Open full document analytics
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </div>
                                                )}
                                                <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                                                    {conceptsForSelectedDocument.length === 0 ? (
                                                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                            No topics found for this document yet.
                                                        </div>
                                                    ) : (
                                                        conceptsForSelectedDocument.map((c) => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => setDrillDownConcept(c)}
                                                                className="group w-full rounded-xl border border-primary/5 bg-background/40 p-4 text-left transition-all hover:bg-background hover:border-primary/20 hover:shadow-sm"
                                                            >
                                                                <div className="mb-3 flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate font-bold text-sm leading-none mb-1 group-hover:text-primary transition-colors">{c.concept_name}</p>
                                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                            <BookOpen className="w-3 h-3" />
                                                                            <p className="truncate text-xs font-medium">{c.document_title ?? "Unknown document"}</p>
                                                                        </div>
                                                                    </div>
                                                                    {masteryLevelBadge(c.display_mastery_level)}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1">
                                                                        <Progress value={c.display_mastery_score} className="h-1.5 bg-primary/10" />
                                                                    </div>
                                                                    <span className="w-10 shrink-0 text-right text-xs font-black text-primary/80">
                                                                        {Math.round(c.display_mastery_score)}%
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="trends" className="mt-6 space-y-6">
                            {/* Mastery Over Time */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-purple-500" />
                                        Mastery Over Time
                                    </CardTitle>
                                    <CardDescription>Daily average mastery across all concepts (last 30 days)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!globalTimeline || globalTimeline.length < 2 ? (
                                        <div className="text-center py-12">
                                            <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Not enough mastery data yet. Take a few quizzes across different sessions to see your mastery trend.
                                            </p>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={globalTimeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 12 }} />
                                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                <Tooltip
                                                    formatter={(value) => {
                                                        const display = Array.isArray(value) ? value[0] : (value ?? 0)
                                                        return [`${display}%`, 'Avg Mastery']
                                                    }}
                                                />
                                                <Line type="monotone" dataKey="mastery" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Score Trend */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Score Trend</CardTitle>
                                    <CardDescription>Average quiz score per day over the last 30 days</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!scoreTrend || scoreTrend.length === 0 ? (
                                        <div className="text-center py-12">
                                            <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                No quiz data in the last 30 days. Take some quizzes to see trends.
                                            </p>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={scoreTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 12 }} />
                                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                <Tooltip content={<ChartTooltip />} />
                                                <Line 
                                                    name="Avg Score"
                                                    type="monotone" 
                                                    dataKey="score" 
                                                    stroke="var(--primary)" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }} 
                                                    activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                        </TabsContent>

                        <TabsContent value="weak-topics" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                                        Topics Needing Attention
                                    </CardTitle>
                                    <CardDescription>These concepts have lower mastery scores and need more practice</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!weakTopics || weakTopics.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                No weak topics detected. Great job!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {weakTopics.map((topic) => (
                                                <button
                                                    key={topic.id}
                                                    onClick={() => setDrillDownConcept(topic)}
                                                    className="w-full p-4 rounded-lg border bg-orange-500/5 border-orange-500/20 text-left hover:bg-orange-500/10 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div>
                                                            <p className="font-semibold">{topic.concept_name}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {topic.document_title ?? 'Unknown document'}
                                                                {topic.concept_category && ` · ${topic.concept_category}`}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {masteryLevelBadge(topic.display_mastery_level)}
                                                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                                                                {Math.round(topic.display_mastery_score)}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Progress value={topic.display_mastery_score} className="h-2" />
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                        <span>{topic.total_attempts} attempt{topic.total_attempts !== 1 ? 's' : ''}</span>
                                                        <span>Confidence: {Math.round(topic.confidence * 100)}%</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Quizzes</CardTitle>
                                    <CardDescription>Your most recent quiz attempts</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {recentAttempts.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                No quiz attempts yet. Take a quiz to see your history.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentAttempts.map((attempt) => (
                                                <div
                                                    key={attempt.id}
                                                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                            <Brain className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">{attempt.quizTitle}</p>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <span>{attempt.correct_answers}/{attempt.total_questions} correct</span>
                                                                <span>·</span>
                                                                <Calendar className="w-3 h-3" />
                                                                <span>
                                                                    {attempt.completed_at
                                                                        ? new Date(attempt.completed_at).toLocaleDateString()
                                                                        : 'In progress'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-2xl font-bold ${Number(attempt.score) >= 80
                                                                ? "text-green-600"
                                                                : Number(attempt.score) >= 60
                                                                    ? "text-yellow-600"
                                                                    : "text-red-600"
                                                            }`}>
                                                            {Math.round(Number(attempt.score))}%
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}
