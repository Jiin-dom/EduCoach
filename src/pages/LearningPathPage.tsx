import { useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, ArrowUpRight, Target } from "lucide-react"

import { LearningPathCalendar } from "@/components/learning-path/LearningPathCalendar"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"
import { LearningPathSelector } from "@/components/learning-path/LearningPathSelector"
import { StudyGoalsPanel } from "@/components/learning-path/StudyGoalsPanel"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDocuments } from "@/hooks/useDocuments"
import { useConceptMasteryList } from "@/hooks/useLearning"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useStudyGoals } from "@/hooks/useStudyGoals"
import {
    getLearningPathScopeFilter,
    matchesQuizScope,
    resolveLearningPathScope,
} from "@/lib/learningPathScope"

export default function LearningPathPage() {
    const [searchParams] = useSearchParams()
    const requestedScope = searchParams.get("scope")
    const requestedId = searchParams.get("id")

    const { data: quizzes = [] } = useQuizzes()
    const { data: attempts = [] } = useUserAttempts()
    const { data: documents = [] } = useDocuments()
    const { data: studyGoals = [] } = useStudyGoals()
    const { data: masteryRows = [] } = useConceptMasteryList()

    const isCombinedView = requestedScope === "all"
    const isScopedRoute = requestedScope === "document" || requestedScope === "study_goal"

    const resolvedScope = useMemo(() => {
        if (!isScopedRoute || !requestedId) return null

        return resolveLearningPathScope({
            scope: requestedScope === "document"
                ? { kind: "document", id: requestedId }
                : { kind: "study_goal", id: requestedId },
            documents,
            studyGoals,
            quizzes,
            masteryRows,
        })
    }, [documents, isScopedRoute, masteryRows, quizzes, requestedId, requestedScope, studyGoals])

    const scopeFilter = useMemo(() => getLearningPathScopeFilter(resolvedScope), [resolvedScope])

    const dueTodayQuizzes = useMemo(() => {
        const today = new Date()
        const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        const docsById = new Map(documents.map((document) => [document.id, document]))

        return quizzes
            .filter((quiz) => quiz.status === "ready")
            .filter((quiz) => matchesQuizScope(quiz, scopeFilter))
            .map((quiz) => {
                const document = docsById.get(quiz.document_id)
                const dueDate = document?.deadline?.split("T")[0] ?? null
                return {
                    id: quiz.id,
                    title: quiz.title,
                    documentTitle: document?.title ?? null,
                    dueDate,
                }
            })
            .filter((quiz) => quiz.dueDate === todayLocal)
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [documents, quizzes, scopeFilter])

    const isSelectorView = !requestedScope
    const hasInvalidScope = isScopedRoute && !resolvedScope

    const scheduleTitle = resolvedScope ? resolvedScope.title : "My Learning Path"
    const scheduleDescription = resolvedScope
        ? resolvedScope.subtitle
        : "View your adaptive study schedule based on your preferred time."
    const masteryTitle = resolvedScope ? resolvedScope.title : "Learning Path"
    const masteryDescription = resolvedScope
        ? `Scoped schedule, adaptive tasks, and mastery priorities for ${resolvedScope.title}.`
        : "Your generated study plan, adaptive tasks, and live mastery priorities"

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />

            {isSelectorView ? (
                <LearningPathSelector
                    documents={documents}
                    studyGoals={studyGoals}
                    masteryRows={masteryRows}
                    quizzes={quizzes}
                    attempts={attempts}
                />
            ) : hasInvalidScope ? (
                <main className="container mx-auto px-4 py-8">
                    <Card>
                        <CardContent className="py-12 text-center">
                            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
                            <h1 className="mb-2 text-xl font-semibold">Learning path target not found</h1>
                            <p className="mb-6 text-sm text-muted-foreground">
                                The selected file or study goal is no longer available.
                            </p>
                            <Button asChild variant="outline">
                                <Link to="/learning-path">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Selector
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            ) : (
                <>
                    {resolvedScope ? (
                        <div className="container mx-auto px-4 pt-6">
                            <Card className="border-primary/15 bg-gradient-to-r from-primary/10 via-background to-background">
                                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary">
                                                {resolvedScope.kind === "document" ? "File Path" : "Study Goal Path"}
                                            </Badge>
                                            {resolvedScope.documentTitle && resolvedScope.kind === "study_goal" ? (
                                                <Badge variant="outline">{resolvedScope.documentTitle}</Badge>
                                            ) : null}
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold">{resolvedScope.title}</h1>
                                            <p className="text-sm text-muted-foreground">{resolvedScope.subtitle}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button asChild variant="outline">
                                            <Link to="/learning-path">
                                                <ArrowLeft className="mr-2 h-4 w-4" />
                                                Change Target
                                            </Link>
                                        </Button>
                                        <Button asChild variant="ghost">
                                            <Link to="/learning-path?scope=all">
                                                <Target className="mr-2 h-4 w-4" />
                                                Combined Plan
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}

                    <Tabs defaultValue="schedule" className="w-full">
                        <div className="container mx-auto px-4 pt-6 pb-2">
                            <TabsList className="bg-muted">
                                <TabsTrigger value="schedule">Schedule View</TabsTrigger>
                                <TabsTrigger value="mastery">Topics & Mastery</TabsTrigger>
                                {isCombinedView ? <TabsTrigger value="planning">Goals & Planning</TabsTrigger> : null}
                            </TabsList>
                        </div>

                        <TabsContent value="schedule" className="m-0 border-0 p-0 outline-none">
                            <div className="container mx-auto px-4 py-2">
                                <Card className="mb-4">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Target className="w-4 h-4 text-red-500" />
                                            Due Today Quizzes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {dueTodayQuizzes.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No quizzes due today.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {dueTodayQuizzes.map((quiz) => (
                                                    <Link
                                                        key={quiz.id}
                                                        to={`/quizzes/${quiz.id}`}
                                                        className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">{quiz.title}</p>
                                                            {quiz.documentTitle ? (
                                                                <p className="truncate text-xs text-muted-foreground">{quiz.documentTitle}</p>
                                                            ) : null}
                                                        </div>
                                                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                <LearningPathCalendar
                                    scopeFilter={scopeFilter}
                                    title={scheduleTitle}
                                    description={scheduleDescription}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                            <LearningPathContent
                                scopeFilter={scopeFilter}
                                title={masteryTitle}
                                description={masteryDescription}
                            />
                        </TabsContent>

                        {isCombinedView ? (
                            <TabsContent value="planning" className="m-0 border-0 p-0 outline-none">
                                <StudyGoalsPanel />
                            </TabsContent>
                        ) : null}
                    </Tabs>
                </>
            )}
        </div>
    )
}
