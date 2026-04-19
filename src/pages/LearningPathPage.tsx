import { useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import { LearningPathCalendar } from "@/components/learning-path/LearningPathCalendar"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"
import { LearningPathSelector } from "@/components/learning-path/LearningPathSelector"
import { StudyGoalsPanel } from "@/components/learning-path/StudyGoalsPanel"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
                    <Tabs defaultValue="schedule" className="w-full">
                        <div className="container mx-auto px-4 pt-6 pb-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {resolvedScope ? (
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="shrink-0 shadow-sm border-muted">
                                            {resolvedScope.kind === "document" ? "File Path" : "Study Goal"}
                                        </Badge>
                                        <h1 className="text-2xl font-bold truncate max-w-[300px] lg:max-w-[500px]" title={resolvedScope.title}>
                                            {resolvedScope.title}
                                        </h1>
                                        {resolvedScope.documentTitle && resolvedScope.kind === "study_goal" ? (
                                            <Badge variant="outline" className="hidden sm:inline-flex">{resolvedScope.documentTitle}</Badge>
                                        ) : null}
                                    </div>
                                ) : (
                                    <h1 className="text-2xl font-bold truncate tracking-tight">My Learning Path</h1>
                                )}
                                
                                <TabsList className="bg-muted/80 w-full md:w-auto h-auto p-1 justify-start overflow-x-auto hide-scrollbar shadow-sm">
                                    <TabsTrigger value="schedule" className="py-2 px-4 rounded-md">Schedule View</TabsTrigger>
                                    <TabsTrigger value="mastery" className="py-2 px-4 rounded-md">Topics & Mastery</TabsTrigger>
                                    {isCombinedView ? <TabsTrigger value="planning" className="py-2 px-4 rounded-md">Goals & Planning</TabsTrigger> : null}
                                </TabsList>
                            </div>
                        </div>

                        <TabsContent value="schedule" className="m-0 border-0 p-0 outline-none">
                            <div className="container mx-auto px-4 py-2">
                                <LearningPathCalendar
                                    scopeFilter={scopeFilter}
                                    dueTodayQuizzes={dueTodayQuizzes}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                            <LearningPathContent
                                scopeFilter={scopeFilter}
                                dueTodayQuizzes={dueTodayQuizzes}
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
