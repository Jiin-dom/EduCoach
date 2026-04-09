import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Loader2, AlertCircle, RefreshCw, FileText } from "lucide-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { SelectDocumentDialog } from "./SelectDocumentDialog"
import { GenerateQuizDialog } from "@/components/files/GenerateQuizDialog"

export function QuizzesContent() {
    const { data: quizzes, isLoading, error, refetch } = useQuizzes()
    const { data: attempts } = useUserAttempts()
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedTab = searchParams.get('tab')
    const requestedDocumentId = searchParams.get('documentId')
    const [activeTab, setActiveTab] = useState<'available' | 'completed'>(
        requestedTab === 'completed' ? 'completed' : 'available',
    )
    const state = location.state as { highlightQuizId?: string } | null
    const routeHighlightQuizId = state?.highlightQuizId ?? null
    const persistedHighlightRef = useRef<string | null>(routeHighlightQuizId)
    if (routeHighlightQuizId && !persistedHighlightRef.current) {
        persistedHighlightRef.current = routeHighlightQuizId
    }
    const highlightQuizId = persistedHighlightRef.current

    // Dialog state
    const [isSelectDocOpen, setIsSelectDocOpen] = useState(false)
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
    const [isGenerateQuizOpen, setIsGenerateQuizOpen] = useState(false)

    useEffect(() => {
        if (routeHighlightQuizId) {
            // Clear state so refreshes / tab switches don't keep re-highlighting
            navigate(location.pathname, { replace: true })
        }
    }, [routeHighlightQuizId, navigate, location.pathname])

    useEffect(() => {
        setActiveTab(requestedTab === 'completed' ? 'completed' : 'available')
    }, [requestedTab])

    useEffect(() => {
        if (requestedTab !== 'flashcards' && !requestedDocumentId) {
            return
        }

        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('documentId')
        if (requestedTab === 'flashcards') {
            nextParams.set('tab', 'available')
        }
        setSearchParams(nextParams, { replace: true })
    }, [requestedDocumentId, requestedTab, searchParams, setSearchParams])

    const handleSelectDocument = (id: string) => {
        setSelectedDocId(id)
        setIsSelectDocOpen(false)
        // Small delay to allow SelectDocumentDialog to close smoothly before opening GenerateQuizDialog
        setTimeout(() => {
            setIsGenerateQuizOpen(true)
        }, 300)
    }

    const lastScoreByQuiz = useMemo(() => {
        const map = new Map<string, number>()
        if (!attempts) return map
        for (const a of attempts) {
            if (a.completed_at && a.score !== null && !map.has(a.quiz_id)) {
                map.set(a.quiz_id, a.score)
            }
        }
        return map
    }, [attempts])

    const completedQuizIds = useMemo(() => {
        return new Set(lastScoreByQuiz.keys())
    }, [lastScoreByQuiz])

    const availableQuizzes = useMemo(() => {
        return (quizzes || []).filter(
            (q) => (q.status === 'ready' || q.status === 'generating') && !completedQuizIds.has(q.id)
        )
    }, [quizzes, completedQuizIds])

    const completedQuizzes = useMemo(() => {
        return (quizzes || []).filter(
            (q) => q.status === 'ready' && completedQuizIds.has(q.id)
        )
    }, [quizzes, completedQuizIds])

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">My Quizzes</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Track your progress and test your knowledge</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-muted-foreground">Loading quizzes...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">My Quizzes</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Track your progress and test your knowledge</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-4 text-destructive">
                            <AlertCircle className="w-8 h-8" />
                            <p>Failed to load quizzes</p>
                            <Button variant="outline" onClick={() => refetch()} className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const totalQuizzes = (quizzes || []).length

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">My Quizzes</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Track your progress and test your knowledge</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button 
                        className="w-full sm:w-auto gap-2"
                        onClick={() => setIsSelectDocOpen(true)}
                    >
                        <FileText className="w-4 h-4" />
                        Generate from Document
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => {
                const nextTab = value as 'available' | 'completed'
                setActiveTab(nextTab)

                const nextParams = new URLSearchParams(searchParams)
                nextParams.set('tab', nextTab)
                nextParams.delete('documentId')
                setSearchParams(nextParams, { replace: true })
            }} className="w-full">
                <TabsList className="grid w-full max-w-sm grid-cols-2">
                    <TabsTrigger value="available">Available ({availableQuizzes.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedQuizzes.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="available" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Quizzes</CardTitle>
                            <CardDescription>Start a new quiz to test your knowledge</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {availableQuizzes.length === 0 ? (
                                <div className="text-center py-12">
                                    <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">
                                        {totalQuizzes === 0 ? "No quizzes yet" : "All quizzes completed!"}
                                    </h3>
                                    <p className="text-muted-foreground mb-4">
                                        {totalQuizzes === 0
                                            ? "Upload a document and generate a quiz to get started"
                                            : "Great job! Generate more quizzes from your documents."
                                        }
                                    </p>
                                    <Button 
                                        className="gap-2"
                                        onClick={() => setIsSelectDocOpen(true)}
                                    >
                                        <FileText className="w-4 h-4" />
                                        Select Document
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableQuizzes.map((quiz) => (
                                        <div
                                            key={quiz.id}
                                            className={quiz.id === highlightQuizId
                                                ? "ring-2 ring-primary rounded-lg"
                                                : ""}
                                        >
                                            <QuizCard
                                                quiz={quiz}
                                                lastScore={lastScoreByQuiz.get(quiz.id) ?? null}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="completed" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Completed Quizzes</CardTitle>
                            <CardDescription>Review your past quiz attempts and scores</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {completedQuizzes.length === 0 ? (
                                <div className="text-center py-12">
                                    <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No completed quizzes</h3>
                                    <p className="text-muted-foreground">
                                        Complete a quiz to see your results here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {completedQuizzes.map((quiz) => (
                                        <QuizCard
                                            key={quiz.id}
                                            quiz={quiz}
                                            lastScore={lastScoreByQuiz.get(quiz.id) ?? null}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            <SelectDocumentDialog
                open={isSelectDocOpen}
                onOpenChange={setIsSelectDocOpen}
                onSelect={handleSelectDocument}
            />

            {selectedDocId && (
                <GenerateQuizDialog
                    open={isGenerateQuizOpen}
                    onOpenChange={setIsGenerateQuizOpen}
                    documentId={selectedDocId}
                />
            )}
        </div>
    )
}
