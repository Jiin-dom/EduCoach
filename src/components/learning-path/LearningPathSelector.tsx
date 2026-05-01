import { useMemo } from "react"
import { ArrowRight, Calendar, Clock3, FileText, Sparkles, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Document } from "@/hooks/useDocuments"
import type { ConceptMasteryWithDetails } from "@/hooks/useLearning"
import type { Attempt, Quiz } from "@/hooks/useQuizzes"
import { filterStudyGoalsForDocument } from "@/lib/documentGoalAnalytics"
import { computeDocumentEstimate } from "@/lib/readinessEstimate"
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

function estimateBadgeClass(label: string) {
    if (label === "Strong") return "bg-emerald-100 text-emerald-700 border-emerald-200"
    if (label === "Moderate") return "bg-amber-100 text-amber-700 border-amber-200"
    if (label === "Limited") return "bg-rose-100 text-rose-700 border-rose-200"
    return "bg-muted text-muted-foreground border-border"
}

export function LearningPathSelector({
    documents,
    studyGoals,
    masteryRows,
    quizzes,
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

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-8">
                {/* Header section */}
                <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-7 shadow-sm">
                    <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
                    <div className="pointer-events-none absolute -left-12 -bottom-16 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Study Planner
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Learning Path</h1>
                            <p className="text-sm text-muted-foreground max-w-xl">
                            Select a document or goal to focus your study plan.
                            </p>
                        </div>
                        <Button asChild className="gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95" size="sm">
                            <Link to="/learning-path?scope=all">
                                View Combined Path
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <section className="space-y-3">
                    {/* <div className="flex items-center gap-2 px-1">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">Files</h2>
                    </div> */}
                    {fileCards.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                Upload a file to start building file-based learning paths.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {fileCards.map(({ document, estimate, linkedGoalsCount, progress, targetDate }) => (
                                <Card key={document.id} className="overflow-hidden group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border-primary/20 hover:border-primary/50 flex flex-col bg-gradient-to-br from-card via-card to-primary/[0.04]">
                                    <div className="h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-fuchsia-500 w-full opacity-95" />
                                    <CardHeader className="p-5 pb-2 space-y-0 relative text-left">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="bg-gradient-to-br from-primary/20 to-indigo-500/20 text-primary p-2.5 rounded-xl shadow-sm ring-1 ring-primary/25 group-hover:scale-110 transition-transform duration-300">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20 shadow-sm">
                                                {formatStatusLabel(document.status)}
                                            </Badge>
                                        </div>
                                        <CardTitle className="line-clamp-2 text-lg font-bold leading-tight mb-1">{document.title}</CardTitle>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2.5">
                                            {targetDate && (
                                                <span className="font-medium text-foreground/80 flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                                                    <Calendar className="w-3.5 h-3.5" /> {formatDate(targetDate)}
                                                </span>
                                            )}
                                            {linkedGoalsCount > 0 && (
                                                <span className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                                                    <Target className="w-3.5 h-3.5" /> {linkedGoalsCount} goal{linkedGoalsCount !== 1 && 's'}
                                                </span>
                                            )}
                                            {cleanLabel(document.goal_label) && (
                                                <span className="truncate max-w-[140px] bg-muted/60 px-2 py-1 rounded-md text-[10px] border border-border/50">
                                                    {cleanLabel(document.goal_label)}
                                                </span>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-2 mt-auto text-left">
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Coverage</p>
                                                <p className="text-sm font-bold text-foreground">{Math.round((estimate.coverage || 0) * 100)}%</p>
                                            </div>
                                            <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Performance</p>
                                                <p className="text-sm font-bold text-foreground">{Math.round(estimate.performance || 0)}%</p>
                                            </div>
                                        </div>
                                        <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 mb-4 border border-border/50">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-muted-foreground">Prep Estimate</span>
                                                <Badge variant="outline" className={`text-[10px] shadow-sm ${estimateBadgeClass(estimate.label)}`}>{estimate.label}</Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Clock3 className="w-3.5 h-3.5" />
                                                Recommended pacing based on your current mastery
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span>Mastered</span>
                                                    <span className="text-primary">{progress.mastered} / {Math.max(progress.total, document.concept_count || 0)}</span>
                                                </div>
                                                <Progress value={progress.average || 2} className="h-2" />
                                            </div>
                                        </div>
                                        <Button asChild className="w-full gap-2 bg-gradient-to-r from-primary to-indigo-600 text-white border-0 hover:from-primary/90 hover:to-indigo-600/90 shadow-sm">
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

            </div>
        </main>
    )
}
