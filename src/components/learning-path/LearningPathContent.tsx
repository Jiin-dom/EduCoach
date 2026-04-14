import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react"
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
    Play,
    TrendingUp,
    Zap,
    HelpCircle,
    Layers,
    Sparkles,
    FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useLearningStats } from "@/hooks/useLearning"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { useWeeklyProgress } from "@/hooks/useLearningProgress"
import { useGenerateReviewQuiz } from "@/hooks/useQuizzes"
import type { AdaptiveStudyTask } from "@/hooks/useAdaptiveStudy"
import { useLearningPathPlan } from "@/hooks/useLearningPathPlan"
import type {
    GoalMarkerPlanItem,
    PlannedReviewPlanItem,
} from "@/lib/learningPathPlan"
import { Link, useNavigate } from "react-router-dom"
import { toast } from 'sonner'

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

function adaptiveTaskIcon(task: AdaptiveStudyTask) {
    switch (task.type) {
        case 'quiz':
            return <Sparkles className="w-4 h-4 text-primary" />
        case 'flashcards':
            return <Layers className="w-4 h-4 text-blue-600" />
        default:
            return <FileText className="w-4 h-4 text-amber-600" />
    }
}

function adaptiveTaskActionLabel(task: AdaptiveStudyTask) {
    if (task.type === 'quiz') {
        if (task.status === 'generating') return 'View Quiz Queue'
        if (task.status === 'ready') return 'Start Quiz'
        return 'Generate Quiz'
    }
    if (task.type === 'flashcards') return 'Study Cards'
    return 'Review Concepts'
}

function AdaptiveTaskCard({
    task,
    onAction,
}: {
    task: AdaptiveStudyTask
    onAction: (task: AdaptiveStudyTask) => void
}) {
    const isUrgent = task.reason === 'due_today' || task.reason === 'needs_review'

    return (
        <Card>
            <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-50' : 'bg-primary/10'}`}>
                        {adaptiveTaskIcon(task)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-medium">{task.title}</p>
                            <Badge variant="outline" className="text-xs">
                                {task.type === 'quiz' ? `${task.count} questions` : task.type === 'flashcards' ? `${task.count} cards` : `${task.count} concepts`}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                                {task.reason === 'due_today' ? 'Due now' : task.reason === 'needs_review' ? 'Weak area' : 'Build mastery'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{task.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{task.documentTitle}</span>
                            <span>·</span>
                            <span>{task.scheduledDate}</span>
                            <span>·</span>
                            <span>{Math.round(task.priorityScore * 100)}% priority</span>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={() => onAction(task)}
                    variant={task.type === 'quiz' ? 'default' : 'outline'}
                    className="w-full sm:w-auto"
                >
                    {task.type === 'quiz' && task.status === 'generating' ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {adaptiveTaskActionLabel(task)}
                </Button>
            </CardContent>
        </Card>
    )
}

function GeneratedPlanCard({ item }: { item: PlannedReviewPlanItem }) {
    const goalDate = item.mastery.document_exam_date?.split("T")[0] ?? null

    return (
        <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium">{item.conceptName}</p>
                        <Badge variant="outline" className="text-xs">
                            Planned Baseline
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Scheduled for {dueLabel(item.date).toLowerCase()} from your current goal window.
                        {goalDate ? ` Goal date: ${goalDate}.` : ""}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 flex-wrap">
                        {item.documentTitle ? <span>{item.documentTitle}</span> : null}
                        {item.documentTitle ? <span>·</span> : null}
                        <span>{Math.round(item.priorityScore * 100)}% priority</span>
                    </div>
                </div>
                {item.documentId ? (
                    <Link to={`/files/${item.documentId}`}>
                        <Button variant="outline" size="sm">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Open
                        </Button>
                    </Link>
                ) : null}
            </CardContent>
        </Card>
    )
}

function GoalMarkerCard({ marker }: { marker: GoalMarkerPlanItem }) {
    return (
        <Card>
            <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium">{marker.title}</p>
                        <Badge variant="outline" className="text-xs">
                            {marker.markerType === "file_goal" ? "File Goal" : "Quiz Deadline"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {marker.markerType === "file_goal"
                            ? `Target date for ${marker.documentTitle}.`
                            : `Assessment deadline tied to ${marker.documentTitle}.`}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                        Scheduled for {new Date(marker.date + "T00:00:00").toLocaleDateString()}
                    </div>
                </div>
                {marker.quizId ? (
                    <Link to={`/quizzes/${marker.quizId}`}>
                        <Button variant="outline" size="sm">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Open
                        </Button>
                    </Link>
                ) : marker.documentId ? (
                    <Link to={`/files/${marker.documentId}`}>
                        <Button variant="outline" size="sm">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Open
                        </Button>
                    </Link>
                ) : null}
            </CardContent>
        </Card>
    )
}

function TopicCard({ topic, onSelect }: { topic: ConceptMasteryWithDetails; onSelect: (t: ConceptMasteryWithDetails) => void }) {
    const days = daysUntilDue(topic.due_date)
    return (
        <button
            onClick={() => onSelect(topic)}
            className="w-full flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors text-left">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${topic.display_mastery_level === 'mastered' ? 'bg-green-100' :
                    topic.display_mastery_level === 'developing' ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                {topic.display_mastery_level === 'mastered' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : topic.display_mastery_level === 'developing' ? (
                    <BookOpen className="w-5 h-5 text-yellow-600" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{topic.concept_name}</p>
                    {masteryBadge(topic.display_mastery_level)}
                </div>
                <Progress value={topic.display_mastery_score} className="h-1.5 mb-2" />
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{Math.round(topic.display_mastery_score)}% mastery</span>
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
                    <Link to={`/files/${topic.document_id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-xs">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Review
                        </Button>
                    </Link>
                )}
            </div>
        </button>
    )
}

function SectionBlock({
    title,
    icon,
    items,
    emptyMessage,
    onSelect,
}: {
    title: string
    icon: ReactNode
    items: ConceptMasteryWithDetails[]
    emptyMessage: string
    onSelect: (t: ConceptMasteryWithDetails) => void
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
                            <TopicCard key={topic.id} topic={topic} onSelect={onSelect} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ─── Concept Detail Dialog ────────────────────────────────────────────────────

function ConceptDetailDialog({
    concept,
    open,
    onClose,
}: {
    concept: ConceptMasteryWithDetails | null
    open: boolean
    onClose: () => void
}) {
    if (!concept) return null

    const days = daysUntilDue(concept.due_date)

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {concept.concept_name}
                        {masteryBadge(concept.display_mastery_level)}
                    </DialogTitle>
                    <DialogDescription>
                        {concept.document_title ?? 'Unknown document'}
                        {concept.concept_category && ` · ${concept.concept_category}`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-2xl font-bold">{Math.round(concept.display_mastery_score)}%</p>
                            <p className="text-xs text-muted-foreground">Display Mastery</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-2xl font-bold">{Math.round(concept.confidence * 100)}%</p>
                            <p className="text-xs text-muted-foreground">Confidence</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-2xl font-bold">{concept.total_attempts}</p>
                            <p className="text-xs text-muted-foreground">Attempts</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-2xl font-bold">
                                {concept.total_attempts > 0
                                    ? Math.round((concept.correct_attempts / concept.total_attempts) * 100)
                                    : 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">Accuracy</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">SM-2 Due Date</span>
                            <span className={days <= 0 ? 'text-red-600 font-medium' : ''}>
                                {dueLabel(concept.due_date)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">SM-2 Interval</span>
                            <span>{concept.interval_days} day{concept.interval_days !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Ease Factor</span>
                            <span>{Number(concept.ease_factor).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Stored Mastery</span>
                            <span>{Math.round(concept.mastery_score)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Reviewed</span>
                            <span>{concept.last_reviewed_at
                                ? new Date(concept.last_reviewed_at).toLocaleDateString()
                                : 'Never'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Priority Score</span>
                            <span>{(concept.priority_score * 100).toFixed(0)}%</span>
                        </div>
                    </div>

                    {concept.display_mastery_score < concept.mastery_score && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 text-xs">
                            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                Display mastery is lower than stored ({Math.round(concept.mastery_score)}%) because this concept is overdue for review. Take a quiz to restore it!
                            </span>
                        </div>
                    )}

                    {concept.document_id && (
                        <Link to={`/files/${concept.document_id}`} onClick={onClose}>
                            <Button className="w-full" variant="outline">
                                <ArrowUpRight className="w-4 h-4 mr-2" />
                                Open Document
                            </Button>
                        </Link>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function LearningPathContent() {
    const plan = useLearningPathPlan()
    const { data: stats, isLoading: statsLoading, isError: statsError } = useLearningStats()
    const { data: weeklyProgress } = useWeeklyProgress()
    const generateReview = useGenerateReviewQuiz()
    const navigate = useNavigate()

    const [selectedConcept, setSelectedConcept] = useState<ConceptMasteryWithDetails | null>(null)
    const autoGeneratedTaskIds = useRef<Set<string>>(new Set())

    const performanceMasteryList = useMemo(
        () => plan.performancePlannedReviews.map((item) => item.mastery as ConceptMasteryWithDetails),
        [plan.performancePlannedReviews],
    )
    const baselineReviews = plan.baselinePlannedReviews
    const adaptiveTasks = useMemo(() => plan.adaptiveTasks.map((item) => item.task), [plan.adaptiveTasks])
    const upcomingGoals = useMemo(() => plan.goalMarkers.slice(0, 4), [plan.goalMarkers])

    const sections: TopicSections = useMemo(() => {
        // Only include concepts with real student attempts in performance-derived sections.
        const all = performanceMasteryList
        const today = new Date().toISOString().split('T')[0]

        const dueToday = all.filter((m) => m.due_date <= today)
            .sort((a, b) => b.priority_score - a.priority_score)

        const dueTodayIds = new Set(dueToday.map((m) => m.id))

        const needsReview = all.filter(
            (m) => m.display_mastery_level === 'needs_review' && !dueTodayIds.has(m.id),
        ).sort((a, b) => a.display_mastery_score - b.display_mastery_score)

        const developing = all.filter(
            (m) => m.display_mastery_level === 'developing' && !dueTodayIds.has(m.id),
        ).sort((a, b) => a.display_mastery_score - b.display_mastery_score)

        const mastered = all.filter(
            (m) => m.display_mastery_level === 'mastered' && !dueTodayIds.has(m.id),
        ).sort((a, b) => b.display_mastery_score - a.display_mastery_score)

        return { dueToday, needsReview, developing, mastered }
    }, [performanceMasteryList])

    // Gather reviewable concepts (due + needs_review) grouped by document
    const handleStartReview = useCallback(() => {
        const reviewable = [...sections.dueToday, ...sections.needsReview]
        if (reviewable.length === 0) {
            toast.info('No concepts need review right now!')
            return
        }

        // Group by document and pick the document with the most reviewable concepts
        const docGroups = new Map<string, string[]>()
        for (const c of reviewable) {
            if (!c.document_id) continue
            const ids = docGroups.get(c.document_id) || []
            ids.push(c.concept_id)
            docGroups.set(c.document_id, ids)
        }

        // Pick the document with most reviewable concepts
        let bestDocId = ''
        let bestConceptIds: string[] = []
        for (const [docId, cIds] of docGroups) {
            if (cIds.length > bestConceptIds.length) {
                bestDocId = docId
                bestConceptIds = cIds
            }
        }

        if (!bestDocId) {
            toast.info('No document-linked concepts to review')
            return
        }

        toast.loading('Generating review quiz...')
        generateReview.mutate(
            { documentId: bestDocId, focusConceptIds: bestConceptIds, questionCount: 10 },
            {
                onSuccess: (data) => {
                    toast.dismiss()
                    toast.success('Review quiz ready!')
                    navigate(`/quizzes/${data.quizId}`)
                },
                onError: (err) => {
                    toast.dismiss()
                    toast.error('Failed to generate review quiz: ' + (err as Error).message)
                },
            }
        )
    }, [sections, generateReview, navigate])

    const handleAdaptiveTaskAction = useCallback((task: AdaptiveStudyTask) => {
        if (task.type === 'quiz') {
            if (task.status === 'ready' && task.quizId) {
                navigate(`/quizzes/${task.quizId}`)
                return
            }
            if (task.status === 'generating' && task.quizId) {
                navigate('/quizzes', { state: { highlightQuizId: task.quizId } })
                return
            }
            if (task.status === 'generating' && !task.quizId) {
                toast.info('Your adaptive quiz is still being prepared. Check the Quizzes page in a moment.')
                navigate('/quizzes')
                return
            }

            toast.loading('Generating adaptive quiz...')
            generateReview.mutate(
                {
                    documentId: task.documentId,
                    focusConceptIds: task.conceptIds,
                    questionCount: Math.max(5, Math.min(12, task.conceptIds.length * 2)),
                },
                {
                    onSuccess: (data) => {
                        toast.dismiss()
                        toast.success('Adaptive review quiz ready')
                        navigate(`/quizzes/${data.quizId}`)
                    },
                    onError: (err) => {
                        toast.dismiss()
                        autoGeneratedTaskIds.current.delete(task.id)
                        toast.error('Failed to generate adaptive quiz: ' + (err as Error).message)
                    },
                },
            )
            return
        }

        if (task.type === 'flashcards') {
            navigate(`/files/${task.documentId}?tab=flashcards`)
            return
        }

        navigate(`/files/${task.documentId}?tab=concepts`)
    }, [generateReview, navigate])

    useEffect(() => {
        const nextQuizTask = adaptiveTasks.find((task) =>
            task.type === 'quiz' && task.status === 'needs_generation',
        )

        if (!nextQuizTask) return
        if (generateReview.isPending) return
        if (autoGeneratedTaskIds.current.has(nextQuizTask.id)) return

        autoGeneratedTaskIds.current.add(nextQuizTask.id)
        generateReview.mutate(
            {
                documentId: nextQuizTask.documentId,
                focusConceptIds: nextQuizTask.conceptIds,
                questionCount: Math.max(5, Math.min(12, nextQuizTask.conceptIds.length * 2)),
            },
            {
                onSuccess: () => {
                    toast.success('A new adaptive review quiz has been generated for your study plan.')
                },
                onError: (err) => {
                    autoGeneratedTaskIds.current.delete(nextQuizTask.id)
                    toast.error('Adaptive quiz generation failed: ' + (err as Error).message)
                },
            },
        )
    }, [adaptiveTasks, generateReview])

    const isLoading = plan.isLoading || statsLoading

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Learning Path</h1>
                            <p className="text-sm sm:text-base text-muted-foreground">Your generated study plan, adaptive tasks, and live mastery priorities</p>
                        </div>
                    </div>
                    {!isLoading && performanceMasteryList.length > 0 && (
                        <Button
                            onClick={handleStartReview}
                            disabled={generateReview.isPending || (sections.dueToday.length + sections.needsReview.length) === 0}
                            className="gap-2 w-full sm:w-auto"
                        >
                            {generateReview.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            Start Review
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (plan.isError || statsError) ? (
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
                ) : plan.items.length === 0 ? (
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
                        {/* Weekly Progress Summary */}
                        {weeklyProgress && weeklyProgress.questionsAnswered > 0 && (
                            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <TrendingUp className="w-5 h-5 text-primary" />
                                        This Week's Progress
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col sm:flex-row flex-wrap sm:items-center gap-4 sm:gap-6 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                                            <span><strong>{weeklyProgress.conceptsImproved}</strong> concepts improved</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span><strong>{weeklyProgress.newConceptsTracked}</strong> new concepts tracked</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-purple-500 shrink-0" />
                                            <span><strong>{weeklyProgress.questionsAnswered}</strong> questions answered</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4 text-green-500 shrink-0" />
                                            <span><strong>{weeklyProgress.quizzesCompleted}</strong> quizzes completed</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {adaptiveTasks.length > 0 && (
                            <div className="space-y-3">
                                <div>
                                    <h2 className="text-lg font-semibold">Adaptive Study Queue</h2>
                                    <p className="text-sm text-muted-foreground">
                                        EduCoach is turning your weak and developing concepts into the next set of study tasks.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {adaptiveTasks.map((task) => (
                                        <AdaptiveTaskCard
                                            key={task.id}
                                            task={task}
                                            onAction={handleAdaptiveTaskAction}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {(baselineReviews.length > 0 || upcomingGoals.length > 0) && (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Generated Plan</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Baseline scheduled work appears here before quiz history exists, and stays visible alongside your goal dates.
                                    </p>
                                </div>

                                {baselineReviews.length > 0 && (
                                    <div className="space-y-3">
                                        {baselineReviews.map((item) => (
                                            <GeneratedPlanCard key={item.id} item={item} />
                                        ))}
                                    </div>
                                )}

                                {upcomingGoals.length > 0 && (
                                    <div className="space-y-3">
                                        {upcomingGoals.map((marker) => (
                                            <GoalMarkerCard key={marker.id} marker={marker} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

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
                            onSelect={setSelectedConcept}
                        />

                        <SectionBlock
                            title="Needs Review"
                            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
                            items={sections.needsReview}
                            emptyMessage="No weak topics"
                            onSelect={setSelectedConcept}
                        />

                        <SectionBlock
                            title="Developing"
                            icon={<BookOpen className="w-5 h-5 text-yellow-500" />}
                            items={sections.developing}
                            emptyMessage="No developing topics"
                            onSelect={setSelectedConcept}
                        />

                        <SectionBlock
                            title="Mastered"
                            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                            items={sections.mastered}
                            emptyMessage="No mastered topics yet"
                            onSelect={setSelectedConcept}
                        />

                        {/* Concept Detail Dialog */}
                        <ConceptDetailDialog
                            concept={selectedConcept}
                            open={selectedConcept !== null}
                            onClose={() => setSelectedConcept(null)}
                        />
                    </>
                )}
            </div>
        </main>
    )
}
