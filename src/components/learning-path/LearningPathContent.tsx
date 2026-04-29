import { useState, useMemo, useCallback, type ReactNode } from "react"
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
    BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import { useWeeklyProgress } from "@/hooks/useLearningProgress"
import { useGenerateReviewQuiz, useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useDocuments } from "@/hooks/useDocuments"
import type { AdaptiveStudyTask } from "@/hooks/useAdaptiveStudy"
import { useLearningPathPlan } from "@/hooks/useLearningPathPlan"
import type {
    GoalMarkerPlanItem,
    PlannedReviewPlanItem,
} from "@/lib/learningPathPlan"
import { matchesQuizScope, type LearningPathPlanScopeFilter } from "@/lib/learningPathScope"
import { Link, useNavigate } from "react-router-dom"
import { toast } from 'sonner'

function masteryBadge(level: string) {
    switch (level) {
        case 'mastered':
            return <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 text-xs shadow-sm">Mastered</Badge>
        case 'developing':
            return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-xs shadow-sm">Developing</Badge>
        default:
            return <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 text-xs shadow-sm">Needs Review</Badge>
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
    completedToday: ConceptMasteryWithDetails[]
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
    scheduledTime,
    onAction,
}: {
    task: AdaptiveStudyTask
    scheduledTime?: string | null
    onAction: (task: AdaptiveStudyTask) => void
}) {
    const isUrgent = task.reason === 'due_today' || task.reason === 'needs_review'

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isUrgent ? 'bg-red-50' : 'bg-primary/10'}`}>
                        {adaptiveTaskIcon(task)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-base tracking-tight">{task.title}</p>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                {task.type === 'quiz' ? `${task.count} questions` : task.type === 'flashcards' ? `${task.count} cards` : `${task.count} concepts`}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                {task.reason === 'due_today' ? 'Due now' : task.reason === 'needs_review' ? 'Weak area' : 'Build mastery'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1.5">{task.description}</p>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex-wrap">
                            <span>{task.documentTitle}</span>
                            <span className="opacity-50">•</span>
                            <span>{task.scheduledDate}</span>
                            {scheduledTime ? (
                                <>
                                    <span className="opacity-50">•</span>
                                    <span className="tabular-nums">{scheduledTime}</span>
                                </>
                            ) : null}
                            <span className="opacity-50">•</span>
                            <span className={task.priorityScore > 0.8 ? 'text-orange-500' : ''}>{Math.round(task.priorityScore * 100)}% PRIORITY</span>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={() => onAction(task)}
                    variant={task.type === 'quiz' ? 'default' : 'outline'}
                    className={`w-full sm:w-auto shadow-sm ${task.type !== 'quiz' && 'bg-white hover:bg-gray-50'}`}
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
        <Card className="border-dashed border-primary/30 bg-primary/5 hover:bg-primary/[0.07] transition-colors">
            <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-base">{item.conceptName}</p>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-white">
                            Planned
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Scheduled for {dueLabel(item.date).toLowerCase()} from your current goal window.
                        {goalDate ? ` Goal date: ${goalDate}.` : ""}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 flex-wrap font-medium">
                        {item.documentTitle ? <span>{item.documentTitle}</span> : null}
                        {item.documentTitle ? <span className="opacity-50">•</span> : null}
                        {item.scheduledTime ? (
                            <>
                                <span className="tabular-nums">{item.scheduledTime}</span>
                                <span className="opacity-50">•</span>
                            </>
                        ) : null}
                        <span>{Math.round(item.priorityScore * 100)}% priority</span>
                    </div>
                </div>
                {item.documentId ? (
                    <div className="flex flex-col gap-2 shrink-0">
                        <Link to={`/files/${item.documentId}`}>
                            <Button variant="outline" size="sm" className="w-full bg-white text-xs h-8">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                Open
                            </Button>
                        </Link>
                        <Link to={`/analytics/document/${item.documentId}`}>
                            <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                                <BarChart3 className="w-3.5 h-3.5 mr-1" />
                                Analytics
                            </Button>
                        </Link>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

function GoalMarkerCard({ marker }: { marker: GoalMarkerPlanItem }) {
    return (
        <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-base tracking-tight">{marker.title}</p>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                            {marker.markerType === "file_goal" ? "File Goal" : "Quiz Deadline"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {marker.markerType === "file_goal"
                            ? `Target date for ${marker.documentTitle}.`
                            : `Assessment deadline tied to ${marker.documentTitle}.`}
                    </p>
                    <div className="text-xs font-semibold text-primary mt-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(marker.date + "T00:00:00").toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                </div>
                {marker.quizId ? (
                    <Link to={`/quizzes/${marker.quizId}`}>
                        <Button variant="outline" size="sm" className="shadow-sm">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                            Open
                        </Button>
                    </Link>
                ) : marker.documentId ? (
                    <div className="flex flex-col gap-2 shrink-0">
                        <Link to={`/files/${marker.documentId}`}>
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 shadow-sm">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                Open
                            </Button>
                        </Link>
                        <Link to={`/analytics/document/${marker.documentId}`}>
                            <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                                <BarChart3 className="w-3.5 h-3.5 mr-1" />
                                Analytics
                            </Button>
                        </Link>
                    </div>
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
            className="w-full flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-accent/10 hover:border-primary/20 transition-all text-left shadow-sm group">
            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm ${topic.display_mastery_level === 'mastered' ? 'bg-green-100 border border-green-200' :
                    topic.display_mastery_level === 'developing' ? 'bg-yellow-100 border border-yellow-200' : 'bg-red-100 border border-red-200'
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
                <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-semibold text-base truncate tracking-tight group-hover:text-primary transition-colors">{topic.concept_name}</p>
                    {masteryBadge(topic.display_mastery_level)}
                </div>
                <Progress value={topic.display_mastery_score} className="h-1.5 mb-2.5" />
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground flex-wrap">
                    <span className="font-bold text-foreground/80">{Math.round(topic.display_mastery_score)}% mastery</span>
                    <span className="opacity-50">•</span>
                    <span>Conf: {Math.round(topic.confidence * 100)}%</span>
                    <span className="opacity-50">•</span>
                    <span className={days <= 0 ? 'text-red-500 font-bold flex items-center' : 'flex items-center'}>
                        <Clock className="w-3 h-3 inline mr-1 opacity-80" />
                        {dueLabel(topic.due_date)}
                    </span>
                    {topic.document_title && (
                        <>
                            <span className="opacity-50">•</span>
                            <span className="truncate max-w-[150px]">{topic.document_title}</span>
                        </>
                    )}
                </div>
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
    return (
        <Card className="shadow-sm border-muted h-full flex flex-col">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/50 shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                    {icon}
                    {title}
                    <Badge variant="secondary" className="px-1.5 bg-background border shadow-sm ml-auto">{items.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
                {items.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-6">
                        <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
                    </div>
                ) : (
                    <div className="space-y-3 pr-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30">
                        {items.map((topic) => (
                            <TopicCard key={topic.id} topic={topic} onSelect={onSelect} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

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
                        <div className="p-3 rounded-xl bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{Math.round(concept.display_mastery_score)}%</p>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">Display Mastery</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{Math.round(concept.confidence * 100)}%</p>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">Confidence</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{concept.total_attempts}</p>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">Attempts</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">
                                {concept.total_attempts > 0
                                    ? Math.round((concept.correct_attempts / concept.total_attempts) * 100)
                                    : 0}%
                            </p>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">Accuracy</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-xl border border-border/50">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">SM-2 Due Date</span>
                            <span className={`font-medium ${days <= 0 ? 'text-red-500 font-bold' : ''}`}>
                                {dueLabel(concept.due_date)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">SM-2 Interval</span>
                            <span className="font-medium">{concept.interval_days} day{concept.interval_days !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Ease Factor</span>
                            <span className="font-medium">{Number(concept.ease_factor).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Stored Mastery</span>
                            <span className="font-medium">{Math.round(concept.mastery_score)}%</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Last Reviewed</span>
                            <span className="font-medium">{concept.last_reviewed_at ? new Date(concept.last_reviewed_at).toLocaleDateString() : 'Never'}</span>
                        </div>
                    </div>

                    {concept.display_mastery_score < concept.mastery_score && (
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs shadow-sm">
                            <HelpCircle className="w-5 h-5 shrink-0 text-amber-500" />
                            <span className="leading-relaxed font-medium">
                                Display mastery is lower than stored ({Math.round(concept.mastery_score)}%) because this concept is overdue for review. Take a quiz to restore it!
                            </span>
                        </div>
                    )}

                    {concept.document_id && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Link to={`/files/${concept.document_id}`} onClick={onClose} className="flex-1">
                                <Button className="w-full shadow-sm" variant="default">
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Review Material
                                </Button>
                            </Link>
                            <Link to={`/analytics/document/${concept.document_id}`} onClick={onClose} className="flex-1">
                                <Button className="w-full bg-white shadow-sm" variant="outline">
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Analytics
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface QuizItem {
    id: string;
    title: string;
    documentTitle: string | null;
    dueDate: string | null;
}

interface LearningPathContentProps {
    scopeFilter?: LearningPathPlanScopeFilter
    dueTodayQuizzes?: QuizItem[]
    completedTodayQuizzes?: QuizItem[]
}

export function LearningPathContent({
    scopeFilter,
    dueTodayQuizzes = [],
    completedTodayQuizzes = [],
}: LearningPathContentProps) {
    const plan = useLearningPathPlan(scopeFilter)
    const { data: weeklyProgress } = useWeeklyProgress()
    const { data: documents } = useDocuments()
    const { data: quizzes } = useQuizzes()
    const { data: attempts = [] } = useUserAttempts()
    const generateReview = useGenerateReviewQuiz()
    const navigate = useNavigate()

    const [selectedConcept, setSelectedConcept] = useState<ConceptMasteryWithDetails | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const scopedQuizzes = useMemo(
        () => (quizzes || []).filter((quiz) => matchesQuizScope(quiz, scopeFilter)),
        [quizzes, scopeFilter],
    )
    const completedQuizIds = useMemo(
        () => new Set(attempts.filter((a) => !!a.completed_at).map((a) => a.quiz_id)),
        [attempts],
    )
    const reusableReadyQuizIdByDocument = useMemo(() => {
        const map = new Map<string, string>()
        for (const quiz of scopedQuizzes) {
            if (quiz.status !== 'ready') continue
            if (completedQuizIds.has(quiz.id)) continue
            if (!map.has(quiz.document_id)) map.set(quiz.document_id, quiz.id)
        }
        return map
    }, [completedQuizIds, scopedQuizzes])

    const performanceMasteryList = useMemo(
        () => plan.performancePlannedReviews.map((item) => item.mastery as ConceptMasteryWithDetails),
        [plan.performancePlannedReviews],
    )
    const baselineReviews = plan.baselinePlannedReviews
    const adaptiveTasks = useMemo(
        () => plan.adaptiveTasks.map((item) => ({ task: item.task, scheduledTime: item.scheduledTime })),
        [plan.adaptiveTasks],
    )
    const upcomingGoals = useMemo(() => plan.goalMarkers.slice(0, 4), [plan.goalMarkers])
    const stats = useMemo(() => {
        const totalConcepts = performanceMasteryList.length
        const masteredCount = performanceMasteryList.filter((item) => item.display_mastery_level === "mastered").length
        const developingCount = performanceMasteryList.filter((item) => item.display_mastery_level === "developing").length
        const needsReviewCount = performanceMasteryList.filter((item) => item.display_mastery_level === "needs_review").length
        const averageMastery = totalConcepts > 0
            ? Math.round(
                performanceMasteryList.reduce((sum, item) => sum + item.display_mastery_score, 0) / totalConcepts,
            )
            : 0

        return {
            totalConcepts,
            masteredCount,
            developingCount,
            needsReviewCount,
            averageMastery,
        }
    }, [performanceMasteryList])

    const sections: TopicSections = useMemo(() => {
        const all = performanceMasteryList
        const today = new Date().toISOString().split('T')[0]

        const filtered = all.filter(m => 
            m.concept_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.document_title?.toLowerCase().includes(searchQuery.toLowerCase()))
        )

        const dueToday = filtered.filter((m) => m.due_date <= today)
            .sort((a, b) => b.priority_score - a.priority_score)

        const dueTodayIds = new Set(dueToday.map((m) => m.id))

        const completedToday = filtered.filter((m) => {
            if (!m.last_reviewed_at) return false
            const lastRev = m.last_reviewed_at.split('T')[0]
            return lastRev === today && m.due_date > today
        }).sort((a, b) => b.display_mastery_score - a.display_mastery_score)

        const completedTodayIds = new Set(completedToday.map((m) => m.id))

        const needsReview = filtered.filter(
            (m) => m.display_mastery_level === 'needs_review' && !dueTodayIds.has(m.id) && !completedTodayIds.has(m.id),
        ).sort((a, b) => a.display_mastery_score - b.display_mastery_score)

        const developing = filtered.filter(
            (m) => m.display_mastery_level === 'developing' && !dueTodayIds.has(m.id) && !completedTodayIds.has(m.id),
        ).sort((a, b) => a.display_mastery_score - b.display_mastery_score)

        const mastered = filtered.filter(
            (m) => m.display_mastery_level === 'mastered' && !dueTodayIds.has(m.id) && !completedTodayIds.has(m.id),
        ).sort((a, b) => b.display_mastery_score - a.display_mastery_score)

        return { dueToday, completedToday, needsReview, developing, mastered }
    }, [performanceMasteryList, searchQuery])

    const handleStartReview = useCallback(() => {
        const reviewable = [...sections.dueToday, ...sections.needsReview]
        if (reviewable.length === 0) {
            toast.info('No concepts need review right now!')
            return
        }

        const docGroups = new Map<string, string[]>()
        for (const c of reviewable) {
            if (!c.document_id) continue
            const ids = docGroups.get(c.document_id) || []
            ids.push(c.concept_id)
            docGroups.set(c.document_id, ids)
        }

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
            const fallbackQuizId = reusableReadyQuizIdByDocument.get(task.documentId)
            const effectiveQuizId = task.quizId ?? fallbackQuizId
            if (task.status === 'ready' && effectiveQuizId) {
                navigate(`/quizzes/${effectiveQuizId}`)
                return
            }
            if (task.status === 'generating' && effectiveQuizId) {
                navigate('/quizzes', { state: { highlightQuizId: effectiveQuizId } })
                return
            }
            if (effectiveQuizId) {
                navigate(`/quizzes/${effectiveQuizId}`)
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
    }, [generateReview, navigate, reusableReadyQuizIdByDocument])

    const isLoading = plan.isLoading
    
    // Milestones check
    const milestones: { label: string; achieved: boolean }[] = []
    const hasFirstQuiz = scopedQuizzes.length > 0 && plan.performancePlannedReviews.length > 0
    milestones.push({ label: "First quiz", achieved: hasFirstQuiz })
    const hasMastered = performanceMasteryList.some(m => m.display_mastery_level === 'mastered')
    milestones.push({ label: "First concept mastered", achieved: hasMastered })
    const achievedMilestones = milestones.filter(m => m.achieved)

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-8">


                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-muted-foreground font-medium">Analyzing mastery data...</p>
                    </div>
                ) : plan.isError ? (
                    <Card className="border-amber-200 bg-amber-50/30">
                        <CardContent className="text-center py-16">
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Could not load learning path</h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                Something went wrong fetching your adaptive plan. Please try refreshing.
                            </p>
                            <Button variant="outline" onClick={() => window.location.reload()} className="bg-white">
                                Refresh Page
                            </Button>
                        </CardContent>
                    </Card>
                ) : plan.items.length === 0 ? (
                    (() => {
                        const docs = documents || []
                        const scopedDocs = scopeFilter?.documentId ? docs.filter((doc) => doc.id === scopeFilter.documentId) : docs
                        const hasUploaded = scopedDocs.length > 0
                        const hasProcessed = scopedDocs.some(d => d.status === 'ready')
                        const hasAttempted = plan.performancePlannedReviews.length > 0
                        const hasTarget = scopedDocs.some(d => d.exam_date != null || d.deadline != null)
                        const steps = [
                            { label: "Upload study materials", done: hasUploaded, link: "/files" },
                            { label: "Process your documents", done: hasProcessed, link: "/files" },
                            { label: "Take your first quiz", done: hasAttempted, link: "/quizzes" },
                            { label: "Set a study target date", done: hasTarget, link: "/files" },
                        ]
                        const completedCount = steps.filter(s => s.done).length
                        return (
                            <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-md">
                                <CardContent className="py-12 px-8">
                                    <div className="text-center mb-8 max-w-md mx-auto">
                                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Brain className="w-10 h-10 text-primary" />
                                        </div>
                                        <h3 className="text-2xl font-bold mb-3 tracking-tight">Onboarding Checklist</h3>
                                        <p className="text-muted-foreground">
                                            Complete these steps to build your personalized study plan.
                                        </p>
                                    </div>
                                    <div className="mb-8 max-w-md mx-auto">
                                        <div className="flex items-center justify-between text-sm mb-2 font-bold uppercase tracking-wider text-muted-foreground">
                                            <span>{completedCount} of {steps.length} steps</span>
                                            <span>{Math.round((completedCount / steps.length) * 100)}%</span>
                                        </div>
                                        <Progress value={(completedCount / steps.length) * 100} className="h-3" />
                                    </div>
                                    <ul className="space-y-4 max-w-md mx-auto">
                                        {steps.map((step, i) => (
                                            <li key={i} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${step.done ? 'bg-primary/5 border-primary/20' : 'bg-card shadow-sm hover:border-primary/30'}`}>
                                                {step.done ? <CheckCircle2 className="w-6 h-6 text-primary shrink-0" /> : <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                                                <span className={step.done ? "text-base font-medium line-through text-muted-foreground/70" : "text-base font-semibold"}>
                                                    {step.label}
                                                </span>
                                                {!step.done && (
                                                    <Link to={step.link} className="ml-auto">
                                                        <Button size="sm" variant="default" className="shadow-sm">Go</Button>
                                                    </Link>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )
                    })()
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Readiness Estimate */}
                            {(() => {
                                const totalTracked = stats.totalConcepts
                                const attempted = plan.performancePlannedReviews.length
                                const performance = stats.averageMastery
                                const coverage = totalTracked > 0 ? attempted / totalTracked : 0
                                const coveragePct = Math.round(coverage * 100)

                                let label = "Not enough data"
                                let gradient = "from-gray-500 to-slate-600"
                                if (coverage >= 0.60 && performance >= 80) { label = "Strong"; gradient = "from-emerald-500 to-teal-600" }
                                else if (coverage >= 0.40 && performance >= 60) { label = "Moderate"; gradient = "from-blue-500 to-indigo-600" }
                                else if (coverage >= 0.25) { label = "Limited"; gradient = "from-amber-500 to-orange-600" }

                                return (
                                    <Card className={`text-white overflow-hidden border-0 relative bg-gradient-to-br ${gradient} shadow-md`}>
                                        <div className="absolute top-0 right-0 p-6 opacity-10">
                                            <Target className="w-32 h-32" />
                                        </div>
                                        <CardContent className="p-6 sm:p-8 relative z-10 flex flex-col h-full justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2 uppercase tracking-widest text-[11px] font-bold text-white/80">
                                                    <Brain className="w-4 h-4" /> 
                                                    Readiness Estimate
                                                </div>
                                                <div className="text-4xl sm:text-5xl font-black tracking-tight mb-8 drop-shadow-sm">{label}</div>
                                            </div>
                                            
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-6 bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                                                    <div>
                                                        <div className="flex justify-between items-end mb-2">
                                                            <p className="text-[11px] uppercase tracking-wider font-bold text-white/80">Coverage</p>
                                                            <span className="text-xl font-bold">{coveragePct}%</span>
                                                        </div>
                                                        <Progress value={coveragePct} className="h-2 bg-white/20 [&>div]:bg-white" />
                                                        <p className="text-[10px] text-white/60 mt-2 tracking-wide font-medium">{attempted} / {totalTracked} concepts</p>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-end mb-2">
                                                            <p className="text-[11px] uppercase tracking-wider font-bold text-white/80">Performance</p>
                                                            <span className="text-xl font-bold">{performance}%</span>
                                                        </div>
                                                        <Progress value={performance} className="h-2 bg-white/20 [&>div]:bg-white" />
                                                        <p className="text-[10px] text-white/60 mt-2 tracking-wide font-medium">Avg mastery score</p>
                                                    </div>
                                                </div>
                                                
                                                {/* Injected Milestones */}
                                                {achievedMilestones.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                                                        {achievedMilestones.map((m, i) => (
                                                            <Badge key={i} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-[10px] font-bold uppercase tracking-wider py-1 backdrop-blur-sm">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                {m.label}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })()}

                            {/* Weekly Pulse & Start Review */}
                            <div className="space-y-6 flex flex-col h-full">
                                {weeklyProgress && weeklyProgress.questionsAnswered > 0 ? (
                                    <Card className="bg-card shadow-sm border-muted flex-1 flex flex-col">
                                        <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <TrendingUp className="w-5 h-5 text-primary" />
                                                Weekly Pulse
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 flex-1 flex items-center">
                                            <div className="grid grid-cols-2 gap-4 w-full">
                                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center text-center">
                                                    <Zap className="w-5 h-5 text-amber-500 mb-2" />
                                                    <span className="text-2xl font-black text-amber-700">{weeklyProgress.conceptsImproved}</span>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mt-1">Concepts<br/>Improved</span>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 flex flex-col items-center justify-center text-center">
                                                    <Brain className="w-5 h-5 text-purple-500 mb-2" />
                                                    <span className="text-2xl font-black text-purple-700">{weeklyProgress.questionsAnswered}</span>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 mt-1">Questions<br/>Answered</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="bg-card shadow-sm flex-1 flex flex-col justify-center text-center p-6 border-dashed border-2">
                                        <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <h3 className="font-bold text-lg mb-1">No Activity Yet</h3>
                                        <p className="text-sm text-muted-foreground max-w-[250px] mx-auto mb-4">Complete study tasks this week to start tracking your pulse.</p>
                                    </Card>
                                )}

                                {/* Start Review CTA */}
                                {!isLoading && performanceMasteryList.length > 0 && (
                                    <Button
                                        onClick={handleStartReview}
                                        disabled={generateReview.isPending || (sections.dueToday.length + sections.needsReview.length) === 0}
                                        className="w-full h-14 text-base font-bold shadow-md rounded-xl"
                                        size="lg"
                                    >
                                        {generateReview.isPending ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            <Play className="w-5 h-5 align-middle mr-2 fill-current" />
                                        )}
                                        Start Smart Review {(sections.dueToday.length + sections.needsReview.length) > 0 ? `(${sections.dueToday.length + sections.needsReview.length} waiting)` : ""}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Due Today Quizzes Section - More compact and integrated */}
                        {((dueTodayQuizzes && dueTodayQuizzes.length > 0) || (completedTodayQuizzes && completedTodayQuizzes.length > 0)) && (
                            <Card className="border-red-200 bg-red-50/10 shadow-sm overflow-hidden mb-6">
                                <CardContent className="p-0">
                                    <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-white/20">
                                        {/* Due Today Section */}
                                        {dueTodayQuizzes.length > 0 && (
                                            <div className="flex flex-col sm:flex-row items-stretch flex-1">
                                                <div className="bg-red-500 text-white p-4 flex flex-col justify-center items-center sm:w-32 shrink-0">
                                                    <Target className="w-6 h-6 mb-1" />
                                                    <span className="text-xl font-black">{dueTodayQuizzes.length}</span>
                                                    <span className="text-[9px] uppercase font-bold tracking-tighter">Due Today</span>
                                                </div>
                                                <div className="p-4 flex-1 overflow-y-auto max-h-[200px] bg-red-50/30 scrollbar-thin">
                                                    <div className="flex flex-col gap-2">
                                                        {dueTodayQuizzes.map((quiz) => (
                                                            <Link
                                                                key={quiz.id}
                                                                to={`/quizzes/${quiz.id}`}
                                                                className="flex items-center justify-between rounded-lg border bg-background p-2 shadow-sm transition-all hover:border-red-400 hover:shadow-md group min-w-[180px] sm:min-w-0"
                                                            >
                                                                <div className="min-w-0 pr-2">
                                                                    <p className="truncate font-bold text-[11px] tracking-tight group-hover:text-red-600 transition-colors">{quiz.title}</p>
                                                                    {quiz.documentTitle ? (
                                                                        <p className="truncate text-[8px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{quiz.documentTitle}</p>
                                                                    ) : null}
                                                                </div>
                                                                <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/60 group-hover:text-red-500" />
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Completed Today Section */}
                                        {completedTodayQuizzes.length > 0 && (
                                            <div className="flex flex-col sm:flex-row items-stretch flex-1">
                                                <div className="bg-green-500 text-white p-4 flex flex-col justify-center items-center sm:w-32 shrink-0">
                                                    <CheckCircle2 className="w-6 h-6 mb-1" />
                                                    <span className="text-xl font-black">{completedTodayQuizzes.length}</span>
                                                    <span className="text-[9px] uppercase font-bold tracking-tighter">Completed</span>
                                                </div>
                                                <div className="p-4 flex-1 overflow-y-auto max-h-[200px] bg-green-50/30 scrollbar-thin">
                                                    <div className="flex flex-col gap-2">
                                                        {completedTodayQuizzes.map((quiz) => (
                                                            <Link
                                                                key={quiz.id}
                                                                to={`/quizzes/${quiz.id}`}
                                                                className="flex items-center justify-between rounded-lg border bg-background p-2 shadow-sm transition-all hover:border-green-400 hover:shadow-md group min-w-[180px] sm:min-w-0"
                                                            >
                                                                <div className="min-w-0 pr-2">
                                                                    <p className="truncate font-bold text-[11px] tracking-tight group-hover:text-green-600 transition-colors">{quiz.title}</p>
                                                                    {quiz.documentTitle ? (
                                                                        <p className="truncate text-[8px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{quiz.documentTitle}</p>
                                                                    ) : null}
                                                                </div>
                                                                <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                            {adaptiveTasks.length > 0 && (
                                <Card className="flex flex-col max-h-[500px] border-primary/20 shadow-sm bg-gradient-to-b from-background to-primary/5">
                                    <CardHeader className="pb-3 border-b border-border/50 bg-background/50 rounded-t-xl shrink-0">
                                        <CardTitle className="flex items-center justify-between text-lg">
                                            <div className="flex items-center gap-2">
                                                <Brain className="w-5 h-5 text-primary" />
                                                Adaptive Study Queue
                                            </div>
                                            <Badge variant="secondary" className="px-1.5">{adaptiveTasks.length}</Badge>
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            EduCoach is turning your weak and developing concepts into the next set of targeted tasks.
                                        </p>
                                    </CardHeader>
                                    <CardContent className="p-4 overflow-y-auto flex-1">
                                        <div className="space-y-3">
                                            {adaptiveTasks.map(({ task, scheduledTime }) => (
                                                <AdaptiveTaskCard
                                                    key={task.id}
                                                    task={task}
                                                    scheduledTime={scheduledTime}
                                                    onAction={handleAdaptiveTaskAction}
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {(baselineReviews.length > 0 || upcomingGoals.length > 0) && (
                                <Card className="flex flex-col max-h-[500px] border-primary/10 shadow-sm">
                                    <CardHeader className="pb-3 border-b border-border/50 bg-muted/10 rounded-t-xl shrink-0">
                                        <CardTitle className="flex items-center justify-between text-lg">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-muted-foreground" />
                                                Generated Plan Items
                                            </div>
                                            <Badge variant="secondary" className="px-1.5">{baselineReviews.length + upcomingGoals.length}</Badge>
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Baseline scheduled work and your established learning goal dates.
                                        </p>
                                    </CardHeader>
                                    <CardContent className="p-4 overflow-y-auto flex-1">
                                        {baselineReviews.length > 0 && (
                                            <div className="space-y-3 mb-6">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Scheduled Reviews</h3>
                                                {baselineReviews.map((item) => (
                                                    <GeneratedPlanCard key={item.id} item={item} />
                                                ))}
                                            </div>
                                        )}

                                        {upcomingGoals.length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Milestones & Goals</h3>
                                                {upcomingGoals.map((marker) => (
                                                    <GoalMarkerCard key={marker.id} marker={marker} />
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Mastery explanation */}
                        <div className="flex items-start gap-3 text-sm font-medium text-muted-foreground bg-muted/40 border border-border/50 rounded-xl p-5">
                            <HelpCircle className="w-5 h-5 shrink-0 text-primary/60" />
                            <span className="leading-relaxed">
                                Mastery scores are dynamically updated based on your recent quiz and flashcard performance, factoring in difficulty and time decay. Topics below are ordered by their prioritized study necessity.
                            </span>
                        </div>

                        {/* Prioritized Sections */}
                        <div className="pt-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <Layers className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">Active Topics & Mastery</h2>
                                </div>
                                <div className="relative w-full md:w-64 lg:w-80">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search concepts or files..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-muted bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <SectionBlock
                                    title="Due Today"
                                    icon={<Target className="w-6 h-6 text-red-500" />}
                                    items={sections.dueToday}
                                    emptyMessage="Nothing due today — you're caught up!"
                                    onSelect={setSelectedConcept}
                                />

                                <SectionBlock
                                    title="Completed Today"
                                    icon={<CheckCircle2 className="w-6 h-6 text-green-500" />}
                                    items={sections.completedToday}
                                    emptyMessage="No tasks completed today yet."
                                    onSelect={setSelectedConcept}
                                />

                                <SectionBlock
                                    title="Needs Review"
                                    icon={<AlertTriangle className="w-6 h-6 text-orange-500" />}
                                    items={sections.needsReview}
                                    emptyMessage="No weak topics identified yet."
                                    onSelect={setSelectedConcept}
                                />

                                <SectionBlock
                                    title="Developing"
                                    icon={<BookOpen className="w-6 h-6 text-yellow-500" />}
                                    items={sections.developing}
                                    emptyMessage="No developing topics currently tracking."
                                    onSelect={setSelectedConcept}
                                />

                                <SectionBlock
                                    title="Mastered"
                                    icon={<CheckCircle2 className="w-6 h-6 text-green-500" />}
                                    items={sections.mastered}
                                    emptyMessage="You haven't mastered any topics yet. Keep going!"
                                    onSelect={setSelectedConcept}
                                />
                            </div>
                        </div>

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
