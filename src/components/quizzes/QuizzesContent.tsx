import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain } from "lucide-react"
import { FlashcardCard } from "@/components/quizzes/FlashcardCard"

export function QuizzesContent() {
    const availableQuizzes = [
        { id: "1", title: "Introduction to Algorithms", questions: 15, duration: "20 min", difficulty: "Medium" as const, status: "available" as const },
        { id: "2", title: "Data Structures Fundamentals", questions: 20, duration: "30 min", difficulty: "Hard" as const, status: "available" as const },
        { id: "4", title: "Database Management Systems", questions: 18, duration: "25 min", difficulty: "Medium" as const, status: "available" as const },
        { id: "5", title: "Web Development Basics", questions: 10, duration: "15 min", difficulty: "Easy" as const, status: "available" as const },
    ]

    const completedQuizzes = [
        { id: "3", title: "Object-Oriented Programming", questions: 12, duration: "15 min", difficulty: "Easy" as const, status: "completed" as const, score: 92 },
        { id: "6", title: "Python Fundamentals", questions: 15, duration: "20 min", difficulty: "Easy" as const, status: "completed" as const, score: 88 },
        { id: "7", title: "Software Engineering Principles", questions: 25, duration: "35 min", difficulty: "Hard" as const, status: "completed" as const, score: 76 },
    ]

    const flashcardSets = [
        { id: "1", title: "Data Structures Vocabulary", cards: 24, subject: "Computer Science", lastStudied: "2 days ago" },
        { id: "2", title: "Algorithm Complexity", cards: 18, subject: "Computer Science", lastStudied: "5 days ago" },
        { id: "3", title: "Database Normalization", cards: 15, subject: "Database", lastStudied: "1 week ago" },
    ]

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

            <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="available">Available ({availableQuizzes.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedQuizzes.length})</TabsTrigger>
                    <TabsTrigger value="flashcards">Flashcards ({flashcardSets.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="available" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Quizzes</CardTitle>
                            <CardDescription>Start a new quiz to test your knowledge</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {availableQuizzes.map((quiz) => (
                                    <QuizCard key={quiz.id} {...quiz} />
                                ))}
                            </div>
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
                            <div className="space-y-3">
                                {completedQuizzes.map((quiz) => (
                                    <QuizCard key={quiz.id} {...quiz} />
                                ))}
                            </div>
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
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {flashcardSets.map((set) => (
                                    <FlashcardCard key={set.id} {...set} />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
