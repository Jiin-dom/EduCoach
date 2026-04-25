import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Clock, BookOpen, Brain, Calendar, TrendingUp, Sparkles } from "lucide-react"
import { useDueTopics, useConceptMasteryList } from "@/hooks/useLearning"
import { useAdaptiveStudyTasks, type AdaptiveStudyTask } from "@/hooks/useAdaptiveStudy"
import { todayUTC } from "@/lib/learningAlgorithms"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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

interface TodaysStudyPlanProps {
    className?: string
}

type PlanItem =
    | { kind: "topic"; id: string; priority: number; topic: NonNullable<ReturnType<typeof useDueTopics>["data"]>[number] }
    | { kind: "task"; id: string; priority: number; task: AdaptiveStudyTask }

function taskTypeBadge(type: AdaptiveStudyTask["type"]) {
    if (type === "quiz") {
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">Quiz</Badge>
    }
    if (type === "flashcards") {
        return <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-xs">Flashcards</Badge>
    }
    return <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">Review Task</Badge>
}

function taskTypeIcon(type: AdaptiveStudyTask["type"]) {
    if (type === "quiz") return Brain
    if (type === "flashcards") return Sparkles
    return BookOpen
}

export function TodaysStudyPlan({ className }: TodaysStudyPlanProps) {
    const { data: dueTopics, isLoading } = useDueTopics()
    const { data: allMastery } = useConceptMasteryList()
    const { data: adaptiveTasks, isLoading: isAdaptiveLoading } = useAdaptiveStudyTasks()
    const today = todayUTC()

    const dueAdaptiveTasks = useMemo(
        () => (adaptiveTasks || []).filter((task) => task.scheduledDate <= today),
        [adaptiveTasks, today],
    )

    const allDueItems = useMemo(() => {
        const topicItems: PlanItem[] = (dueTopics || []).map((topic) => ({
            kind: "topic",
            id: `topic-${topic.id}`,
            priority: Number(topic.priority_score ?? 0),
            topic,
        }))
        const taskItems: PlanItem[] = dueAdaptiveTasks.map((task) => ({
            kind: "task",
            id: `task-${task.id}`,
            priority: task.priorityScore,
            task,
        }))

        return [...topicItems, ...taskItems].sort((a, b) => b.priority - a.priority)
    }, [dueAdaptiveTasks, dueTopics])

    const topItems = allDueItems.slice(0, 5)

    const completionPercent = useMemo(() => {
        const all = (allMastery || []).filter((m) => m.total_attempts > 0)
        if (all.length === 0) return 0
        const totalDue = all.filter((m) => m.due_date <= today).length
        if (totalDue === 0) return 100
        const reviewedToday = all.filter(
            (m) => m.due_date <= today && m.last_reviewed_at &&
                   m.last_reviewed_at.split('T')[0] === today
        ).length
        return Math.round((reviewedToday / totalDue) * 100)
    }, [allMastery])

    return (
        <Card variant="dashboard" className={cn("h-full min-h-0 flex flex-col", className)}>
            <CardHeader density="compact">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-5 h-5 text-primary shrink-0" />
                        <CardTitle className="truncate">Today's Study Plan</CardTitle>
                    </div>
                    {topItems.length > 0 && (
                        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0 bg-muted/50 px-2 py-0.5 rounded-full">
                            {topItems.length} task{topItems.length !== 1 ? 's' : ''} due
                        </span>
                    )}
                </div>
                {topItems.length > 0 && (
                    <div className="mt-3">
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Daily Progress</span>
                            <span className="text-[10px] font-bold text-primary">{completionPercent}%</span>
                        </div>
                        <Progress value={completionPercent} className="h-1.5 bg-primary/10" />
                    </div>
                )}
            </CardHeader>
            <CardContent density="compact" className="space-y-3 flex-1 overflow-y-auto pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {isLoading || isAdaptiveLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-3.5 w-2/3" />
                                    <Skeleton className="h-2.5 w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : topItems.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10">
                            <Brain className="w-8 h-8 text-primary/60" />
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">Clear for today!</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            No topics due today. Ready for something new?
                        </p>
                        <Link to="/quizzes">
                            <Button size="sm" className="w-full bg-primary/10 text-primary hover:bg-primary/20 border-0 shadow-none">
                                Take a Quiz
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topItems.map((item) => {
                            if (item.kind === "topic") {
                                const topic = item.topic
                                return (
                                    <div
                                        key={item.id}
                                        className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                            <BookOpen className="w-4.5 h-4.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="truncate text-sm font-semibold text-foreground/90">{topic.concept_name}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                {masteryBadge(topic.display_mastery_level)}
                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        <Clock className="w-3 h-3 opacity-70" />
                                                        {Math.round(topic.display_mastery_score)}%
                                                    </span>
                                                    {topic.document_title && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                            <span className="truncate max-w-[100px]">{topic.document_title}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {topic.document_id && (
                                            <Link to={`/files/${topic.document_id}`} className="shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                                    title="Review"
                                                >
                                                    <TrendingUp className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                )
                            }

                            const task = item.task
                            const TaskIcon = taskTypeIcon(task.type)
                            const destination = task.type === "quiz" && task.quizId
                                ? `/quizzes/${task.quizId}`
                                : `/files/${task.documentId}`

                            return (
                                <div
                                    key={item.id}
                                    className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                        <TaskIcon className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="truncate text-sm font-semibold text-foreground/90">{task.title}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            {taskTypeBadge(task.type)}
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <span>{task.description}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link to={destination} className="shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                            title="Open"
                                        >
                                            <TrendingUp className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
            {topItems.length > 0 && (
                <CardFooter density="compact" className="flex flex-col gap-2 pt-0 shrink-0">
                    {allDueItems.length > 5 && (
                        <Link to="/learning-path" className="w-full">
                            <Button variant="ghost" size="sm" className="w-full text-[11px] text-muted-foreground hover:text-primary h-7">
                                View {allDueItems.length - 5} more tasks
                            </Button>
                        </Link>
                    )}
                    <Link to="/learning-path" className="w-full">
                        <Button variant="outline" size="sm" className="w-full h-10 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5">
                            Open Study Planner
                        </Button>
                    </Link>
                </CardFooter>
            )}
        </Card>
    )
}
