import { useMemo } from "react"
import { ArrowRight, BookOpen, Calendar, FileText, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
                {/* Header section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Learning Path</h1>
                        <p className="text-sm text-muted-foreground">
                            Select a document or goal to focus your study plan.
                        </p>
                    </div>
                    <Button asChild className="gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95" size="sm">
                        <Link to="/learning-path?scope=all">
                            Start Combined Plan
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </Button>
                </div>

                <section className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 px-1">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">Files</h2>
                    </div>
                    {fileCards.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                Upload a file to start building file-based learning paths.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {fileCards.map(({ document, estimate, linkedGoalsCount, progress, targetDate }) => (
                                <Card key={document.id} className="overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-muted/60 hover:border-blue-500/30 flex flex-col">
                                    <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500 w-0 group-hover:w-full transition-all duration-500" />
                                    <CardHeader className="p-4 pb-2 space-y-0 relative text-left">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl shadow-sm ring-1 ring-blue-100/50 group-hover:scale-110 transition-transform duration-300">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">{formatStatusLabel(document.status)}</Badge>
                                        </div>
                                        <CardTitle className="line-clamp-2 text-lg font-bold leading-tight">{document.title}</CardTitle>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2.5">
                                            {targetDate && <span className="font-medium text-foreground/80 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(targetDate)}</span>}
                                            {linkedGoalsCount > 0 && <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {linkedGoalsCount} goal{linkedGoalsCount !== 1 && 's'}</span>}
                                            {cleanLabel(document.goal_label) && <span className="truncate max-w-[120px] bg-muted px-1.5 py-0.5 rounded text-[10px]">{cleanLabel(document.goal_label)}</span>}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2 mt-auto text-left">
                                        <div className="bg-muted/30 rounded-lg p-3 space-y-2.5 mb-4">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-muted-foreground">Prep Estimate</span>
                                                <Badge variant="outline" className="text-[10px] bg-background shadow-sm">{estimate.label}</Badge>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span>Mastered</span>
                                                    <span className="text-primary">{progress.mastered} / {Math.max(progress.total, document.concept_count || 0)}</span>
                                                </div>
                                                <Progress value={progress.average || 2} className="h-1.5" />
                                            </div>
                                        </div>
                                        <Button asChild variant="outline" className="w-full gap-2 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors border-muted-foreground/20">
                                            <Link to={`/learning-path?scope=document&id=${document.id}`}>
                                                Open Path
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 px-1">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                            <Target className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">Study Goals</h2>
                    </div>
                    {goalCards.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No active study goals yet. Add one in Goals & Planning to get a goal-based path.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {goalCards.map(({ goal, document, progressViewModel }) => (
                                <Card key={goal.id} className="overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-muted/60 hover:border-amber-500/30 flex flex-col">
                                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 w-0 group-hover:w-full transition-all duration-500" />
                                    <CardHeader className="p-4 pb-2 space-y-0 relative text-left">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl shadow-sm ring-1 ring-amber-100/50 group-hover:scale-110 transition-transform duration-300">
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-amber-100/50 text-amber-700 hover:bg-amber-100/80">{formatStudyGoalType(goal.goal_type)}</Badge>
                                        </div>
                                        <CardTitle className="line-clamp-2 text-lg font-bold leading-tight">{goal.title}</CardTitle>
                                        <div className="flex flex-col space-y-1 text-xs text-muted-foreground mt-2.5">
                                            <span className="line-clamp-1 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {document?.title ?? "Global Path"}</span>
                                            <span className="font-medium text-foreground/80 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {goal.deadline ? `Due ${formatDate(goal.deadline)}` : "Flexible timing"}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2 mt-auto text-left">
                                        <div className="bg-orange-50/50 rounded-lg p-3 space-y-2.5 mb-4 border border-orange-100/50">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-amber-900/60">Target</span>
                                                <span className="font-bold text-amber-700">{progressViewModel.targetSummary}</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-amber-900/60">Current Progress</span>
                                                    <span className="text-amber-600">{progressViewModel.percentComplete}%</span>
                                                </div>
                                                {/* Use default blue progress to avoid style bleeding issues, but wrap in opacity. */}
                                                <Progress value={progressViewModel.percentComplete || 2} className="h-1.5" />
                                            </div>
                                        </div>
                                        <Button asChild variant="outline" className="w-full gap-2 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-colors border-muted-foreground/20 text-amber-700">
                                            <Link to={`/learning-path?scope=study_goal&id=${goal.id}`}>
                                                Open Goal Path
                                                <ArrowRight className="w-3.5 h-3.5" />
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
