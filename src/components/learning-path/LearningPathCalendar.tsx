import { useState } from "react"
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarDays,
    Clock,
    CheckCircle2,
    BookOpen,
    Filter,
    Target,
    Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
    useLearningStats,
    useRescheduleConceptDueDate,
    useStudyEfficiency,
} from "@/hooks/useLearning"
import { useWeeklyProgress } from "@/hooks/useLearningProgress"
import { useNavigate } from "react-router-dom"
import { useLearningPathPlan } from "@/hooks/useLearningPathPlan"
import { useRescheduleAdaptiveStudyTask } from "@/hooks/useAdaptiveStudy"
import { getLearningPathItemsForDate, type LearningPathPlanItem, type PlannedReviewPlanItem } from "@/lib/learningPathPlan"
import { useReplanLearningPath } from "@/hooks/useGoalWindowScheduling"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

// Helper function to get days in a month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateToLocalString(d: Date) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}

function formatStudyWindow(start: string | null | undefined, end: string | null | undefined) {
    if (!start || !end) return "Not set"
    return `${start} - ${end}`
}

export function LearningPathCalendar() {
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState<"week" | "month">("week")
    const [anchorDate, setAnchorDate] = useState(() => new Date())

    // Filter toggles
    const [showMastered, setShowMastered] = useState(true)
    const [showDeveloping, setShowDeveloping] = useState(true)
    const [showNeedsReview, setShowNeedsReview] = useState(true)

    const { data: stats } = useLearningStats();
    const { data: weeklyProgress } = useWeeklyProgress();
    const { data: efficiency } = useStudyEfficiency();
    const plan = useLearningPathPlan()
    const rescheduleDueDate = useRescheduleConceptDueDate()
    const rescheduleAdaptiveTask = useRescheduleAdaptiveStudyTask()
    const replanLearningPath = useReplanLearningPath()
    const { profile } = useAuth()

    // Compute Dates
    const now = anchorDate
    // Week calculations
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 for Monday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const monthDaysCount = getDaysInMonth(now.getFullYear(), now.getMonth());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    // Monday is 1, Sunday is 0. If we grid starts at Sunday, week array: Sun=0 to Sat=6.
    // The image grid is Sun, Mon, Tue, Wed, Thu, Fri, Sat.
    const emptyCellsBefore = firstDayOfMonth; // If Sun, it's 0. If Mon, it's 1.

    // Session logic
    const getSessionsForDate = (dateStr: string) => {
        return plan.items
            .filter((item): item is PlannedReviewPlanItem => item.kind === "planned_review" && item.date === dateStr)
            .filter(({ mastery }) => {
                if (mastery.display_mastery_level === 'mastered') return showMastered;
                if (mastery.display_mastery_level === 'developing') return showDeveloping;
                if (mastery.display_mastery_level === 'needs_review') return showNeedsReview;
                return true;
            })
    }

    const isMovingItem = rescheduleDueDate.isPending || rescheduleAdaptiveTask.isPending

    const dragPayload = (payload: Record<string, string>) => JSON.stringify(payload)

    const renderFixedBadge = () => (
        <span className="ml-auto shrink-0 rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">
            Fixed
        </span>
    )

    // Helper to render pills based on session type
    const renderSessionBadge = (session: PlannedReviewPlanItem) => {
        let colors = ""
        switch (session.mastery.display_mastery_level) {
            case "mastered": colors = "bg-green-100 text-green-700 border-green-200"; break;
            case "developing": colors = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
            case "needs_review": colors = "bg-red-100 text-red-700 border-red-200"; break;
            default: colors = "bg-gray-100 text-gray-700 border-gray-200"; break;
        }

        if (session.source === "baseline") {
            colors = "bg-primary/10 text-primary border-primary/20"
        }

        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "planned_review",
                        conceptId: session.conceptId,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`p-2 rounded-md border text-xs mb-2 ${colors} cursor-grab active:cursor-grabbing`}
                title={session.source === "baseline" ? "Drag to reschedule baseline plan" : "Drag to reschedule review deadline"}
            >
                <div className="flex items-center gap-1 font-medium mb-1 truncate">
                    {session.mastery.display_mastery_level === 'mastered' && <CheckCircle2 className="w-3 h-3" />}
                    {session.mastery.display_mastery_level === 'developing' && <Clock className="w-3 h-3" />}
                    {session.mastery.display_mastery_level === 'needs_review' && <BookOpen className="w-3 h-3" />}
                    {session.source === "baseline" ? `Planned: ${session.conceptName}` : session.conceptName}
                </div>
            </div>
        )
    }

    const renderMonthSessionBadge = (session: PlannedReviewPlanItem) => {
        let colors = ""
        switch (session.mastery.display_mastery_level) {
            case "mastered": colors = "bg-green-100 text-green-700 border-green-200"; break;
            case "developing": colors = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
            case "needs_review": colors = "bg-red-100 text-red-700 border-red-200"; break;
            default: colors = "bg-gray-100 text-gray-700 border-gray-200"; break;
        }
        if (session.source === "baseline") {
            colors = "bg-primary/10 text-primary border-primary/20"
        }
        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "planned_review",
                        conceptId: session.conceptId,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`mt-1 text-[10px] p-1 rounded truncate border flex items-center gap-1 ${colors} cursor-grab active:cursor-grabbing`}
                title={session.source === "baseline" ? "Drag to reschedule baseline plan" : "Drag to reschedule review deadline"}
            >
                {session.mastery.display_mastery_level === 'mastered' && <CheckCircle2 className="w-2.5 h-2.5 hidden sm:block" />}
                {session.mastery.display_mastery_level === 'developing' && <Clock className="w-2.5 h-2.5 hidden sm:block" />}
                {session.mastery.display_mastery_level === 'needs_review' && <BookOpen className="w-2.5 h-2.5 hidden sm:block" />}
                <span>{session.source === "baseline" ? `Planned: ${session.conceptName}` : session.conceptName}</span>
            </div>
        )
    }

    const renderCalendarItem = (item: LearningPathPlanItem, compact = false) => {
        if (item.kind === "planned_review") {
            return compact ? renderMonthSessionBadge(item) : renderSessionBadge(item)
        }

        if (item.kind === "goal_marker") {
            const colors = item.markerType === "quiz_deadline"
                ? "bg-purple-100 text-purple-800 border-purple-200"
                : "bg-blue-100 text-blue-800 border-blue-200"
            const icon = item.markerType === "quiz_deadline" ? <Target className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />
            const label = item.markerType === "quiz_deadline" ? "Quiz" : "Study"

            if (compact) {
                return item.quizId ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/quizzes/${item.quizId}`)}
                        className={`w-full mt-1 text-[10px] font-bold p-1 rounded truncate border flex items-center gap-1 ${colors} hover:opacity-90 transition-opacity`}
                        title={`${item.title} (fixed milestone)`}
                    >
                        {icon}
                        <span className="truncate">{item.title}</span>
                        {renderFixedBadge()}
                    </button>
                ) : (
                    <div className={`mt-1 text-[10px] font-bold p-1 rounded truncate border flex items-center gap-1 ${colors}`} title={`${item.title} (fixed milestone)`}>
                        {icon}
                        <span className="truncate">{item.title}</span>
                        {renderFixedBadge()}
                    </div>
                )
            }

            return item.quizId ? (
                <button
                    type="button"
                    onClick={() => navigate(`/quizzes/${item.quizId}`)}
                    className={`w-full text-left p-2 rounded-md border text-xs mb-2 ${colors} hover:opacity-90 transition-opacity cursor-pointer`}
                    title={`${label} goal (fixed milestone)`}
                >
                    <div className="flex items-center gap-1 font-bold mb-1 truncate">
                        {icon}
                        <span className="truncate">{label}: {item.title}</span>
                        {renderFixedBadge()}
                    </div>
                </button>
            ) : (
                <div className={`p-2 rounded-md border text-xs mb-2 ${colors}`} title={`${label} goal (fixed milestone)`}>
                    <div className="flex items-center gap-1 font-bold mb-1 truncate">
                        {icon}
                        <span className="truncate">{label}: {item.title}</span>
                        {renderFixedBadge()}
                    </div>
                </div>
            )
        }

        const task = item.task
        const colors = task.type === 'quiz'
            ? 'bg-primary/10 text-primary border-primary/20'
            : task.type === 'flashcards'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'

        const label = task.type === 'quiz'
            ? 'Quiz'
            : task.type === 'flashcards'
                ? 'Cards'
                : 'Review'

        const openTask = () => {
            if (task.type === 'quiz') {
                if (task.quizId) {
                    navigate(task.status === 'ready' ? `/quizzes/${task.quizId}` : '/quizzes', {
                        state: task.quizId ? { highlightQuizId: task.quizId } : undefined,
                    })
                } else {
                    if (task.status === 'generating') {
                        toast.info('Your adaptive quiz is still being prepared. Check the Quizzes page in a moment.')
                        navigate('/quizzes')
                    } else {
                        toast.info('This adaptive quiz is not ready yet. It should auto-generate after upload.')
                        navigate('/quizzes')
                    }
                }
                return
            }

            if (task.type === 'flashcards') {
                navigate(`/files/${task.documentId}?tab=flashcards`)
                return
            }

            navigate(`/files/${task.documentId}?tab=concepts`)
        }

        return (
            <button
                type="button"
                onClick={openTask}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "adaptive_task",
                        taskId: task.id,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`${compact ? 'mt-1 text-[10px] p-1' : 'p-2 text-xs mb-2'} w-full rounded-md border ${colors} text-left hover:opacity-90 transition-opacity cursor-grab active:cursor-grabbing`}
                title={`${task.title}. Drag to move or click to open.`}
            >
                <div className="font-bold truncate">
                    {label}: {task.documentTitle}
                </div>
            </button>
        )
    }

    const handleRescheduleDrop = (rawPayload: string, targetDateStr: string) => {
        if (!rawPayload || !targetDateStr) return

        let payload: { kind?: string; conceptId?: string; taskId?: string } | null = null
        try {
            payload = JSON.parse(rawPayload)
        } catch {
            payload = { kind: "planned_review", conceptId: rawPayload }
        }

        if (payload?.kind === "adaptive_task" && payload.taskId) {
            const source = plan.items.find((item) => item.kind === "adaptive_task" && item.task.id === payload?.taskId)
            if (!source || source.kind !== "adaptive_task") return
            if (source.task.scheduledDate === targetDateStr) return

            rescheduleAdaptiveTask.mutate(
                { taskId: source.task.id, newScheduledDate: targetDateStr },
                {
                    onSuccess: () => {
                        toast.success(`Moved ${source.task.type} to ${targetDateStr}.`)
                    },
                    onError: (error) => {
                        toast.error(error instanceof Error ? error.message : "Failed to move study task.")
                    },
                },
            )
            return
        }

        const conceptId = payload?.conceptId
        if (!conceptId) return
        const current = getSessionsForDate(targetDateStr)
        if (current.some((item) => item.conceptId === conceptId)) return
        const source = plan.items.find((item) => item.kind === "planned_review" && item.conceptId === conceptId)
        if (!source || source.kind !== "planned_review") return
        const currentMastery = source.mastery
        if (!currentMastery) return
        if (currentMastery.due_date === targetDateStr) return

        rescheduleDueDate.mutate(
            {
                conceptId,
                newDueDate: targetDateStr,
                masteryScore: Number(currentMastery.mastery_score),
                confidence: Number(currentMastery.confidence),
            },
            {
                onSuccess: () => {
                    toast.success(`Moved ${source.source === "baseline" ? "planned review" : "review"} to ${targetDateStr}.`)
                },
                onError: (error) => {
                    toast.error(error instanceof Error ? error.message : "Failed to move review.")
                },
            },
        )
    }

    const handleAutomaticReplan = async () => {
        try {
            const availableStudyDays = profile?.available_study_days ?? []
            const dailyStudyMinutes = profile?.daily_study_minutes ?? 30
            const result = await replanLearningPath.mutateAsync({ availableStudyDays, dailyStudyMinutes })

            if (result.total === 0) {
                toast.info("No goal-dated documents found to replan.")
                return
            }

            if (result.failed > 0) {
                toast.warning(`Replanned ${result.success}/${result.total} goal-based document schedules.`)
                return
            }

            toast.success(`Replanned ${result.total} goal-based document schedule${result.total !== 1 ? "s" : ""}.`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to replan your learning path.")
        }
    }

    // Identify upcoming exams for the sidebar widget
    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div>
                <h1 className="text-3xl font-bold mb-1">My Learning Path</h1>
                <p className="text-muted-foreground">View your adaptive study schedule based on your preferred time.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* Left Column: Calendar & Content */}
                <div className="flex-1 w-full space-y-6">

                    {/* Calendar Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            {/* Calendar Navigator */}
                            <div className="flex items-center justify-between mb-4">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => {
                                        setAnchorDate((prev) => {
                                            const d = new Date(prev)
                                            if (viewMode === 'week') {
                                                d.setDate(d.getDate() - 7)
                                            } else {
                                                const day = d.getDate()
                                                d.setMonth(d.getMonth() - 1)
                                                // If the previous month doesn't have this day, JS will roll over.
                                                // Clamp by re-setting date to min(lastDayOfMonth, originalDay).
                                                const last = getDaysInMonth(d.getFullYear(), d.getMonth())
                                                d.setDate(Math.min(day, last))
                                            }
                                            return d
                                        })
                                    }}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-center">
                                    <h3 className="font-semibold text-base sm:text-lg">
                                        {viewMode === 'week' ? `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${now.getFullYear()}` : `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Your preferred study time: {formatStudyWindow(profile?.preferred_study_time_start, profile?.preferred_study_time_end)}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => {
                                        setAnchorDate((prev) => {
                                            const d = new Date(prev)
                                            if (viewMode === 'week') {
                                                d.setDate(d.getDate() + 7)
                                            } else {
                                                const day = d.getDate()
                                                d.setMonth(d.getMonth() + 1)
                                                const last = getDaysInMonth(d.getFullYear(), d.getMonth())
                                                d.setDate(Math.min(day, last))
                                            }
                                            return d
                                        })
                                    }}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* View Toggles */}
                            <div className="bg-muted p-1 rounded-xl grid grid-cols-2 gap-1 w-full max-w-md mx-auto">
                                <button
                                    onClick={() => setViewMode("week")}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Week View
                                </button>
                                <button
                                    onClick={() => setViewMode("month")}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Calendar className="h-4 w-4" />
                                    Month View
                                </button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {/* Calendar Grids */}
                            {viewMode === "week" ? (
                                /* Week Layout */
                                <div className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar">
                                    {weekDays.map((dateObj, idx) => {
                                        const dateStr = formatDateToLocalString(dateObj)
                                        const dayItems = getLearningPathItemsForDate(plan.items, dateStr)

                                        return (
                                            <div
                                                key={idx}
                                                className="min-w-[140px] flex-1 border rounded-xl p-3 snap-start bg-card min-h-[200px]"
                                                onDragOver={(e) => {
                                                    // Must preventDefault to allow dropping.
                                                    e.preventDefault()
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault()
                                                    if (isMovingItem) return
                                                    const payload = e.dataTransfer.getData('text/plain')
                                                    handleRescheduleDrop(payload, dateStr)
                                                }}
                                            >
                                                <div className="mb-3">
                                                    <div className="font-medium text-sm">{dateObj.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                                                    <div className="text-xs text-muted-foreground">{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                </div>
                                                <div className="space-y-2">
                                                    {dayItems.map((item) => (
                                                        <div key={item.id}>{renderCalendarItem(item)}</div>
                                                    ))}
                                                    {dayItems.length > 0 ? null : (
                                                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-8 text-center text-balance">
                                                            No topics due
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                /* Month Layout */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium mb-2">
                                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                        {Array.from({ length: emptyCellsBefore }).map((_, i) => (
                                            <div key={`empty-${i}`} className="aspect-square p-2 border rounded-lg bg-card/50"></div>
                                        ))}
                                        {/* Creating an array of 31 days */}
                                        {Array.from({ length: monthDaysCount }).map((_, i) => {
                                            const dayDate = new Date(now.getFullYear(), now.getMonth(), i + 1);
                                            const dateStr = formatDateToLocalString(dayDate);
                                            const dayItems = getLearningPathItemsForDate(plan.items, dateStr)

                                            return (
                                                <div
                                                    key={i}
                                                    className="aspect-square p-1.5 sm:p-2 border rounded-lg bg-card relative min-h-[60px] sm:min-h-[80px] overflow-hidden"
                                                    onDragOver={(e) => {
                                                        e.preventDefault()
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault()
                                                        if (isMovingItem) return
                                                        const payload = e.dataTransfer.getData('text/plain')
                                                        handleRescheduleDrop(payload, dateStr)
                                                    }}
                                                >
                                                    <span className="text-xs font-medium">{i + 1}</span>
                                                    {dayItems.slice(0, 3).map((item) => (
                                                        <div key={item.id}>{renderCalendarItem(item, true)}</div>
                                                    ))}
                                                    {dayItems.length > 3 && (
                                                        <div className="mt-1 text-[10px] text-muted-foreground px-1 truncate">
                                                            +{dayItems.length - 3} more
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Recommendations */}
                    <Card className="bg-purple-50/50 border-purple-100">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2">AI Recommendations</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {weeklyProgress && weeklyProgress.questionsAnswered > 0
                                    ? `You've completed ${weeklyProgress.questionsAnswered} tasks this week! Keep up the great work.`
                                    : `You don't have any reviews yet this week. Remember, spaced repetition is the key to mastery!`}
                                {(stats?.needsReviewCount ?? 0) > 0 && ` Consider adding a review session for some weak topics.`}
                            </p>
                            <Button
                                className="bg-purple-500 hover:bg-purple-600 text-white border-0 shadow-sm"
                                disabled={replanLearningPath.isPending}
                                onClick={handleAutomaticReplan}
                            >
                                {replanLearningPath.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : null}
                                Reschedule Automatically
                            </Button>
                            {replanLearningPath.progress.total > 0 && replanLearningPath.isPending ? (
                                <p className="text-xs text-muted-foreground mt-3">
                                    Applying your saved availability to goal-based documents ({replanLearningPath.progress.done}/{replanLearningPath.progress.total}).
                                </p>
                            ) : null}
                            {replanLearningPath.data?.total === 0 ? (
                                <p className="text-xs text-muted-foreground mt-3">
                                    No goal-dated documents are available to replan yet.
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>

                    <div className="text-center text-xs text-muted-foreground pb-4">
                        All sessions synced with your adaptive study plan.
                    </div>
                </div>

                {/* Right Column: Sidebar Widgets */}
                <div className="w-full lg:w-80 space-y-6">

                    {/* Filters & Legend */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filters & Legend
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-green-300 bg-green-100"></div>
                                    <span className="text-sm font-medium">Mastered</span>
                                </div>
                                <Switch checked={showMastered} onCheckedChange={setShowMastered} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-yellow-300 bg-yellow-100"></div>
                                    <span className="text-sm font-medium">Developing</span>
                                </div>
                                <Switch checked={showDeveloping} onCheckedChange={setShowDeveloping} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-red-300 bg-red-100"></div>
                                    <span className="text-sm font-medium">Needs Review</span>
                                </div>
                                <Switch checked={showNeedsReview} onCheckedChange={setShowNeedsReview} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Summary */}
                    <Card>
                        <CardHeader className="pb-3 bg-muted/50 rounded-t-xl">
                            <CardTitle className="text-sm font-semibold">Weekly Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 bg-muted/20 border-t-0">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Concepts Mastered (All Time)</p>
                                <p className="text-xl font-bold text-purple-600">{stats?.masteredCount ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Total Study Hours (30d)</p>
                                <p className="text-xl font-bold text-purple-600">
                                    {efficiency ? (efficiency.totalTimeMinutes / 60).toFixed(1) : '0'} hrs
                                </p>
                            </div>
                            <div className="pt-2 border-t text-sm">
                                <p className="text-muted-foreground text-xs mb-1">Study Streak</p>
                                <p className="font-medium">{stats?.studyStreak ?? 0} {stats?.studyStreak === 1 ? 'day' : 'days'} tracking</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/quizzes")}>
                                <BookOpen className="w-4 h-4 mr-2" /> View All Quizzes
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/files")}>
                                <Clock className="w-4 h-4 mr-2" /> Open Study Materials
                            </Button>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}
