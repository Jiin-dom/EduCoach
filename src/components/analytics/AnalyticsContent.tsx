import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import { useLearningStats, useConceptMasteryList, useWeakTopics } from "@/hooks/useLearning"
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

export function AnalyticsContent() {
    const { data: stats, isLoading: statsLoading } = useLearningStats()
    const { data: masteryList, isLoading: masteryLoading } = useConceptMasteryList()
    const { data: weakTopics } = useWeakTopics(10)
    const { data: attempts } = useUserAttempts()
    const { data: quizzes } = useQuizzes()

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

    // Group mastery by document for the performance tab
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

                    <Tabs defaultValue="performance" className="w-full">
                        <TabsList className="grid w-full max-w-lg grid-cols-3">
                            <TabsTrigger value="performance">Performance</TabsTrigger>
                            <TabsTrigger value="weak-topics">Weak Topics</TabsTrigger>
                            <TabsTrigger value="history">Quiz History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="performance" className="mt-6 space-y-6">
                            {performanceByDocument.length === 0 ? (
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
                                            <div className="space-y-6">
                                                {performanceByDocument.map((doc) => (
                                                    <div key={doc.documentId} className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <BookOpen className="w-4 h-4 text-primary" />
                                                                <span className="font-medium">{doc.title}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="secondary">
                                                                    {doc.masteredCount}/{doc.conceptCount} mastered
                                                                </Badge>
                                                                <span className="font-bold text-lg">{doc.averageMastery}%</span>
                                                            </div>
                                                        </div>
                                                        <Progress value={doc.averageMastery} className="h-2" />
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Mastery Distribution */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Mastery Distribution</CardTitle>
                                            <CardDescription>Breakdown of your concept mastery levels</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-48 flex items-end justify-around gap-4 px-4">
                                                {[
                                                    { label: 'Mastered', count: stats?.masteredCount ?? 0, color: 'bg-green-500' },
                                                    { label: 'Developing', count: stats?.developingCount ?? 0, color: 'bg-yellow-500' },
                                                    { label: 'Needs Review', count: stats?.needsReviewCount ?? 0, color: 'bg-red-500' },
                                                ].map((bucket) => {
                                                    const total = stats?.totalConcepts ?? 1
                                                    const pct = total > 0 ? (bucket.count / total) * 100 : 0
                                                    return (
                                                        <div key={bucket.label} className="flex flex-col items-center gap-2 flex-1">
                                                            <span className="text-sm font-bold">{bucket.count}</span>
                                                            <div
                                                                className={`w-full ${bucket.color} rounded-t-lg transition-all`}
                                                                style={{ height: `${Math.max(5, pct)}%` }}
                                                            />
                                                            <span className="text-xs text-muted-foreground text-center">{bucket.label}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
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
                                                <div key={topic.id} className="p-4 rounded-lg border bg-orange-500/5 border-orange-500/20">
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
                                                </div>
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
