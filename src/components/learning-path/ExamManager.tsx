import { useMemo } from "react"
import { Calendar, Target, Trash2, BookOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuizzes, useUpdateQuizDeadline } from "@/hooks/useQuizzes"
import { useDocuments, useUpdateDocument } from "@/hooks/useDocuments"
import { toast } from "sonner"
import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "@/lib/quizDeadlines"

export function ExamManager() {
    const { data: documents } = useDocuments()
    const { data: quizzes } = useQuizzes()
    const updateDocument = useUpdateDocument()
    const updateQuizDeadline = useUpdateQuizDeadline()
    const docsById = useMemo(
        () => new Map((documents || []).map((doc) => [doc.id, doc])),
        [documents],
    )
    const latestQuizIdByDocument = useMemo(
        () => buildLatestQuizIdByDocument(quizzes || []),
        [quizzes],
    )
    const documentsWithExplicitQuizDeadlines = useMemo(
        () => buildDocumentsWithExplicitQuizDeadlines(quizzes || []),
        [quizzes],
    )
    
    // Combine quizzes and documents that have deadlines/goals
    const allGoals = useMemo(() => {
        const goals: Array<{ id: string; title: string; date: string; type: 'quiz' | 'file' }> = []
        
        // Quizzes get their deadline from their parent document
        if (quizzes && documents) {
            quizzes.forEach(q => {
                const doc = docsById.get(q.document_id)
                const deadline = getEffectiveQuizDeadline({
                    quiz: q,
                    latestQuizIdByDocument,
                    documentDeadline: doc?.deadline ?? null,
                    documentsWithExplicitQuizDeadlines,
                })
                if (deadline) {
                    goals.push({ id: q.id, title: q.title, date: deadline, type: 'quiz' })
                }
            })
        }
        
        if (documents) {
            documents.forEach(d => {
                if (d.exam_date) goals.push({ id: d.id, title: d.title, date: d.exam_date, type: 'file' })
            })
        }

        return goals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }, [docsById, documents, documentsWithExplicitQuizDeadlines, latestQuizIdByDocument, quizzes])

    const handleRemoveGoal = (id: string, type: 'quiz' | 'file') => {
        if (type === 'quiz') {
            const quiz = quizzes?.find(q => q.id === id)
            if (quiz) {
                updateQuizDeadline.mutate(
                    { quizId: quiz.id, documentId: quiz.document_id, deadline: null },
                    { onSuccess: () => toast.success("Deadline removed") },
                )
            }
        } else {
            updateDocument.mutate({ documentId: id, updates: { exam_date: null } }, { onSuccess: () => toast.success("Goal removed") })
        }
    }

    const getDaysRemaining = (dateStr: string) => {
        const today = new Date()
        today.setHours(0,0,0,0)
        const due = new Date(dateStr.split('T')[0] + "T00:00:00")
        const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diff
    }

    return (
        <Card className="border-purple-100 bg-purple-50/30">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-600" />
                    Upcoming Targets
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {allGoals.length > 0 ? (
                        allGoals.map((goal) => {
                            const daysLeft = getDaysRemaining(goal.date)
                            const Icon = goal.type === 'file' ? BookOpen : Target
                            
                            return (
                                <div key={`${goal.type}-${goal.id}`} className="group relative flex flex-col gap-1 p-3 rounded-lg bg-white border border-purple-100 shadow-sm hover:border-purple-200 transition-all">
                                    <div className="flex justify-between items-start text-balance">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Icon className={`w-3.5 h-3.5 shrink-0 ${goal.type === 'file' ? 'text-blue-500' : 'text-purple-600'}`} />
                                            <h4 className="font-bold text-[10px] uppercase tracking-tight truncate pr-4">{goal.title}</h4>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveGoal(goal.id, goal.type)}
                                            className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-600 transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(goal.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' : daysLeft <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                            {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="text-center py-6 border-2 border-dashed border-purple-100 rounded-lg bg-white/50">
                            <Target className="w-8 h-8 text-purple-200 mx-auto mb-2" />
                            <p className="text-[10px] text-muted-foreground px-4 italic">No study goals or deadlines set.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
