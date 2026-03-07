import { useMemo } from "react"
import {
    Brain,
    Clock,
    Calendar,
    Target,
    BookOpen,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useConceptMasteryList, useLearningStats } from "@/hooks/useLearning"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { Link } from "react-router-dom"

function masteryBadge(level: string) {
    switch (level) {
        case 'mastered':
            return <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">Mastered</Badge>
        case 'developing':
            return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 text-xs">Developing</Badge>
        default:
            return <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">Needs Review</Badge>
    }
}

function daysUntilDue(dueDateStr: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDateStr + 'T00:00:00')
    return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function dueLabel(dueDateStr: string): string {
    const days = daysUntilDue(dueDateStr)
    if (days < 0) return `${Math.abs(days)}d overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `Due in ${days}d`
}

interface TopicSections {
    dueToday: ConceptMasteryWithDetails[]
    needsReview: ConceptMasteryWithDetails[]
    developing: ConceptMasteryWithDetails[]
    mastered: ConceptMasteryWithDetails[]
}

function TopicCard({ topic }: { topic: ConceptMasteryWithDetails }) {
    const days = daysUntilDue(topic.due_date)

    return (
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                topic.mastery_level === 'mastered' ? 'bg-green-100' :
                topic.mastery_level === 'developing' ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
                {topic.mastery_level === 'mastered' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : topic.mastery_level === 'developing' ? (
                    <BookOpen className="w-5 h-5 text-yellow-600" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{topic.concept_name}</p>
                    {masteryBadge(topic.mastery_level)}
                </div>
                <Progress value={topic.mastery_score} className="h-1.5 mb-2" />
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{Math.round(topic.mastery_score)}% mastery</span>
                    <span>·</span>
                    <span>Confidence: {Math.round(topic.confidence * 100)}%</span>
                    <span>·</span>
                    <span className={days <= 0 ? 'text-red-600 font-medium' : ''}>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {dueLabel(topic.due_date)}
                    </span>
                    {topic.document_title && (
                        <>
                            <span>·</span>
                            <span className="truncate">{topic.document_title}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex gap-1 shrink-0">
                {topic.document_id && (
                    <Link to={`/files/${topic.document_id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Review
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    )
}

function SectionBlock({
    title,
    icon,
    items,
    emptyMessage,
}: {
    title: string
    icon: React.ReactNode
    items: ConceptMasteryWithDetails[]
    emptyMessage: string
}) {
    if (items.length === 0) return null

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    {title}
                    <Badge variant="outline" className="ml-auto">{items.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
                ) : (
                    <div className="space-y-2">
                        {items.map((topic) => (
                            <TopicCard key={topic.id} topic={topic} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function LearningPathContent() {
    const { data: masteryList, isLoading: masteryLoading, isError: masteryError } = useConceptMasteryList()
    const { data: stats, isLoading: statsLoading, isError: statsError } = useLearningStats()

    const sections: TopicSections = useMemo(() => {
        const all = masteryList || []
        const today = new Date().toISOString().split('T')[0]

        const dueToday = all.filter((m) => m.due_date <= today)
            .sort((a, b) => b.priority_score - a.priority_score)

        const dueTodayIds = new Set(dueToday.map((m) => m.id))

        const needsReview = all.filter(
            (m) => m.mastery_level === 'needs_review' && !dueTodayIds.has(m.id),
        ).sort((a, b) => a.mastery_score - b.mastery_score)

        const developing = all.filter(
            (m) => m.mastery_level === 'developing' && !dueTodayIds.has(m.id),
        ).sort((a, b) => a.mastery_score - b.mastery_score)

        const mastered = all.filter(
            (m) => m.mastery_level === 'mastered' && !dueTodayIds.has(m.id),
        ).sort((a, b) => b.mastery_score - a.mastery_score)

        return { dueToday, needsReview, developing, mastered }
    }, [masteryList])

    const isLoading = masteryLoading || statsLoading

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Learning Path</h1>
                            <p className="text-muted-foreground">Your personalized study priorities</p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (masteryError || statsError) ? (
                    <Card>
                        <CardContent className="text-center py-16">
                            <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Could not load learning path</h3>
                            <p className="text-muted-foreground mb-4">
                                Something went wrong fetching your data. Please try refreshing.
                            </p>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                Refresh Page
                            </Button>
                        </CardContent>
                    </Card>
                ) : (masteryList || []).length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-16">
                            <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No learning data yet</h3>
                            <p className="text-muted-foreground mb-4">
                                Upload study materials and take quizzes to build your personalized learning path.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Link to="/files">
                                    <Button variant="outline">Upload Materials</Button>
                                </Link>
                                <Link to="/quizzes">
                                    <Button>Take a Quiz</Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Due Today</CardTitle>
                                    <Target className="w-4 h-4 text-red-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{sections.dueToday.length}</div>
                                    <p className="text-xs text-muted-foreground">Topics to review</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.needsReviewCount ?? 0}</div>
                                    <p className="text-xs text-muted-foreground">Weak concepts</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Developing</CardTitle>
                                    <BookOpen className="w-4 h-4 text-yellow-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.developingCount ?? 0}</div>
                                    <p className="text-xs text-muted-foreground">Getting there</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Mastered</CardTitle>
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.masteredCount ?? 0}</div>
                                    <p className="text-xs text-muted-foreground">Solid knowledge</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Overall Mastery */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Overall Readiness</CardTitle>
                                <CardDescription>
                                    Your aggregate mastery across {stats?.totalConcepts ?? 0} tracked concepts
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl font-bold text-primary">
                                        {stats?.averageMastery ?? 0}%
                                    </div>
                                    <Progress value={stats?.averageMastery ?? 0} className="flex-1 h-3" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Prioritized Sections */}
                        <SectionBlock
                            title="Due Today"
                            icon={<Target className="w-5 h-5 text-red-500" />}
                            items={sections.dueToday}
                            emptyMessage="Nothing due today — you're caught up!"
                        />

                        <SectionBlock
                            title="Needs Review"
                            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
                            items={sections.needsReview}
                            emptyMessage="No weak topics"
                        />

                        <SectionBlock
                            title="Developing"
                            icon={<BookOpen className="w-5 h-5 text-yellow-500" />}
                            items={sections.developing}
                            emptyMessage="No developing topics"
                        />

                        <SectionBlock
                            title="Mastered"
                            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                            items={sections.mastered}
                            emptyMessage="No mastered topics yet"
                        />
                    </>
                )}
            </div>
        </main>
    )
}
