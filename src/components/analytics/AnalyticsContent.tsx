import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    TrendingUp,
    Target,
    Brain,
    Calendar,
    Flame,
    BookOpen,
    AlertTriangle,
    BarChart3,
    Loader2,
    ArrowLeft,
    Clock,
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid,
    PieChart, Pie, Cell,
} from "recharts"
import {
    useLearningStats, useConceptMasteryList, useWeakTopics,
    useScoreTrend, useStudyActivity,
} from "@/hooks/useLearning"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { useUserAttempts, useQuizzes } from "@/hooks/useQuizzes"

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

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444']

function ActivityHeatmap({ data }: { data: { date: string; count: number }[] }) {
    const weeks = useMemo(() => {
        const map = new Map(data.map((d) => [d.date, d.count]))
        const cells: { date: string; count: number; weekIndex: number; dayIndex: number }[] = []
        const today = new Date()
        for (let i = 89; i >= 0; i--) {
            const d = new Date(today)
            d.setUTCDate(d.getUTCDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const weekIndex = Math.floor((89 - i) / 7)
            const dayIndex = d.getUTCDay()
            cells.push({ date: dateStr, count: map.get(dateStr) ?? 0, weekIndex, dayIndex })
        }
        return cells
    }, [data])

    const maxCount = Math.max(1, ...weeks.map((w) => w.count))

    return (
        <div className="flex gap-[3px] flex-wrap">
            {weeks.map((cell) => {
                const intensity = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / maxCount) * 4))
                const bg = [
                    'bg-muted',
                    'bg-green-200',
                    'bg-green-300',
                    'bg-green-500',
                    'bg-green-700',
                ][intensity]
                return (
                    <div
                        key={cell.date}
                        className={`w-3 h-3 rounded-sm ${bg}`}
                        title={`${cell.date}: ${cell.count} question${cell.count !== 1 ? 's' : ''}`}
                    />
                )
            })}
        </div>
    )
}

function ConceptDrillDown({ concept, onBack }: { concept: ConceptMasteryWithDetails; onBack: () => void }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                            {concept.concept_name}
                            {masteryLevelBadge(concept.mastery_level)}
                        </CardTitle>
                        <CardDescription>{concept.document_title ?? 'Unknown document'}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{Math.round(concept.mastery_score)}%</p>
                        <p className="text-xs text-muted-foreground">Mastery</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{Math.round(concept.confidence * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Confidence</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{concept.total_attempts}</p>
                        <p className="text-xs text-muted-foreground">Total Attempts</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{concept.correct_attempts}</p>
                        <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                </div>
                <Progress value={concept.mastery_score} className="h-3" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Due: {concept.due_date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Interval: {concept.interval_days} day{concept.interval_days !== 1 ? 's' : ''}</span>
                    </div>
                    {concept.concept_category && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <BookOpen className="w-4 h-4" />
                            <span>Category: {concept.concept_category}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>Ease: {concept.ease_factor}</span>
                    </div>
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

    const [drillDownConcept, setDrillDownConcept] = useState<ConceptMasteryWithDetails | null>(null)

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
        for (const item of masteryList || []) {
            const key = item.document_id ?? 'unknown'
            const title = item.document_title ?? 'Unknown Document'
            if (!groups.has(key)) {
                groups.set(key, { title, concepts: [] })
            }
            groups.get(key)!.concepts!.push(item)
        }

        return Array.from(groups.entries()).map(([docId, group]) => {
            const scores = group.concepts!.map((c) => Number(c.mastery_score))
            const avg = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0
            return {
                documentId: docId,
                title: group.title,
                averageMastery: avg,
                conceptCount: group.concepts!.length,
                masteredCount: group.concepts!.filter((c) => c.mastery_level === 'mastered').length,
            }
        }).sort((a, b) => b.averageMastery - a.averageMastery)
    }, [masteryList])

    const distributionData = useMemo(() => [
        { name: 'Mastered', value: stats?.masteredCount ?? 0 },
        { name: 'Developing', value: stats?.developingCount ?? 0 },
        { name: 'Needs Review', value: stats?.needsReviewCount ?? 0 },
    ], [stats])

    const isLoading = statsLoading || masteryLoading

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Track your learning progress and performance</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
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
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Concepts Tracked</CardTitle>
                                <Target className="w-4 h-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.totalConcepts ?? 0}</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <span className="text-green-600">{stats?.masteredCount ?? 0} mastered</span>
                                    <span>·</span>
                                    <span className="text-yellow-600">{stats?.developingCount ?? 0} developing</span>
                                    <span>·</span>
                                    <span className="text-red-600">{stats?.needsReviewCount ?? 0} needs review</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
                                <Brain className="w-4 h-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.quizzesCompleted ?? 0}</div>
                                <p className="text-xs text-muted-foreground">Total attempts</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.averageScore ?? 0}%</div>
                                <p className="text-xs text-muted-foreground">Across all quizzes</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
                                <Flame className="w-4 h-4 text-orange-500" />
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Study Activity</CardTitle>
                                <CardDescription>Questions answered per day over the last 90 days</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ActivityHeatmap data={studyActivity} />
                            </CardContent>
                        </Card>
                    )}

                    <Tabs defaultValue="performance" className="w-full">
                        <TabsList className="grid w-full max-w-2xl grid-cols-4">
                            <TabsTrigger value="performance">Performance</TabsTrigger>
                            <TabsTrigger value="trends">Trends</TabsTrigger>
                            <TabsTrigger value="weak-topics">Weak Topics</TabsTrigger>
                            <TabsTrigger value="history">Quiz History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="performance" className="mt-6 space-y-6">
                            {drillDownConcept ? (
                                <ConceptDrillDown
                                    concept={drillDownConcept}
                                    onBack={() => setDrillDownConcept(null)}
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
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Performance by Document</CardTitle>
                                            <CardDescription>Average mastery across concepts in each document</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={Math.max(200, performanceByDocument.length * 50)}>
                                                <BarChart data={performanceByDocument} layout="vertical" margin={{ left: 20, right: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                    <YAxis dataKey="title" type="category" width={150} tick={{ fontSize: 12 }} />
                                                    <Tooltip formatter={(value: number) => [`${value}%`, 'Mastery']} />
                                                    <Bar dataKey="averageMastery" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Mastery Distribution Pie */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Mastery Distribution</CardTitle>
                                            <CardDescription>Breakdown of your concept mastery levels</CardDescription>
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
                                                                <Cell key={index} fill={PIE_COLORS[index]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
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

                                    {/* Clickable concept list */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>All Concepts</CardTitle>
                                            <CardDescription>Click a concept to see detailed analytics</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {(masteryList || []).map((c) => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => setDrillDownConcept(c)}
                                                        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="font-medium truncate">{c.concept_name}</span>
                                                            {masteryLevelBadge(c.mastery_level)}
                                                        </div>
                                                        <span className="font-bold text-sm shrink-0 ml-2">
                                                            {Math.round(c.mastery_score)}%
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="trends" className="mt-6 space-y-6">
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
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(d: string) => d.slice(5)}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                <Tooltip formatter={(value: number) => [`${value}%`, 'Avg Score']} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="score"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
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
                                                            {masteryLevelBadge(topic.mastery_level)}
                                                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                                                                {Math.round(topic.mastery_score)}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Progress value={topic.mastery_score} className="h-2" />
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
