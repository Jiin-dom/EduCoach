import { useEffect, useMemo, useRef } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { LearningPathCalendar } from "@/components/learning-path/LearningPathCalendar"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"
import { LearningPathSelector } from "@/components/learning-path/LearningPathSelector"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDocuments } from "@/hooks/useDocuments"
import { useConceptMasteryList } from "@/hooks/useLearning"
import { useAdaptiveStudyTasks } from "@/hooks/useAdaptiveStudy"
import { useGenerateReviewQuiz, useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useAdaptiveQuizPolicies } from "@/hooks/useAdaptiveQuizPolicies"
import { useStudyGoals } from "@/hooks/useStudyGoals"
import { useAllFlashcards } from "@/hooks/useFlashcards"
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
import { localDateFromTimestamp, todayLocalDateString } from "@/lib/localDate"

type LearningPathScheduleItem = {
    id: string
    itemType: "quiz" | "flashcards" | "review"
    title: string
    documentTitle: string | null
    dueDate: string | null
    documentId: string
    href: string
    taskId?: string
    status?: string
    conceptIds?: string[]
    completedAt?: string
}

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
    const { data: allFlashcards = [] } = useAllFlashcards(scopeFilter?.documentId)

    const matchesAdaptiveTaskScope = useMemo(() => {
        return (task: { documentId: string; conceptIds: string[]; quizId?: string }) => {
            if (!scopeFilter) return true
            if (scopeFilter.quizId) return !!task.quizId && task.quizId === scopeFilter.quizId
            if (scopeFilter.documentId && task.documentId !== scopeFilter.documentId) return false
            if (scopeFilter.conceptId && !task.conceptIds.includes(scopeFilter.conceptId)) return false
            return true
        }
    }, [scopeFilter])

    const dueTodayQuizzes = useMemo(() => {
        const todayLocal = todayLocalDateString()
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
                        itemType: "quiz" as const,
                        title: task.title,
                        documentTitle: document?.title ?? null,
                        dueDate: task.scheduledDate,
                        documentId: quiz.document_id,
                        href: `/quizzes/${quiz.id}`,
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
                    itemType: "quiz" as const,
                    title: quiz.title,
                    documentTitle: document?.title ?? null,
                    dueDate,
                    documentId: quiz.document_id,
                    href: `/quizzes/${quiz.id}`,
                }
            })
            .filter((quiz) => quiz.dueDate === todayLocal)

        // 2. Add any adaptive quiz tasks for today, even if not yet ready or without a quizId
        const adaptiveQuizTasks = adaptiveTasks
            .filter((task) => task.type === "quiz" && task.scheduledDate === todayLocal)
            .filter((task) => matchesQuizScope({ id: task.quizId || task.id, document_id: task.documentId }, scopeFilter))
            .map((task) => ({
                id: task.quizId || task.id,
                itemType: "quiz" as const,
                title: task.title,
                documentTitle: task.documentTitle,
                dueDate: task.scheduledDate,
                // Add metadata to allow the UI to handle generation if needed
                taskId: task.id,
                status: task.status,
                documentId: task.documentId,
                conceptIds: task.conceptIds,
                href: task.quizId ? `/quizzes/${task.quizId}` : `/quizzes`,
            }))

        // 3. Add non-quiz adaptive tasks due today (flashcards and concept reviews)
        const dueTodayStudyTasks = adaptiveTasks
            .filter((task) => task.scheduledDate === todayLocal)
            .filter((task) => task.type === "flashcards" || task.type === "review")
            .filter((task) => matchesAdaptiveTaskScope({ documentId: task.documentId, conceptIds: task.conceptIds, quizId: task.quizId }))
            .map((task) => ({
                id: task.id,
                itemType: task.type,
                title: task.title,
                documentTitle: task.documentTitle,
                dueDate: task.scheduledDate,
                documentId: task.documentId,
                conceptIds: task.conceptIds,
                href: task.type === "flashcards"
                    ? `/files/${task.documentId}?tab=flashcards`
                    : `/files/${task.documentId}?tab=concepts${task.conceptIds[0] ? `&concept=${task.conceptIds[0]}` : ""}`,
            }))

        const combined = new Map<string, LearningPathScheduleItem>()
        allQuizzesForToday.forEach(q => combined.set(q.id, q))
        adaptiveQuizTasks.forEach(q => combined.set(q.id, q))
        dueTodayStudyTasks.forEach((task) => combined.set(task.id, task))

        return Array.from(combined.values())
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [documents, quizzes, adaptiveTasks, scopeFilter, matchesAdaptiveTaskScope])

    const completedTodayQuizzes = useMemo(() => {
        const todayLocal = todayLocalDateString()

        // Find all attempts completed today
        const completedToday = attempts.filter(a => {
            if (!a.completed_at) return false
            return localDateFromTimestamp(a.completed_at) === todayLocal
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
                itemType: "quiz" as const,
                title: quiz?.title ?? "Completed Quiz",
                documentTitle: doc?.title ?? null,
                dueDate: todayLocal,
                completedAt: a.completed_at,
                href: `/quizzes/${a.quiz_id}?review=true`,
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

    const completedTodayFlashcardsAndReviews = useMemo(() => {
        const todayLocal = todayLocalDateString()
        if (scopeFilter?.quizId) return []

        const results: Array<{
            id: string
            itemType: "flashcards" | "review"
            title: string
            documentTitle: string | null
            dueDate: string
            documentId: string
            href: string
        }> = []

        const reviewedFlashcards = allFlashcards.filter((card) => {
            if (!card.last_reviewed_at) return false
            if (localDateFromTimestamp(card.last_reviewed_at) !== todayLocal) return false
            if (scopeFilter?.documentId && card.document_id !== scopeFilter.documentId) return false
            return true
        })
        const flashcardCountsByDocument = new Map<string, number>()
        reviewedFlashcards.forEach((card) => {
            flashcardCountsByDocument.set(card.document_id, (flashcardCountsByDocument.get(card.document_id) || 0) + 1)
        })
        flashcardCountsByDocument.forEach((count, documentId) => {
            const doc = documents.find((d) => d.id === documentId)
            results.push({
                id: `flashcards:${documentId}`,
                itemType: "flashcards",
                title: `Flashcards reviewed (${count})`,
                documentTitle: doc?.title ?? null,
                dueDate: todayLocal,
                documentId,
                href: `/files/${documentId}?tab=flashcards`,
            })
        })

        const completedReviews = masteryRows.filter((row) => {
            if (!row.last_reviewed_at) return false
            if (localDateFromTimestamp(row.last_reviewed_at) !== todayLocal) return false
            if (!row.document_id) return false
            if (scopeFilter?.documentId && row.document_id !== scopeFilter.documentId) return false
            if (scopeFilter?.conceptId && row.concept_id !== scopeFilter.conceptId) return false
            return true
        })
        const reviewByDocument = new Map<string, { count: number; conceptId: string | null }>()
        completedReviews.forEach((row) => {
            const existing = reviewByDocument.get(row.document_id!)
            if (existing) {
                existing.count += 1
                return
            }
            reviewByDocument.set(row.document_id!, { count: 1, conceptId: row.concept_id ?? null })
        })
        reviewByDocument.forEach((entry, documentId) => {
            const doc = documents.find((d) => d.id === documentId)
            results.push({
                id: `review:${documentId}`,
                itemType: "review",
                title: `Concepts reviewed (${entry.count})`,
                documentTitle: doc?.title ?? null,
                dueDate: todayLocal,
                documentId,
                href: `/files/${documentId}?tab=concepts${entry.conceptId ? `&concept=${entry.conceptId}` : ""}`,
            })
        })

        return results
    }, [allFlashcards, documents, masteryRows, scopeFilter])

    const completedTodayItems = useMemo(
        () => [...completedTodayQuizzes, ...completedTodayFlashcardsAndReviews]
            .sort((a, b) => a.title.localeCompare(b.title)),
        [completedTodayFlashcardsAndReviews, completedTodayQuizzes],
    )

    const isSelectorView = !requestedScope
    const hasInvalidScope = isScopedRoute && !resolvedScope
    const autoGeneratedTaskIds = useRef<Set<string>>(new Set())
    const adaptiveQuizPolicy = useAdaptiveQuizPolicies({
        quizzes,
        attempts,
        adaptiveTasks,
    })

    useEffect(() => {
        const { todayLocal, completedAdaptiveDocumentIdsToday, hasReusableReadyQuizForDocument } = adaptiveQuizPolicy

        const nextQuizTask = adaptiveTasks
            .filter((task) => task.type === "quiz" && task.status === "needs_generation" && !!task.scheduledDate)
            .filter((task) => task.taskKey?.startsWith('manual:') || !hasReusableReadyQuizForDocument(task.documentId))
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
            .find((task) =>
                task.scheduledDate! <= todayLocal &&
                !completedAdaptiveDocumentIdsToday.has(task.documentId),
            )

        if (!nextQuizTask) return
        if (generateReview.isPending) return
        if (autoGeneratedTaskIds.current.has(nextQuizTask.id)) return

        autoGeneratedTaskIds.current.add(nextQuizTask.id)
        generateReview.mutate(
            {
                documentId: nextQuizTask.documentId,
                focusConceptIds: nextQuizTask.conceptIds,
                questionCount: Math.max(10, Math.min(20, nextQuizTask.conceptIds.length * 2)),
                forceNew: nextQuizTask.taskKey?.startsWith('manual:') === true,
                sourceTaskId: nextQuizTask.id,
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
    }, [adaptiveQuizPolicy, adaptiveTasks, generateReview])



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
                                </TabsList>
                            </div>
                        </div>

                        <TabsContent value="schedule" className="m-0 border-0 p-0 outline-none">
                            <div className="container mx-auto px-4 py-2">
                                <LearningPathCalendar
                                    scopeFilter={scopeFilter}
                                    dueTodayQuizzes={dueTodayQuizzes}
                                    completedTodayQuizzes={completedTodayItems}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                            <LearningPathContent
                                scopeFilter={scopeFilter}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}
