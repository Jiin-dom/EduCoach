import { useState } from "react"
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarDays,
    Clock,
    CheckCircle2,
    BookOpen,

    Target,
    Loader2,
    Zap,

    AlertCircle,
    ArrowUpRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
    useLearningStats,
    useRescheduleConceptDueDate,
    useStudyEfficiency,
    useLearningConfig,
} from "@/hooks/useLearning"
import { useWeeklyProgress } from "@/hooks/useLearningProgress"
import { useNavigate } from "react-router-dom"
import { useGenerateReviewQuiz, useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useAdaptiveQuizPolicies } from "@/hooks/useAdaptiveQuizPolicies"
import { useLearningPathPlan } from "@/hooks/useLearningPathPlan"
import { useRescheduleAdaptiveStudyTask } from "@/hooks/useAdaptiveStudy"
import { getLearningPathItemsForDate, type LearningPathPlanItem, type PlannedReviewPlanItem } from "@/lib/learningPathPlan"
import type { LearningPathPlanScopeFilter } from "@/lib/learningPathScope"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateToLocalString(d: Date) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}



type ScheduleFilter = 'all' | 'due' | 'needs_review' | 'developing'

interface QuizItem {
    id: string;
    title: string;
    documentTitle: string | null;
    dueDate: string | null;
    taskId?: string;
    status?: string;
    documentId?: string;
    conceptIds?: string[];
}

interface LearningPathCalendarProps {
    scopeFilter?: LearningPathPlanScopeFilter
    dueTodayQuizzes?: QuizItem[]
    completedTodayQuizzes?: QuizItem[]
}

export function LearningPathCalendar({
    scopeFilter,
    dueTodayQuizzes = [],
    completedTodayQuizzes = [],
}: LearningPathCalendarProps) {
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState<"week" | "month">("week")
    const [anchorDate, setAnchorDate] = useState(() => new Date())
    const [focusFilter, setFocusFilter] = useState<ScheduleFilter>('all')
    const [dismissingTaskIds, setDismissingTaskIds] = useState<Record<string, true>>({})
    const [dismissedTaskIds, setDismissedTaskIds] = useState<Record<string, true>>({})
    const [dismissedDueTodayQuizIds, setDismissedDueTodayQuizIds] = useState<Record<string, true>>({})

    const { data: stats } = useLearningStats();
    const { data: weeklyProgress } = useWeeklyProgress();
    const { data: efficiency } = useStudyEfficiency();
    const { data: learningConfig } = useLearningConfig();
    const plan = useLearningPathPlan(scopeFilter)
    const generateReview = useGenerateReviewQuiz()
    
    const rescheduleDueDate = useRescheduleConceptDueDate()
    const rescheduleAdaptiveTask = useRescheduleAdaptiveStudyTask()
    const { data: attempts = [] } = useUserAttempts()
    const { data: quizzes = [] } = useQuizzes()
    const { profile } = useAuth()
    const adaptiveQuizPolicy = useAdaptiveQuizPolicies({
        quizzes,
        attempts,
        adaptiveTasks: plan.adaptiveTasks.map((item) => item.task),
    })
    const todayLocal = adaptiveQuizPolicy.todayLocal
    const completedDocumentIdsToday = adaptiveQuizPolicy.completedAdaptiveDocumentIdsToday
    const reusableReadyQuizIdByDocument = adaptiveQuizPolicy.reusableReadyQuizIdByDocument

    const scopedStats = {
        masteredCount: plan.performancePlannedReviews.filter((item) => item.mastery.display_mastery_level === "mastered").length,
        needsReviewCount: plan.performancePlannedReviews.filter((item) => item.mastery.display_mastery_level === "needs_review").length,
        developingCount: plan.performancePlannedReviews.filter((item) => item.mastery.display_mastery_level === "developing").length,
    }

    const handleAdaptiveQuizAction = (task: {
        id?: string;
        taskId?: string;
        status?: string;
        documentId?: string;
        conceptIds?: string[];
    }) => {
        const documentId = task.documentId
        if (!documentId) return

        const fallbackQuizId = reusableReadyQuizIdByDocument.get(documentId)
        const effectiveQuizId = (task.id && task.id !== task.taskId ? task.id : null) ?? fallbackQuizId
        
        if (effectiveQuizId) {
            routeToQuizzesWithHighlight(effectiveQuizId, task.taskId)
            return
        }

        if (task.status === 'generating') {
            toast.info('Your adaptive quiz is still being prepared. Check the Quizzes page in a moment.')
            navigate('/quizzes')
            return
        }

        if (task.status === 'needs_generation' && completedDocumentIdsToday.has(documentId)) {
            toast.info('You already completed today\'s quiz for this file. The next adaptive quiz will be prepared on the next available study day.')
            return
        }

        toast.loading('Preparing adaptive quiz...')
        generateReview.mutate(
            {
                documentId,
                focusConceptIds: task.conceptIds || [],
                questionCount: Math.max(5, Math.min(12, (task.conceptIds?.length || 0) * 2)),
            },
            {
                onSuccess: (data) => {
                    toast.dismiss()
                    routeToQuizzesWithHighlight(data.quizId, task.taskId)
                },
                onError: (err) => {
                    toast.dismiss()
                    toast.error('Adaptive quiz generation failed: ' + (err as Error).message)
                },
            },
        )
    }

    const dueTodayCount = plan.items.filter((item) => item.date === todayLocal).length
    const confidenceTarget = Math.round((learningConfig?.confidence_threshold_mastered ?? 0.8) * 100)

    // Compute Dates
    const now = anchorDate
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
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
    const emptyCellsBefore = firstDayOfMonth;

    const isMovingItem = rescheduleDueDate.isPending || rescheduleAdaptiveTask.isPending
    const dragPayload = (payload: Record<string, string>) => JSON.stringify(payload)

    const renderFixedBadge = () => (
        <span className="ml-auto shrink-0 rounded-full border border-current/20 bg-background/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80 shadow-sm">
            Fixed
        </span>
    )

    const renderSessionBadge = (session: PlannedReviewPlanItem) => {
        let colors = ""
        switch (session.mastery.display_mastery_level) {
            case "mastered": colors = "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"; break;
            case "developing": colors = "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"; break;
            case "needs_review": colors = "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"; break;
            default: colors = "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"; break;
        }

        if (session.source === "baseline") {
            colors = "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
        }

        const isFuture = session.date > todayLocal
        return (
            <button
                type="button"
                draggable
                onClick={() => {
                    if (isFuture) {
                        toast.info(`This concept review is scheduled for ${session.date}. You can start it when that day arrives.`)
                        return
                    }
                    if (session.documentId) {
                        navigate(`/files/${session.documentId}?tab=concepts&concept=${session.conceptId}`)
                    }
                }}
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "planned_review",
                        conceptId: session.conceptId,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs mb-2 ${colors} cursor-grab active:cursor-grabbing transition-colors shadow-sm`}
                title={isFuture ? `Planned review (Locked until ${session.date}). Drag to reschedule.` : (session.source === "baseline" ? "Drag to reschedule baseline plan" : "Drag to reschedule review deadline")}
            >
                <div className="flex items-center gap-2 font-medium truncate">
                    <div className={`p-1.5 rounded-md bg-white/50 shrink-0`}>
                        {session.mastery.display_mastery_level === 'mastered' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {session.mastery.display_mastery_level === 'developing' && <Clock className="w-3.5 h-3.5" />}
                        {session.mastery.display_mastery_level === 'needs_review' && <BookOpen className="w-3.5 h-3.5" />}
                    </div>
                    <span className="truncate">{session.source === "baseline" ? `Planned: ${session.conceptName}` : session.conceptName}</span>
                    {session.scheduledTime ? (
                        <span className="ml-auto text-[10px] font-semibold tabular-nums opacity-80">{session.scheduledTime}</span>
                    ) : null}
                </div>
            </button>
        )
    }

    const renderMonthSessionBadge = (session: PlannedReviewPlanItem) => {
        let colors = ""
        switch (session.mastery.display_mastery_level) {
            case "mastered": colors = "bg-green-50 text-green-700 border-green-200"; break;
            case "developing": colors = "bg-yellow-50 text-yellow-700 border-yellow-200"; break;
            case "needs_review": colors = "bg-red-50 text-red-700 border-red-200"; break;
            default: colors = "bg-gray-50 text-gray-700 border-gray-200"; break;
        }
        if (session.source === "baseline") {
            colors = "bg-primary/10 text-primary border-primary/20"
        }
        const isFuture = session.date > todayLocal
        return (
            <button
                type="button"
                draggable
                onClick={() => {
                    if (isFuture) {
                        toast.info(`This concept review is scheduled for ${session.date}. You can start it when that day arrives.`)
                        return
                    }
                    if (session.documentId) {
                        navigate(`/files/${session.documentId}?tab=concepts&concept=${session.conceptId}`)
                    }
                }}
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "planned_review",
                        conceptId: session.conceptId,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`w-full mt-1 text-left text-[10px] p-1.5 rounded-md truncate border flex items-center gap-1 ${colors} cursor-grab active:cursor-grabbing shadow-sm`}
                title={isFuture ? `Locked until ${session.date}. Drag to reschedule.` : (session.source === "baseline" ? "Drag to reschedule baseline plan" : "Drag to reschedule review deadline")}
            >
                {session.mastery.display_mastery_level === 'mastered' && <CheckCircle2 className="w-2.5 h-2.5 hidden sm:block" />}
                {session.mastery.display_mastery_level === 'developing' && <Clock className="w-2.5 h-2.5 hidden sm:block" />}
                {session.mastery.display_mastery_level === 'needs_review' && <BookOpen className="w-2.5 h-2.5 hidden sm:block" />}
                <span className="truncate">{session.source === "baseline" ? `Planned: ${session.conceptName}` : session.conceptName}</span>
                {session.scheduledTime ? <span className="ml-auto tabular-nums opacity-70">{session.scheduledTime}</span> : null}
            </button>
        )
    }

    const routeToQuizzesWithHighlight = (quizId?: string, taskId?: string) => {
        if (taskId) {
            setDismissingTaskIds((prev) => ({ ...prev, [taskId]: true }))
            window.setTimeout(() => {
                setDismissedTaskIds((prev) => ({ ...prev, [taskId]: true }))
                setDismissingTaskIds((prev) => {
                    const next = { ...prev }
                    delete next[taskId]
                    return next
                })
            }, 480)
        }

        if (quizId) {
            setDismissedDueTodayQuizIds((prev) => ({ ...prev, [quizId]: true }))
        }

        window.setTimeout(() => {
            navigate('/quizzes', {
                state: quizId ? { highlightQuizId: quizId } : undefined,
            })
        }, taskId ? 180 : 0)
    }

    const renderCalendarItem = (item: LearningPathPlanItem, compact = false) => {
        if (item.kind === "planned_review") {
            return compact ? renderMonthSessionBadge(item) : renderSessionBadge(item)
        }

        if (item.kind === "goal_marker") {
            const isFuture = item.date > todayLocal
            const colors = item.markerType === "quiz_deadline"
                ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
            const icon = item.markerType === "quiz_deadline" ? <Target className="w-3.5 h-3.5 text-purple-600" /> : <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            const label = item.markerType === "quiz_deadline" ? "Quiz" : "Study"

            const handleClick = () => {
                if (isFuture) {
                    toast.info(`This ${label.toLowerCase()} goal is scheduled for ${item.date}. You can start it when that day arrives.`)
                    return
                }
                if (item.quizId) {
                    routeToQuizzesWithHighlight(item.quizId)
                }
            }

            if (compact) {
                return (
                    <button
                        type="button"
                        onClick={handleClick}
                        className={`w-full mt-1 text-[10px] font-bold p-1.5 rounded-md truncate border flex items-center gap-1 ${colors} hover:opacity-90 transition-opacity shadow-sm ${item.quizId ? 'cursor-pointer' : 'cursor-default'}`}
                        title={isFuture ? `${item.title} (Locked until ${item.date})` : `${item.title} (fixed milestone)`}
                    >
                        {icon}
                        <span className="truncate">{item.title}</span>
                        {renderFixedBadge()}
                    </button>
                )
            }

            return (
                <button
                    type="button"
                    onClick={handleClick}
                    className={`w-full text-left p-3 rounded-xl border text-xs mb-2 ${colors} hover:opacity-90 transition-opacity shadow-sm ${item.quizId ? 'cursor-pointer' : 'cursor-default'}`}
                    title={isFuture ? `${label} goal (Locked until ${item.date})` : `${label} goal (fixed milestone)`}
                >
                    <div className="flex items-center gap-2 font-bold truncate">
                        <div className="p-1.5 rounded-md bg-white/60 shrink-0">
                            {icon}
                        </div>
                        <span className="truncate">{label}: {item.title}</span>
                        {renderFixedBadge()}
                    </div>
                </button>
            )
        }

        const task = item.task
        const isCompleted = task.type === 'quiz' && task.quizId && attempts.some(a => a.quiz_id === task.quizId)
        
        const colors = isCompleted
            ? 'bg-green-50 text-green-700 border-green-200'
            : task.type === 'quiz'
                ? 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 tracking-wide'
                : task.type === 'flashcards'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 tracking-wide'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 tracking-wide'

        const label = task.type === 'quiz'
            ? (isCompleted ? 'Retake' : 'Quiz')
            : task.type === 'flashcards'
                ? 'Cards'
                : 'Review'

        const iconProps = { className: "w-3.5 h-3.5 opacity-80" }
        const taskIcon = isCompleted 
            ? <CheckCircle2 {...iconProps} className="w-3.5 h-3.5 text-green-600" />
            : task.type === 'quiz' ? <Target {...iconProps} /> : task.type === 'flashcards' ? <BookOpen {...iconProps} /> : <AlertCircle {...iconProps} />

        const isFuture = item.date > todayLocal
        const isLocked = isFuture && !isCompleted

        const openTask = () => {
             if (isLocked) {
                 toast.info(`This ${task.type} session is scheduled for ${item.date}. You can start it when that day arrives.`)
                 return
             }
             if (task.type === 'quiz') {
                 handleAdaptiveQuizAction({
                     id: task.quizId,
                     taskId: task.id,
                     status: task.status,
                     documentId: task.documentId,
                     conceptIds: task.conceptIds
                 })
                 return
             }
             if (task.type === 'flashcards') {
                 navigate(`/files/${task.documentId}?tab=flashcards`)
                 return
             }
             if (task.conceptIds.length > 0) {
                 navigate(`/files/${task.documentId}?tab=concepts&concept=${task.conceptIds[0]}`)
                 return
             }
             navigate(`/files/${task.documentId}?tab=concepts`)
        }

        return (
            <button
                type="button"
                onClick={openTask}
                draggable={!isCompleted}
                onDragStart={(e) => {
                    if (isCompleted) {
                        e.preventDefault()
                        return
                    }
                    e.dataTransfer.setData('text/plain', dragPayload({
                        kind: "adaptive_task",
                        taskId: task.id,
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`${compact ? 'mt-1 text-[10px] p-1.5 rounded-md' : 'p-3 rounded-xl mb-2'} w-full border text-xs shadow-sm ${colors} text-left transition-all duration-500 ${isCompleted ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} hover:shadow-md flex items-center gap-2 ${dismissingTaskIds[task.id] ? 'opacity-0 scale-[0.98]' : ''}`}
                title={isLocked ? `${task.title} (Locked until ${item.date}). Drag to reschedule.` : `${task.title}. ${isCompleted ? 'Completed. Click to retake.' : 'Drag to move or click to open.'}`}
            >
                <div className={`p-1.5 rounded-md shrink-0 ${isCompleted ? 'bg-green-100/50' : 'bg-white/60'}`}>
                    {taskIcon}
                </div>
                <div className="font-bold truncate w-full flex-1">
                    {label}: {task.documentTitle}
                </div>
                {item.scheduledTime ? (
                    <span className="text-[10px] font-semibold tabular-nums opacity-80 shrink-0">{item.scheduledTime}</span>
                ) : null}
            </button>
        )
    }

    const handleRescheduleDrop = (rawPayload: string, targetDateStr: string) => {
        if (!rawPayload || !targetDateStr) return

        if (targetDateStr < todayLocal) {
            toast.error("You cannot reschedule items to a past date.")
            return
        }

        let payload: { kind?: string; conceptId?: string; taskId?: string } | null = null
        try {
            payload = JSON.parse(rawPayload)
        } catch {
            payload = { kind: "planned_review", conceptId: rawPayload }
        }

        if (payload?.kind === "adaptive_task" && payload.taskId) {
            const source = plan.items.find((item) => item.kind === "adaptive_task" && item.task.id === payload?.taskId)
            if (!source || source.kind !== "adaptive_task") return

            // Prevent moving completed quizzes
            const isCompleted = source.task.type === 'quiz' && source.task.quizId && attempts.some(a => a.quiz_id === source.task.quizId)
            if (isCompleted) {
                toast.error("You cannot reschedule a completed quiz.")
                return
            }

            if (source.task.scheduledDate === targetDateStr) return

            rescheduleAdaptiveTask.mutate(
                { taskId: source.task.id, newScheduledDate: targetDateStr, task: source.task },
                {
                    onSuccess: () => toast.success(`Moved ${source.task.type} to ${targetDateStr}.`),
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to move study task."),
                },
            )
            return
        }

        const conceptId = payload?.conceptId
        if (!conceptId) return
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
                onSuccess: () => toast.success(`Moved review to ${targetDateStr}.`),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to move review."),
            },
        )
    }


    
    // AI Insight text
    const getInsightText = () => {
        if (scopedStats.needsReviewCount > 0) {
            return `You have ${scopedStats.needsReviewCount} concepts that need urgent review to prevent forgetting.`
        } else if (efficiency?.mostEfficientCategory) {
            return `You're mastering ${efficiency.mostEfficientCategory} very efficiently! Focus your extra time on weaker subjects.`
        } else if (weeklyProgress && weeklyProgress.conceptsImproved > 0) {
            return `You improved ${weeklyProgress.conceptsImproved} concepts this week. Consistency is paying off!`
        }
        return `Your schedule looks clear. Keep up the steady pace to reach your confidence target of ${confidenceTarget}%.`
    }

    return (
        <div className="space-y-6">

            {/* Top Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                
                {/* AI Insight Gradient Card (Takes 2 columns visually on lg, or full width on md) */}
                <Card className="lg:col-span-2 overflow-hidden border-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md relative">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Zap className="w-24 h-24" />
                    </div>
                    <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                        <div>
                            <div className="text-white/80 font-medium text-xs tracking-wider uppercase mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> AI Target Insight</div>
                            <h3 className="text-xl font-bold leading-tight text-white mb-4">
                                {getInsightText()}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* Progress Card */}
                <Card className="lg:col-span-2 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-semibold text-lg">Study Progress</h3>
                                <p className="text-sm text-muted-foreground">{stats?.totalConcepts ?? 0} total concepts tracking</p>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl font-bold tracking-tighter text-primary">{Math.round(stats?.averageMastery ?? 0)}</span><span className="text-muted-foreground font-medium">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Progress value={Math.round(stats?.averageMastery ?? 0)} className="h-2.5" />
                            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                <span>Average Mastery</span>
                                <span>Confidence Target: {confidenceTarget}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Schedule Stats Summary Tiles Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-background shadow-sm hover:border-primary/50 transition-colors">
                    <CardContent className="p-3">
                        <p className="text-[10px] font-bold text-muted-foreground mb-0.5 uppercase tracking-wider">Due Today</p>
                        <p className="text-xl font-black">{dueTodayCount}</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 shadow-sm hover:border-red-500/50 transition-colors">
                    <CardContent className="p-3">
                        <p className="text-[10px] font-bold text-red-600 mb-0.5 uppercase tracking-wider">Needs Review</p>
                        <p className="text-xl font-black text-red-700">{scopedStats.needsReviewCount}</p>
                    </CardContent>
                </Card>
                <Card className="bg-yellow-50/50 shadow-sm hover:border-yellow-500/50 transition-colors">
                    <CardContent className="p-3">
                        <p className="text-[10px] font-bold text-yellow-600 mb-0.5 uppercase tracking-wider">Developing</p>
                        <p className="text-xl font-black text-yellow-700">{scopedStats.developingCount}</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50/50 shadow-sm hover:border-green-500/50 transition-colors">
                    <CardContent className="p-3">
                        <p className="text-[10px] font-bold text-green-600 mb-0.5 uppercase tracking-wider">Mastered</p>
                        <p className="text-xl font-black text-green-700">{scopedStats.masteredCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Due Today Quizzes Section - Always visible for tracking */}
            <Card className="mb-6 border-red-200 bg-red-50/10 shadow-sm overflow-hidden">
                <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-red-100">
                    {/* Due Section */}
                    <div className="flex-1">
                        <CardHeader className="pb-2 pt-3 px-4 bg-red-50/50">
                            <CardTitle className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-600">
                                <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    Due Today
                                </div>
                                <span className="bg-red-100 px-1.5 py-0.5 rounded text-[10px]">{dueTodayQuizzes.length}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white/50 overflow-y-auto max-h-[200px] scrollbar-thin">
                            {dueTodayQuizzes.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {dueTodayQuizzes.filter((quiz) => !dismissedDueTodayQuizIds[quiz.id]).map((quiz) => (
                                        <button
                                            key={quiz.id}
                                            type="button"
                                            onClick={() => {
                                                if (quiz.taskId) {
                                                    handleAdaptiveQuizAction(quiz)
                                                } else {
                                                    routeToQuizzesWithHighlight(quiz.id)
                                                }
                                            }}
                                            className="flex items-center justify-between rounded-lg border bg-card p-2.5 shadow-sm transition-all hover:border-red-400 hover:shadow-md text-left group"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="truncate font-bold text-xs tracking-tight group-hover:text-red-600 transition-colors">
                                                    {quiz.title}
                                                    {quiz.status && quiz.status !== 'ready' && (
                                                        <span className="ml-2 text-[8px] opacity-60 italic lowercase">({quiz.status})</span>
                                                    )}
                                                </p>
                                                {quiz.documentTitle && (
                                                    <p className="truncate text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{quiz.documentTitle}</p>
                                                )}
                                            </div>
                                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-red-500" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center py-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">No quizzes due today</p>
                                </div>
                            )}
                        </CardContent>
                    </div>

                    {/* Completed Section */}
                    <div className="flex-1">
                        <CardHeader className="pb-2 pt-3 px-4 bg-green-50/50">
                            <CardTitle className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-green-600">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Completed Today
                                </div>
                                <span className="bg-green-100 px-1.5 py-0.5 rounded text-[10px]">{completedTodayQuizzes.length}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white/50 overflow-y-auto max-h-[200px] scrollbar-thin">
                            {completedTodayQuizzes.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {completedTodayQuizzes.map((quiz) => (
                                        <button
                                            key={quiz.id}
                                            type="button"
                                            onClick={() => routeToQuizzesWithHighlight(quiz.id)}
                                            className="flex items-center justify-between rounded-lg border bg-card p-2.5 shadow-sm transition-all hover:border-green-400 hover:shadow-md text-left group"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="truncate font-bold text-xs tracking-tight group-hover:text-green-600 transition-colors">{quiz.title}</p>
                                                {quiz.documentTitle && (
                                                    <p className="truncate text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{quiz.documentTitle}</p>
                                                )}
                                            </div>
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center py-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">None completed yet</p>
                                </div>
                            )}
                        </CardContent>
                    </div>
                </div>
            </Card>


            {/* Main Calendar Section */}
            <Card className="shadow-sm border-muted">
                <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Focus Filters (Mobile Pills Style) */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar flex-1">
                            {(['all', 'due', 'needs_review', 'developing'] as ScheduleFilter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFocusFilter(f)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                        focusFilter === f 
                                            ? 'bg-primary text-primary-foreground shadow-sm' 
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    {f === 'all' ? 'All' : f === 'due' ? 'Due Today' : f === 'needs_review' ? 'Needs Review' : 'Developing'}
                                </button>
                            ))}
                        </div>

                        {/* Calendar Navigator & View Toggles */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="bg-muted p-1 rounded-xl flex">
                                <button
                                    onClick={() => setViewMode("week")}
                                    className={`p-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${viewMode === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    <span className="hidden sm:inline">Week</span>
                                </button>
                                <button
                                    onClick={() => setViewMode("month")}
                                    className={`p-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${viewMode === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Calendar className="h-4 w-4" />
                                    <span className="hidden sm:inline">Month</span>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-auto md:ml-0">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => {
                                        setAnchorDate((prev) => {
                                            const d = new Date(prev)
                                            if (viewMode === 'week') d.setDate(d.getDate() - 7)
                                            else {
                                                const day = d.getDate()
                                                d.setMonth(d.getMonth() - 1)
                                                const last = getDaysInMonth(d.getFullYear(), d.getMonth())
                                                d.setDate(Math.min(day, last))
                                            }
                                            return d
                                        })
                                    }}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold text-sm min-w-[100px] text-center">
                                    {viewMode === 'week' ? `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ` : `${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => {
                                        setAnchorDate((prev) => {
                                            const d = new Date(prev)
                                            if (viewMode === 'week') d.setDate(d.getDate() + 7)
                                            else {
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
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    {viewMode === "week" ? (
                        /* Week Layout */
                        <div className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar">
                            {weekDays.map((dateObj, idx) => {
                                const dateStr = formatDateToLocalString(dateObj)
                                let dayItems = getLearningPathItemsForDate(plan.items, dateStr)
                                dayItems = dayItems.filter((item) => !(item.kind === "adaptive_task" && item.task.type === "quiz" && dismissedTaskIds[item.task.id]))
                                
                                // Apply focus filter
                                if (focusFilter !== 'all') {
                                    if (focusFilter === 'due') {
                                        if (dateStr !== todayLocal) dayItems = [];
                                    } else {
                                        dayItems = dayItems.filter(item => 
                                            item.kind === "planned_review" && item.mastery.display_mastery_level === focusFilter
                                        );
                                    }
                                }

                                const isToday = dateStr === todayLocal
                                const isPast = dateStr < todayLocal

                                return (
                                    <div
                                        key={idx}
                                        className={`min-w-[200px] flex-1 border rounded-2xl p-3 snap-start bg-card min-h-[300px] flex flex-col ${isToday ? 'ring-2 ring-primary/20 border-primary/30' : ''} ${isPast ? 'bg-muted/40 opacity-60 grayscale-[0.2]' : ''}`}
                                        onDragOver={(e) => { 
                                            if (!isPast) e.preventDefault() 
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            if (isMovingItem || isPast) return
                                            const payload = e.dataTransfer.getData('text/plain')
                                            handleRescheduleDrop(payload, dateStr)
                                        }}
                                    >
                                        <div className="mb-4 flex items-center justify-between px-1">
                                            <div>
                                                <div className={`font-bold text-sm ${isToday ? 'text-primary' : ''}`}>{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                                <div className="text-2xl font-black opacity-80">{dateObj.getDate()}</div>
                                            </div>
                                            {isToday && <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Today</span>}
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            {dayItems.map((item) => (
                                                <div key={item.id}>{renderCalendarItem(item)}</div>
                                            ))}
                                            {dayItems.length === 0 && (
                                                <div className="h-full min-h-[150px] flex items-center justify-center text-xs text-muted-foreground py-8 text-center text-balance italic border-2 border-dashed border-border/50 rounded-xl">
                                                    Drop topics here
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
                            <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold text-muted-foreground mb-2">
                                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: emptyCellsBefore }).map((_, i) => (
                                    <div key={`empty-${i}`} className="aspect-square p-2 border rounded-xl bg-muted/20 border-dashed"></div>
                                ))}
                                {Array.from({ length: monthDaysCount }).map((_, i) => {
                                    const dayDate = new Date(now.getFullYear(), now.getMonth(), i + 1);
                                    const dateStr = formatDateToLocalString(dayDate);
                                    let dayItems = getLearningPathItemsForDate(plan.items, dateStr)
                                    dayItems = dayItems.filter((item) => !(item.kind === "adaptive_task" && item.task.type === "quiz" && dismissedTaskIds[item.task.id]))

                                    if (focusFilter !== 'all') {
                                        if (focusFilter === 'due') {
                                            if (dateStr !== todayLocal) dayItems = [];
                                        } else {
                                            dayItems = dayItems.filter(item => 
                                                item.kind === "planned_review" && item.mastery.display_mastery_level === focusFilter
                                            );
                                        }
                                    }

                                    const isToday = dateStr === todayLocal
                                    const isPast = dateStr < todayLocal

                                    return (
                                        <div
                                            key={i}
                                            className={`aspect-square p-1.5 sm:p-2 border rounded-xl relative min-h-[80px] sm:min-h-[100px] overflow-hidden transition-colors ${isToday ? 'bg-primary/5 ring-1 ring-primary/20 border-primary/30' : 'bg-card'} ${isPast ? 'bg-muted/40 opacity-60 grayscale-[0.2]' : 'hover:border-primary/50'}`}
                                            onDragOver={(e) => { 
                                                if (!isPast) e.preventDefault() 
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                if (isMovingItem || isPast) return
                                                const payload = e.dataTransfer.getData('text/plain')
                                                handleRescheduleDrop(payload, dateStr)
                                            }}
                                        >
                                            <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'opacity-70'}`}>{i + 1}</span>
                                            <div className="mt-1 space-y-1">
                                                {dayItems.slice(0, 3).map((item) => (
                                                    <div key={item.id}>{renderCalendarItem(item, true)}</div>
                                                ))}
                                                {dayItems.length > 3 && (
                                                    <div className="mt-1.5 text-[10px] font-medium text-muted-foreground px-1 py-0.5 rounded bg-muted w-max">
                                                        +{dayItems.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground py-4">
                All sessions and goals are fully synchronized with your personalized Study AI.
            </div>
        </div>
    )
}
