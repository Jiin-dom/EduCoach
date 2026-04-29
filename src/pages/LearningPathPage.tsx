import { useEffect, useMemo, useRef } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

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
import { useAdaptiveStudyTasks } from "@/hooks/useAdaptiveStudy"
import { useGenerateReviewQuiz, useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useStudyGoals } from "@/hooks/useStudyGoals"
import {
    getLearningPathScopeFilter,
    matchesQuizScope,
    resolveLearningPathScope,
} from "@/lib/learningPathScope"
import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "@/lib/quizDeadlines"

export default function LearningPathPage() {
    const [searchParams] = useSearchParams()
    const requestedScope = searchParams.get("scope")
    const requestedId = searchParams.get("id")

    const { data: quizzes = [] } = useQuizzes()
    const { data: adaptiveTasks = [] } = useAdaptiveStudyTasks()
    const generateReview = useGenerateReviewQuiz()
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
        const latestQuizIdByDocument = buildLatestQuizIdByDocument(quizzes)
        const documentsWithExplicitQuizDeadlines = buildDocumentsWithExplicitQuizDeadlines(quizzes)

        // 1. Get all quizzes that could be due today
        const allQuizzesForToday = quizzes
            .filter((quiz) => quiz.status === "ready")
            .filter((quiz) => matchesQuizScope(quiz, scopeFilter))
            .map((quiz) => {
                const document = docsById.get(quiz.document_id)
                const task = adaptiveTasks.find(t => t.quizId === quiz.id)
                
                // Priority 1: Use the adaptive task's scheduled date if it exists
                if (task) {
                    return {
                        id: quiz.id,
                        title: task.title,
                        documentTitle: document?.title ?? null,
                        dueDate: task.scheduledDate,
                    }
                }

                // Priority 2: Use the effective quiz deadline
                const dueDate = getEffectiveQuizDeadline({
                    quiz,
                    latestQuizIdByDocument,
                    documentDeadline: document?.deadline ?? null,
                    documentsWithExplicitQuizDeadlines,
                })?.split("T")[0] ?? null
                
                return {
                    id: quiz.id,
                    title: quiz.title,
                    documentTitle: document?.title ?? null,
                    dueDate,
                }
            })
            .filter((quiz) => quiz.dueDate === todayLocal)

        // 2. Add any adaptive quiz tasks that might not have been in the quizzes list yet
        const adaptiveQuizTasks = adaptiveTasks
            .filter((task) => task.type === "quiz" && task.status === "ready" && task.quizId)
            .filter((task) => matchesQuizScope({ id: task.quizId!, document_id: task.documentId }, scopeFilter))
            .filter((task) => task.scheduledDate === todayLocal)
            .filter((task) => matchesQuizScope({ id: task.quizId!, document_id: task.documentId }, scopeFilter))
            .map((task) => ({
                id: task.quizId!,
                title: task.title,
                documentTitle: task.documentTitle,
                dueDate: task.scheduledDate,
            }))

        const combined = new Map<string, typeof allQuizzesForToday[0]>()
        allQuizzesForToday.forEach(q => combined.set(q.id, q))
        adaptiveQuizTasks.forEach(q => combined.set(q.id, q))

        return Array.from(combined.values())
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [documents, quizzes, adaptiveTasks, scopeFilter])

    const completedTodayQuizzes = useMemo(() => {
        const today = new Date()
        const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        
        // Find all attempts completed today
        const completedToday = attempts.filter(a => {
            if (!a.completed_at) return false
            return a.completed_at.split('T')[0] === todayLocal
        })

        // Map them to the QuizItem structure
        const results = completedToday.map(a => {
            const quiz = quizzes.find(q => q.id === a.quiz_id)
            
            // If we are in a scoped view (e.g. looking at a specific file), 
            // we must be able to verify the quiz belongs to that scope.
            if (scopeFilter && !quiz) return null

            // Only include quizzes that match the current scope (e.g., specific file)
            if (quiz && !matchesQuizScope(quiz, scopeFilter)) return null

            const doc = documents.find(d => d.id === quiz?.document_id)
            return {
                id: a.quiz_id,
                title: quiz?.title ?? "Completed Quiz",
                documentTitle: doc?.title ?? null,
                dueDate: todayLocal,
                completedAt: a.completed_at
            }
        }).filter((q): q is NonNullable<typeof q> => q !== null)

        // Remove duplicates if the user took the same quiz twice today
        const seen = new Set<string>()
        return results.filter(q => {
            if (seen.has(q.id)) return false
            seen.add(q.id)
            return true
        })
    }, [attempts, quizzes, documents, scopeFilter])

    const isSelectorView = !requestedScope
    const hasInvalidScope = isScopedRoute && !resolvedScope
    const autoGeneratedTaskIds = useRef<Set<string>>(new Set())

    useEffect(() => {
        const nextQuizTask = adaptiveTasks.find((task) =>
            task.type === "quiz" && task.status === "needs_generation",
        )

        if (!nextQuizTask) return
        if (generateReview.isPending) return
        if (autoGeneratedTaskIds.current.has(nextQuizTask.id)) return

        autoGeneratedTaskIds.current.add(nextQuizTask.id)
        generateReview.mutate(
            {
                documentId: nextQuizTask.documentId,
                focusConceptIds: nextQuizTask.conceptIds,
                questionCount: Math.max(5, Math.min(12, nextQuizTask.conceptIds.length * 2)),
            },
            {
                onSuccess: () => {
                    toast.success("A new adaptive review quiz has been generated for your study plan.")
                },
                onError: (err) => {
                    autoGeneratedTaskIds.current.delete(nextQuizTask.id)
                    toast.error("Adaptive quiz generation failed: " + (err as Error).message)
                },
            },
        )
    }, [adaptiveTasks, generateReview])



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
                                    completedTodayQuizzes={completedTodayQuizzes}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                            <LearningPathContent
                                scopeFilter={scopeFilter}
                                dueTodayQuizzes={dueTodayQuizzes}
                                completedTodayQuizzes={completedTodayQuizzes}
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
