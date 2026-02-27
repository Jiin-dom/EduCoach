import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Loader2, AlertCircle, RefreshCw, FileText, Layers } from "lucide-react"
import { Link } from "react-router-dom"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"

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
                    <Card>
                        <CardHeader>
                            <CardTitle>Flashcard Sets</CardTitle>
                            <CardDescription>Review and memorize key concepts with flashcards</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-12">
                                <Layers className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                                <p className="text-muted-foreground">
                                    Flashcard generation will be available in a future update
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
