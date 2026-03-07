import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Loader2, AlertCircle, RefreshCw, FileText, Layers, RotateCcw, ChevronRight, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useAllFlashcards, useReviewFlashcard, type Flashcard } from "@/hooks/useFlashcards"

export function QuizzesContent() {
    const { data: quizzes, isLoading, error, refetch } = useQuizzes()
    const { data: attempts } = useUserAttempts()

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
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">My Quizzes & Flashcards</h1>
                        <p className="text-muted-foreground">Track your progress and test your knowledge</p>
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
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">My Quizzes & Flashcards</h1>
                        <p className="text-muted-foreground">Track your progress and test your knowledge</p>
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">My Quizzes & Flashcards</h1>
                        <p className="text-muted-foreground">Track your progress and test your knowledge</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Link to="/files">
                        <Button className="gap-2">
                            <FileText className="w-4 h-4" />
                            Generate from Document
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="available">Available ({availableQuizzes.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedQuizzes.length})</TabsTrigger>
                    <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
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
                                    <Link to="/files">
                                        <Button className="gap-2">
                                            <FileText className="w-4 h-4" />
                                            Go to Files
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableQuizzes.map((quiz) => (
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

                <TabsContent value="flashcards" className="mt-6">
                    <FlashcardsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// -------------------------------------------------------
// Flashcard Study Session
// -------------------------------------------------------

type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

function FlashcardsPanel() {
    const { data: allCards, isLoading } = useAllFlashcards()
    const reviewMutation = useReviewFlashcard()
    const [studyMode, setStudyMode] = useState(false)
    const [currentIdx, setCurrentIdx] = useState(0)
    const [flipped, setFlipped] = useState(false)
    const [sessionDone, setSessionDone] = useState(0)

    const dueCards = useMemo(() => {
        if (!allCards) return []
        const now = new Date().toISOString()
        return allCards.filter(c => !c.due_date || c.due_date <= now)
    }, [allCards])

    const totalCards = allCards?.length ?? 0
    const dueCount = dueCards.length

    const handleRate = async (card: Flashcard, rating: ReviewRating) => {
        await reviewMutation.mutateAsync({ card, rating })
        setFlipped(false)
        setSessionDone(prev => prev + 1)
        if (currentIdx + 1 < dueCards.length) {
            setCurrentIdx(prev => prev + 1)
        } else {
            setStudyMode(false)
            setCurrentIdx(0)
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </CardContent>
            </Card>
        )
    }

    if (totalCards === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Flashcards</CardTitle>
                    <CardDescription>Review and memorize key concepts</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <Layers className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No flashcards yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Process a document to automatically generate flashcards from its concepts.
                        </p>
                        <Link to="/files">
                            <Button className="gap-2">
                                <FileText className="w-4 h-4" />Go to Files
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Study session
    if (studyMode && dueCards.length > 0) {
        const card = dueCards[currentIdx]
        if (!card) {
            setStudyMode(false)
            return null
        }

        return (
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Study Session</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                                {currentIdx + 1} / {dueCards.length}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => { setStudyMode(false); setCurrentIdx(0); setFlipped(false) }}>
                                Exit
                            </Button>
                        </div>
                    </div>
                    <Progress value={((currentIdx) / dueCards.length) * 100} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent>
                    <div
                        className="min-h-[200px] flex items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors my-4"
                        onClick={() => setFlipped(!flipped)}
                    >
                        <div className="text-center max-w-lg">
                            {!flipped ? (
                                <>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Question</p>
                                    <p className="text-lg font-medium">{card.front}</p>
                                    <p className="text-xs text-muted-foreground mt-4">Tap to reveal answer</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Answer</p>
                                    <p className="text-sm leading-relaxed">{card.back}</p>
                                </>
                            )}
                        </div>
                    </div>

                    {flipped && (
                        <div className="space-y-2">
                            <p className="text-xs text-center text-muted-foreground">How well did you know this?</p>
                            <div className="grid grid-cols-4 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-red-200 hover:bg-red-50 text-red-700"
                                    onClick={() => handleRate(card, 'again')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" />Again
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-orange-200 hover:bg-orange-50 text-orange-700"
                                    onClick={() => handleRate(card, 'hard')}
                                    disabled={reviewMutation.isPending}
                                >
                                    Hard
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                                    onClick={() => handleRate(card, 'good')}
                                    disabled={reviewMutation.isPending}
                                >
                                    Good
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-green-200 hover:bg-green-50 text-green-700"
                                    onClick={() => handleRate(card, 'easy')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />Easy
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    // Dashboard view
    return (
        <Card>
            <CardHeader>
                <CardTitle>Flashcards</CardTitle>
                <CardDescription>Review and memorize key concepts with spaced repetition</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold">{totalCards}</p>
                            <p className="text-xs text-muted-foreground">Total Cards</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/5">
                            <p className="text-2xl font-bold text-primary">{dueCount}</p>
                            <p className="text-xs text-muted-foreground">Due Today</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                            <p className="text-2xl font-bold text-green-600">{sessionDone}</p>
                            <p className="text-xs text-muted-foreground">Reviewed</p>
                        </div>
                    </div>

                    {dueCount > 0 ? (
                        <Button
                            className="w-full gap-2"
                            size="lg"
                            onClick={() => { setStudyMode(true); setCurrentIdx(0); setFlipped(false) }}
                        >
                            <ChevronRight className="w-4 h-4" />
                            Study {dueCount} Due Card{dueCount !== 1 ? 's' : ''}
                        </Button>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                            <p className="font-medium">All caught up!</p>
                            <p className="text-sm">No cards due for review right now.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
