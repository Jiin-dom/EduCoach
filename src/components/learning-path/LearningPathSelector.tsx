import { useMemo } from "react"
import { ArrowRight, BookOpen, Calendar, FileText, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Document } from "@/hooks/useDocuments"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import type { Attempt, Quiz } from "@/hooks/useQuizzes"
import { buildGoalProgressViewModel, filterStudyGoalsForDocument } from "@/lib/documentGoalAnalytics"
import { computeDocumentEstimate } from "@/lib/readinessEstimate"
import { formatStudyGoalType, resolveLearningPathScope } from "@/lib/learningPathScope"
import type { StudyGoal } from "@/types/studyGoals"

interface LearningPathSelectorProps {
    documents: Document[]
    studyGoals: StudyGoal[]
    masteryRows: ConceptMasteryWithDetails[]
    quizzes: Quiz[]
    attempts: Attempt[]
}

function cleanLabel(value: string | null | undefined) {
    const cleaned = value?.replace(/^Goal Name:\s*/i, "").trim()
    return cleaned ? cleaned : null
}

function formatDate(value: string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

function formatStatusLabel(status: Document["status"]) {
    switch (status) {
        case "ready":
            return "Ready"
        case "processing":
            return "Processing"
        case "pending":
            return "Pending"
        case "error":
            return "Needs Attention"
        default:
            return status
    }
}

function sortByTargetThenTitle(a: { targetDate: string | null; title: string }, b: { targetDate: string | null; title: string }) {
    if (a.targetDate && b.targetDate) {
        const delta = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
        if (delta !== 0) return delta
    }
    if (a.targetDate) return -1
    if (b.targetDate) return 1
    return a.title.localeCompare(b.title)
}

export function LearningPathSelector({
    documents,
    studyGoals,
    masteryRows,
    quizzes,
    attempts,
}: LearningPathSelectorProps) {
    const quizzesById = useMemo(() => new Map(quizzes.map((quiz) => [quiz.id, quiz])), [quizzes])

    const documentProgress = useMemo(() => {
        const map = new Map<string, { total: number; mastered: number; average: number }>()

        for (const row of masteryRows) {
            if (!row.document_id || row.total_attempts <= 0) continue

            const current = map.get(row.document_id) ?? { total: 0, mastered: 0, average: 0 }
            current.total += 1
            current.mastered += row.display_mastery_level === "mastered" ? 1 : 0
            current.average += row.display_mastery_score
            map.set(row.document_id, current)
        }

        for (const entry of map.values()) {
            entry.average = entry.total > 0 ? Math.round(entry.average / entry.total) : 0
        }

        return map
    }, [masteryRows])

    const fileCards = useMemo(() => {
        return documents
            .map((document) => {
                const progress = documentProgress.get(document.id) ?? { total: 0, mastered: 0, average: 0 }
                const masteryForDocument = masteryRows.filter((row) => row.document_id === document.id)
                const linkedGoals = filterStudyGoalsForDocument(studyGoals, document.id, quizzesById, masteryForDocument)
                const estimate = computeDocumentEstimate(
                    document.concept_count || progress.total,
                    progress.total,
                    progress.average,
                    Boolean(document.exam_date || document.deadline || document.goal_label || linkedGoals.length),
                )
                const targetDate = document.exam_date ?? document.deadline ?? null

                return {
                    document,
                    progress,
                    linkedGoalsCount: linkedGoals.length,
                    estimate,
                    targetDate,
                }
            })
            .sort((a, b) =>
                sortByTargetThenTitle(
                    { targetDate: a.targetDate, title: a.document.title },
                    { targetDate: b.targetDate, title: b.document.title },
                ),
            )
    }, [documentProgress, documents, masteryRows, quizzesById, studyGoals])

    const goalCards = useMemo(() => {
        return studyGoals
            .filter((goal) => !goal.is_completed)
            .map((goal) => {
                const resolvedScope = resolveLearningPathScope({
                    scope: { kind: "study_goal", id: goal.id },
                    documents,
                    studyGoals,
                    quizzes,
                    masteryRows,
                })

                if (!resolvedScope) return null

                const document = resolvedScope.documentId
                    ? documents.find((item) => item.id === resolvedScope.documentId) ?? null
                    : null
                const masteryForContext = resolvedScope.documentId
                    ? masteryRows.filter((row) => row.document_id === resolvedScope.documentId)
                    : masteryRows
                const progressViewModel = buildGoalProgressViewModel(goal, [goal], masteryForContext, attempts)

                return {
                    goal,
                    document,
                    resolvedScope,
                    progressViewModel,
                }
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .sort((a, b) =>
                sortByTargetThenTitle(
                    { targetDate: a.goal.deadline, title: a.goal.title },
                    { targetDate: b.goal.deadline, title: b.goal.title },
                ),
            )
    }, [attempts, documents, masteryRows, quizzes, studyGoals])

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-8">
                <Card className="border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background">
                    <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                            <Badge variant="secondary" className="w-fit">Learning Path</Badge>
                            <CardTitle className="text-2xl sm:text-3xl">Choose a file or study goal</CardTitle>
                            <CardDescription className="max-w-2xl text-sm sm:text-base">
                                Start from a specific document or goal, then view the schedule and mastery plan scoped to that target.
                            </CardDescription>
                        </div>
                        <Button asChild variant="outline" className="gap-2">
                            <Link to="/learning-path?scope=all">
                                Open Combined Plan
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                </Card>

                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">Files</h2>
                    </div>
                    {fileCards.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                Upload a file to start building file-based learning paths.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {fileCards.map(({ document, estimate, linkedGoalsCount, progress, targetDate }) => (
                                <Card key={document.id} className="overflow-hidden">
                                    <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-blue-500" />
                                    <CardHeader className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <Badge variant="outline">{formatStatusLabel(document.status)}</Badge>
                                                <CardTitle className="line-clamp-2 text-lg">{document.title}</CardTitle>
                                            </div>
                                            <div className="rounded-xl bg-primary/10 p-2 text-primary">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-sm text-muted-foreground">
                                            {cleanLabel(document.goal_label) ? (
                                                <p className="line-clamp-1">{cleanLabel(document.goal_label)}</p>
                                            ) : null}
                                            <p>
                                                {targetDate
                                                    ? `Target ${formatDate(targetDate)}`
                                                    : "No date target yet"}
                                            </p>
                                            <p>
                                                {linkedGoalsCount > 0
                                                    ? `${linkedGoalsCount} linked study goal${linkedGoalsCount === 1 ? "" : "s"}`
                                                    : "No linked study goals"}
                                            </p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Preparation Estimate</span>
                                                <span className="font-medium">{estimate.label}</span>
                                            </div>
                                            <Progress value={progress.average} className="h-2" />
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Mastered concepts</span>
                                            <span className="font-medium">
                                                {progress.mastered}/{Math.max(progress.total, document.concept_count || 0)}
                                            </span>
                                        </div>
                                        <Button asChild className="w-full gap-2">
                                            <Link to={`/learning-path?scope=document&id=${document.id}`}>
                                                Open Learning Path
                                                <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">Study Goals</h2>
                    </div>
                    {goalCards.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No active study goals yet. Add one in Goals & Planning to get a goal-based path.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {goalCards.map(({ goal, document, progressViewModel }) => (
                                <Card key={goal.id} className="overflow-hidden">
                                    <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                                    <CardHeader className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <Badge variant="outline">{formatStudyGoalType(goal.goal_type)}</Badge>
                                                <CardTitle className="line-clamp-2 text-lg">{goal.title}</CardTitle>
                                            </div>
                                            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-sm text-muted-foreground">
                                            <p className="line-clamp-1">{document?.title ?? "Applies across your learning path"}</p>
                                            <p>{goal.deadline ? `Due ${formatDate(goal.deadline)}` : "No deadline set"}</p>
                                            <p>{progressViewModel.currentSummary}</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Target</span>
                                                <span className="font-medium">{progressViewModel.targetSummary}</span>
                                            </div>
                                            <Progress value={progressViewModel.percentComplete} className="h-2" />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="w-4 h-4" />
                                            <span>{progressViewModel.deadlineLabel ?? "Flexible timing"}</span>
                                        </div>
                                        <Button asChild className="w-full gap-2">
                                            <Link to={`/learning-path?scope=study_goal&id=${goal.id}`}>
                                                Open Goal Path
                                                <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
