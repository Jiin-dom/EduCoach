import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"
import { LearningPathCalendar } from "@/components/learning-path/LearningPathCalendar"
import { StudyGoalsPanel } from "@/components/learning-path/StudyGoalsPanel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuizzes } from "@/hooks/useQuizzes"
import { useDocuments } from "@/hooks/useDocuments"
import { Target, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"
import { useMemo } from "react"
import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "@/lib/quizDeadlines"

export default function LearningPathPage() {
    const { data: quizzes = [] } = useQuizzes()
    const { data: documents = [] } = useDocuments()

    const dueTodayQuizzes = useMemo(() => {
        const today = new Date()
        const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        const docsById = new Map(documents.map((d) => [d.id, d]))
        const latestQuizIdByDocument = buildLatestQuizIdByDocument(quizzes)
        const documentsWithExplicitQuizDeadlines = buildDocumentsWithExplicitQuizDeadlines(quizzes)

        return quizzes
            .filter((quiz) => quiz.status === "ready")
            .map((quiz) => {
                const doc = docsById.get(quiz.document_id)
                const dueDate = getEffectiveQuizDeadline({
                    quiz,
                    latestQuizIdByDocument,
                    documentDeadline: doc?.deadline ?? null,
                    documentsWithExplicitQuizDeadlines,
                })?.split("T")[0] ?? null
                return {
                    id: quiz.id,
                    title: quiz.title,
                    documentTitle: doc?.title ?? null,
                    dueDate,
                }
            })
            .filter((quiz) => quiz.dueDate === todayLocal)
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [documents, quizzes])

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            
            <Tabs defaultValue="schedule" className="w-full">
                <div className="container mx-auto px-4 pt-6 pb-2">
                    <TabsList className="bg-muted">
                        <TabsTrigger value="schedule">Schedule View</TabsTrigger>
                        <TabsTrigger value="mastery">Topics & Mastery</TabsTrigger>
                        <TabsTrigger value="planning">Goals & Planning</TabsTrigger>
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
                                                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/50 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{quiz.title}</p>
                                                    {quiz.documentTitle && (
                                                        <p className="text-xs text-muted-foreground truncate">{quiz.documentTitle}</p>
                                                    )}
                                                </div>
                                                <ArrowUpRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <LearningPathCalendar />
                    </div>
                </TabsContent>
                
                <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                    <LearningPathContent />
                </TabsContent>

                <TabsContent value="planning" className="m-0 border-0 p-0 outline-none">
                    <StudyGoalsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}
