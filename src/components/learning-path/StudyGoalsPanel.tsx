import { useState, useMemo } from "react"
import {
    Target,
    Plus,
    Trash2,
    CheckCircle2,
    Clock,
    BookOpen,
    Brain,
    Trophy,
    Loader2,
    CalendarDays,
    TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    useStudyGoals,
    useCreateGoal,
    useUpdateGoal,
    useDeleteGoal,
    type GoalType,
    type StudyGoal,
} from "@/hooks/useStudyGoals"
import { useConceptMasteryList, useLearningStats } from "@/hooks/useLearning"
import { useDocuments } from "@/hooks/useDocuments"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { toast } from "sonner"

// ─── Progress Helpers ─────────────────────────────────────────────────────────

function useGoalProgress(
    goal: StudyGoal,
    masteryList: ReturnType<typeof useConceptMasteryList>["data"],
    stats: ReturnType<typeof useLearningStats>["data"],
    attempts: ReturnType<typeof useUserAttempts>["data"],
): { current: number; percent: number } {
    return useMemo(() => {
        let current = 0

        if (goal.goal_type === "topic_mastery") {
            if (goal.concept_id) {
                const concept = (masteryList ?? []).find((m) => m.concept_id === goal.concept_id)
                current = concept ? Math.round(concept.display_mastery_score) : 0
            } else if (goal.document_id) {
                const docConcepts = (masteryList ?? []).filter((m) => m.document_id === goal.document_id)
                if (docConcepts.length > 0) {
                    const total = docConcepts.reduce((acc, c) => acc + c.display_mastery_score, 0)
                    current = Math.round(total / docConcepts.length)
                }
            }
        } else if (goal.goal_type === "quiz_count") {
            if (goal.quiz_id) {
                const hasAttempt = (attempts ?? []).some((a) => a.quiz_id === goal.quiz_id)
                current = hasAttempt ? 1 : 0
            } else {
                current = stats?.quizzesCompleted ?? 0
            }
        } else if (goal.goal_type === "overall_mastery") {
            current = stats?.averageMastery ?? 0
        }

        let percent = 0
        if (goal.target_value > 0) {
            percent = Math.min(100, Math.round((current / goal.target_value) * 100))
        }
        return { current, percent }
    }, [goal, masteryList, stats, attempts])
}

function goalTypeLabel(t: GoalType) {
    switch (t) {
        case "topic_mastery": return "Topic Mastery"
        case "quiz_count": return "Quiz Completion"
        case "overall_mastery": return "Overall Mastery"
    }
}

function goalTypeIcon(t: GoalType) {
    switch (t) {
        case "topic_mastery": return <BookOpen className="w-4 h-4" />
        case "quiz_count": return <Brain className="w-4 h-4" />
        case "overall_mastery": return <TrendingUp className="w-4 h-4" />
    }
}

function goalTypeUnit(t: GoalType) {
    if (t === "quiz_count") return "quizzes"
    return "%"
}

function daysRemaining(deadline: string | null): string | null {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(deadline + "T00:00:00")
    const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)}d overdue`
    if (diff === 0) return "Due today"
    if (diff === 1) return "Due tomorrow"
    return `${diff}d left`
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
    goal,
    masteryList,
    stats,
    attempts,
}: {
    goal: StudyGoal
    masteryList: ReturnType<typeof useConceptMasteryList>["data"]
    stats: ReturnType<typeof useLearningStats>["data"]
    attempts: ReturnType<typeof useUserAttempts>["data"]
}) {
    const { current, percent } = useGoalProgress(goal, masteryList, stats, attempts)
    const updateGoal = useUpdateGoal()
    const deleteGoal = useDeleteGoal()

    const isCompleted = goal.is_completed

    const handleComplete = () => {
        updateGoal.mutate(
            { id: goal.id, is_completed: true, completed_at: new Date().toISOString() },
            {
                onSuccess: () => toast.success("Goal marked as complete! 🎉"),
                onError: () => toast.error("Failed to update goal."),
            }
        )
    }

    const handleDelete = () => {
        deleteGoal.mutate(goal.id, {
            onSuccess: () => toast.info("Goal deleted."),
            onError: () => toast.error("Failed to delete goal."),
        })
    }

    const deadline = daysRemaining(goal.deadline)
    const isOverdue = deadline?.includes("overdue")

    return (
        <div
            className={`rounded-xl border p-4 transition-all ${
                isCompleted
                    ? "bg-green-50 border-green-200"
                    : "bg-card hover:bg-accent/5"
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isCompleted
                            ? "bg-green-100 text-green-600"
                            : "bg-primary/10 text-primary"
                    }`}
                >
                    {isCompleted ? (
                        <Trophy className="w-5 h-5" />
                    ) : (
                        goalTypeIcon(goal.goal_type)
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                            <p className="font-semibold truncate text-sm">{goal.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {goalTypeLabel(goal.goal_type)}
                                </Badge>
                                {isCompleted ? (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                                        Completed ✓
                                    </Badge>
                                ) : null}
                                {!isCompleted && deadline && (
                                    <span
                                        className={`flex items-center gap-1 text-[11px] font-medium ${
                                            isOverdue ? "text-red-600" : "text-muted-foreground"
                                        }`}
                                    >
                                        <Clock className="w-3 h-3" />
                                        {deadline}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                            {!isCompleted && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={handleComplete}
                                    disabled={updateGoal.isPending}
                                    title="Mark complete"
                                >
                                    {updateGoal.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                onClick={handleDelete}
                                disabled={deleteGoal.isPending}
                                title="Delete goal"
                            >
                                {deleteGoal.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                                {current}{goalTypeUnit(goal.goal_type)} / {goal.target_value}{goalTypeUnit(goal.goal_type)}
                            </span>
                            <span className={isCompleted ? "text-green-600 font-medium" : ""}>
                                {percent}%
                            </span>
                        </div>
                        <Progress
                            value={percent}
                            className={`h-2 ${isCompleted ? "[&>div]:bg-green-500" : ""}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Add Goal Dialog ──────────────────────────────────────────────────────────

function AddGoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { data: masteryList } = useConceptMasteryList()
    const { data: documents } = useDocuments()
    const { data: quizzes } = useQuizzes()
    const createGoal = useCreateGoal()

    const [title, setTitle] = useState("")
    const [goalType, setGoalType] = useState<GoalType>("overall_mastery")
    const [targetValue, setTargetValue] = useState<string>("80")
    
    // topic_mastery sub-state
    const [topicTargetType, setTopicTargetType] = useState<"concept" | "document">("concept")
    const [conceptId, setConceptId] = useState<string>("")
    const [documentId, setDocumentId] = useState<string>("")
    
    // quiz_count sub-state
    const [quizTargetType, setQuizTargetType] = useState<"count" | "specific">("count")
    const [quizId, setQuizId] = useState<string>("")
    
    const [deadline, setDeadline] = useState<string>("")

    const reset = () => {
        setTitle("")
        setGoalType("overall_mastery")
        setTargetValue("80")
        setTopicTargetType("concept")
        setConceptId("")
        setDocumentId("")
        setQuizTargetType("count")
        setQuizId("")
        setDeadline("")
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const handleSubmit = () => {
        const parsed = parseInt(targetValue, 10)
        if (!title.trim()) {
            toast.error("Please enter a goal title.")
            return
        }
        if (isNaN(parsed) || parsed <= 0) {
            toast.error("Please enter a valid target value.")
            return
        }
        if (goalType === "topic_mastery") {
            if (topicTargetType === "concept" && !conceptId) {
                toast.error("Please select a topic for this goal.")
                return
            }
            if (topicTargetType === "document" && !documentId) {
                toast.error("Please select a document for this goal.")
                return
            }
        }
        if (goalType === "quiz_count" && quizTargetType === "specific" && !quizId) {
            toast.error("Please select a quiz for this goal.")
            return
        }

        const finalTargetValue = (goalType === "quiz_count" && quizTargetType === "specific") ? 1 : parsed

        // For topic mastery, auto-generate a better title if the user left it blank
        createGoal.mutate(
            {
                title: title.trim(),
                goal_type: goalType,
                target_value: finalTargetValue,
                concept_id: (goalType === "topic_mastery" && topicTargetType === "concept") ? (conceptId || null) : null,
                document_id: (goalType === "topic_mastery" && topicTargetType === "document") ? (documentId || null) : null,
                quiz_id: (goalType === "quiz_count" && quizTargetType === "specific") ? (quizId || null) : null,
                deadline: deadline || null,
            },
            {
                onSuccess: () => {
                    toast.success("Goal created!")
                    handleClose()
                },
                onError: (err) => {
                    toast.error("Failed to create goal: " + (err as Error).message)
                },
            }
        )
    }

    const getTargetPlaceholder = () => {
        if (goalType === "quiz_count") return "e.g. 10"
        return "e.g. 80"
    }

    const getTargetLabel = () => {
        if (goalType === "quiz_count") return "Target (number of quizzes)"
        return "Target Mastery (%)"
    }

    // Unique concepts from mastery list
    const conceptOptions = useMemo(() => {
        const seen = new Set<string>()
        return (masteryList ?? []).filter((m) => {
            if (seen.has(m.concept_id)) return false
            seen.add(m.concept_id)
            return true
        })
    }, [masteryList])

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Add Study Goal
                    </DialogTitle>
                    <DialogDescription>
                        Set a goal to keep yourself on track and motivated.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Goal Type */}
                    <div className="space-y-1.5">
                        <Label htmlFor="goal-type">Goal Type</Label>
                        <Select
                            value={goalType}
                            onValueChange={(v) => {
                                setGoalType(v as GoalType)
                                setConceptId("")
                                setDocumentId("")
                                setQuizId("")
                                setTopicTargetType("concept")
                                setQuizTargetType("count")
                                if (v === "quiz_count") setTargetValue("10")
                                else setTargetValue("80")
                            }}
                        >
                            <SelectTrigger id="goal-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="overall_mastery">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-500" />
                                        Overall Mastery
                                    </div>
                                </SelectItem>
                                <SelectItem value="topic_mastery">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-yellow-500" />
                                        Topic Mastery
                                    </div>
                                </SelectItem>
                                <SelectItem value="quiz_count">
                                    <div className="flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-purple-500" />
                                        Quiz Completion
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {goalType === "overall_mastery" && "Track your average mastery across all topics."}
                            {goalType === "topic_mastery" && "Track mastery for a specific concept or document."}
                            {goalType === "quiz_count" && "Track completed quizzes or complete a specific quiz."}
                        </p>
                    </div>

                    {/* Topic Mastery Options */}
                    {goalType === "topic_mastery" && (
                        <div className="space-y-4 border-l-2 pl-4 border-muted">
                            <div className="space-y-1.5">
                                <Label>What do you want to master?</Label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={topicTargetType === "concept"} onChange={() => setTopicTargetType("concept")} /> Specific Topic
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={topicTargetType === "document"} onChange={() => setTopicTargetType("document")} /> Entire Document
                                    </label>
                                </div>
                            </div>

                            {topicTargetType === "concept" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="goal-concept">Select Topic</Label>
                                    <Select value={conceptId} onValueChange={setConceptId}>
                                        <SelectTrigger id="goal-concept">
                                            <SelectValue placeholder="Select a concept…" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-52">
                                            {conceptOptions.length === 0 ? (
                                                <SelectItem value="__none" disabled>
                                                    No concepts tracked yet
                                                </SelectItem>
                                            ) : (
                                                conceptOptions.map((c) => (
                                                    <SelectItem key={c.concept_id} value={c.concept_id}>
                                                        {c.concept_name}
                                                        {c.document_title ? ` · ${c.document_title}` : ""}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {topicTargetType === "document" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="goal-document">Select Document</Label>
                                    <Select value={documentId} onValueChange={setDocumentId}>
                                        <SelectTrigger id="goal-document">
                                            <SelectValue placeholder="Select a document…" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-52">
                                            {(!documents || documents.length === 0) ? (
                                                <SelectItem value="__none" disabled>
                                                    No documents available
                                                </SelectItem>
                                            ) : (
                                                documents.map((d) => (
                                                    <SelectItem key={d.id} value={d.id}>
                                                        {d.title}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quiz Completion Options */}
                    {goalType === "quiz_count" && (
                        <div className="space-y-4 border-l-2 pl-4 border-muted">
                            <div className="space-y-1.5">
                                <Label>Select Target Type</Label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={quizTargetType === "count"} onChange={() => setQuizTargetType("count")} /> Number of Quizzes
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={quizTargetType === "specific"} onChange={() => setQuizTargetType("specific")} /> Specific Quiz
                                    </label>
                                </div>
                            </div>

                            {quizTargetType === "specific" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="goal-quiz">Select Quiz</Label>
                                    <Select value={quizId} onValueChange={setQuizId}>
                                        <SelectTrigger id="goal-quiz">
                                            <SelectValue placeholder="Select a quiz…" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-52">
                                            {(!quizzes || quizzes.length === 0) ? (
                                                <SelectItem value="__none" disabled>
                                                    No active quizzes available
                                                </SelectItem>
                                            ) : (
                                                quizzes.map((q) => (
                                                    <SelectItem key={q.id} value={q.id}>
                                                        {q.title}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="goal-title">Goal Title</Label>
                        <Input
                            id="goal-title"
                            placeholder="e.g. Master Photosynthesis by finals"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Target */}
                    {!(goalType === "quiz_count" && quizTargetType === "specific") && (
                        <div className="space-y-1.5">
                            <Label htmlFor="goal-target">{getTargetLabel()}</Label>
                            <Input
                                id="goal-target"
                                type="number"
                                min={1}
                                max={goalType === "quiz_count" ? 10000 : 100}
                                placeholder={getTargetPlaceholder()}
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Deadline */}
                    <div className="space-y-1.5">
                        <Label htmlFor="goal-deadline" className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Deadline (optional)
                        </Label>
                        <Input
                            id="goal-deadline"
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={createGoal.isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={createGoal.isPending} className="gap-2">
                        {createGoal.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        Add Goal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function StudyGoalsPanel() {
    const { data: goals, isLoading, isError } = useStudyGoals()
    const { data: masteryList } = useConceptMasteryList()
    const { data: stats } = useLearningStats()
    const { data: attempts } = useUserAttempts()
    const [showAddDialog, setShowAddDialog] = useState(false)

    const activeGoals = (goals ?? []).filter((g) => !g.is_completed)
    const completedGoals = (goals ?? []).filter((g) => g.is_completed)

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Target className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Study Goals</h1>
                            <p className="text-sm sm:text-base text-muted-foreground">
                                Set milestones and track your learning progress
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)} className="gap-2 w-full sm:w-auto">
                        <Plus className="w-4 h-4" />
                        Add Goal
                    </Button>
                </div>

                {/* Stats Summary */}
                {(goals ?? []).length > 0 && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                        <Card>
                            <CardContent className="pt-5 pb-4 text-center">
                                <p className="text-2xl font-bold text-primary">{activeGoals.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Active</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-5 pb-4 text-center">
                                <p className="text-2xl font-bold text-green-600">{completedGoals.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Completed</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Loading */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Failed to load goals. Please refresh the page.
                        </CardContent>
                    </Card>
                ) : (goals ?? []).length === 0 ? (
                    /* Empty State */
                    <Card>
                        <CardContent className="py-16 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <Target className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Create your first study goal to stay motivated and track your progress toward learning milestones.
                            </p>
                            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Add Your First Goal
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Active Goals */}
                        {activeGoals.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Target className="w-4 h-4 text-primary" />
                                        Active Goals
                                        <Badge variant="outline" className="ml-auto">{activeGoals.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {activeGoals.map((goal) => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            masteryList={masteryList}
                                            stats={stats}
                                            attempts={attempts}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Completed Goals */}
                        {completedGoals.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-green-600" />
                                        Completed Goals
                                        <Badge variant="outline" className="ml-auto">{completedGoals.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {completedGoals.map((goal) => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            masteryList={masteryList}
                                            stats={stats}
                                            attempts={attempts}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            <AddGoalDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
        </main>
    )
}
