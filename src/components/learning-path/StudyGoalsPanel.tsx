import { useState, useMemo, useEffect } from "react"
import {
    Target,
    BookOpen,
    Clock,
    Plus,
    Trash2,
    CalendarDays,
    Trophy,
    Loader2,
    CheckCircle2,
    Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useDocuments, useUpdateDocument, type Document } from "@/hooks/useDocuments"
import { useQuizzes, useUpdateQuizDeadline, type Quiz } from "@/hooks/useQuizzes"
import { useStudyGoals } from "@/hooks/useStudyGoals"
import { toast } from "sonner"
import { ExamManager } from "./ExamManager"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useScheduleDocumentGoalWindow, useDeactivateDocumentGoalWindowPlaceholders } from '@/hooks/useGoalWindowScheduling'
import { useConceptMasteryList } from "@/hooks/useLearning"
import {
    buildDocumentsWithExplicitQuizDeadlines,
    buildLatestQuizIdByDocument,
    getEffectiveQuizDeadline,
} from "@/lib/quizDeadlines"

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type PreparationLevel = 'Strong' | 'Moderate' | 'Limited' | 'Not Started'

function getPreparationLevel(score: number | null): PreparationLevel {
    if (score === null) return 'Not Started'
    if (score >= 80) return 'Strong'
    if (score >= 60) return 'Moderate'
    return 'Limited'
}

function getPreparationColor(level: PreparationLevel): string {
    switch (level) {
        case 'Strong': return 'bg-green-100 text-green-700 ring-green-200'
        case 'Moderate': return 'bg-blue-100 text-blue-700 ring-blue-200'
        case 'Limited': return 'bg-amber-100 text-amber-700 ring-amber-200'
        default: return 'bg-slate-100 text-slate-600 ring-slate-200'
    }
}

function daysRemaining(deadline: string | null): string | null {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(deadline.split('T')[0] + "T00:00:00")
    const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)}d overdue`
    if (diff === 0) return "Due today"
    if (diff === 1) return "Due tomorrow"
    return `${diff}d left`
}

// ─── Document Goal Card ───────────────────────────────────────────────────────

function DocumentGoalCard({
    doc,
    onEdit,
    preparationScore,
}: {
    doc: Document
    onEdit: (doc: Document) => void
    preparationScore: number | null
}) {
    const updateDocument = useUpdateDocument()
    const deactivatePlaceholders = useDeactivateDocumentGoalWindowPlaceholders()
    const goalStatus = daysRemaining(doc.exam_date || null)
    const isOverdue = goalStatus?.includes("overdue")
    
    const preparation = getPreparationLevel(preparationScore)
    const preparationColor = getPreparationColor(preparation)

    const handleRemoveGoal = () => {
        updateDocument.mutate({
            documentId: doc.id,
            updates: { exam_date: null }
        }, {
            onSuccess: () => {
                toast.info("Goal date removed.")
                deactivatePlaceholders.mutate({ documentId: doc.id })
            },
            onError: () => toast.error("Failed to remove goal date."),
        })
    }

    return (
        <Card className={`overflow-hidden transition-all duration-200 border ${
            isOverdue 
                ? 'border-red-200 bg-red-50/30' 
                : 'bg-card hover:shadow-md'
        }`}>
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                        <BookOpen className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h4 className="font-bold text-base truncate pr-2 tracking-tight">{doc.title}</h4>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
                                    File Study Goal
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:bg-accent"
                                    onClick={() => onEdit(doc)}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                    onClick={handleRemoveGoal}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {doc.exam_date && (
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${
                                    isOverdue 
                                        ? 'bg-red-100 text-red-700 ring-red-200' 
                                        : 'bg-blue-100 text-blue-700 ring-blue-200'
                                }`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    {goalStatus}
                                </div>
                            )}

                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${preparationColor}`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                {preparation} Preparation
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Quiz Goal Card ───────────────────────────────────────────────────────────

function QuizGoalCard({
    quiz,
    doc,
    deadline,
    preparationScore,
    onEdit,
}: {
    quiz: Quiz
    doc: Document | undefined
    deadline: string | null
    preparationScore: number | null
    onEdit: (quiz: Quiz) => void
}) {
    const updateQuizDeadline = useUpdateQuizDeadline()
    const goalStatus = daysRemaining(deadline)
    const isOverdue = goalStatus?.includes("overdue")
    
    const preparation = getPreparationLevel(preparationScore)
    const preparationColor = getPreparationColor(preparation)
    const isMastered = preparation === 'Strong'

    const handleRemoveGoal = () => {
        updateQuizDeadline.mutate({
            quizId: quiz.id,
            documentId: quiz.document_id,
            deadline: null,
        }, {
            onSuccess: () => toast.info("Deadline removed."),
            onError: () => toast.error("Failed to remove deadline."),
        })
    }

    return (
        <Card className={`overflow-hidden transition-all duration-200 border ${
            isMastered 
                ? 'bg-green-50/50 border-green-200 shadow-sm' 
                : isOverdue 
                    ? 'border-red-200 bg-red-50/30' 
                    : 'bg-card hover:shadow-md'
        }`}>
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        isMastered 
                            ? 'bg-green-100 text-green-600' 
                            : isOverdue
                                ? 'bg-red-100 text-red-600'
                                : 'bg-primary/10 text-primary'
                    }`}>
                        {isMastered ? <Trophy className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h4 className="font-bold text-base truncate pr-2 uppercase tracking-tight">{quiz.title}</h4>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <BookOpen className="w-3 h-3" />
                                    {doc?.title || "Unknown Document"}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:bg-accent"
                                    onClick={() => onEdit(quiz)}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                    onClick={handleRemoveGoal}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                            {deadline && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${
                                    isOverdue 
                                        ? 'bg-red-100 text-red-700 ring-red-200' 
                                        : 'bg-purple-100 text-purple-700 ring-purple-200'
                                }`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    {goalStatus}
                                </div>
                            )}

                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${preparationColor}`}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {preparation} Preparation
                            </div>
                        </div>

                        {preparationScore !== null && (
                            <div className="mt-4 space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                    <span>Preparation Estimate</span>
                                    <span>{preparation}</span>
                                </div>
                                <Progress value={preparationScore} className={`h-1.5 ${isMastered ? '[&>div]:bg-green-500' : ''}`} />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Set Goal Dialog ──────────────────────────────────────────────────────────

function SetGoalDialog({ 
    open, 
    onClose, 
    quizToEdit,
    docToEdit
}: { 
    open: boolean; 
    onClose: () => void; 
    quizToEdit?: Quiz
    docToEdit?: Document
}) {
    const { data: quizzes } = useQuizzes()
    const { data: documents } = useDocuments()
    const updateDocument = useUpdateDocument()
    const updateQuizDeadline = useUpdateQuizDeadline()
    const scheduleGoalWindow = useScheduleDocumentGoalWindow()
    const latestQuizIdByDocument = useMemo(() => buildLatestQuizIdByDocument(quizzes || []), [quizzes])
    const documentsWithExplicitQuizDeadlines = useMemo(
        () => buildDocumentsWithExplicitQuizDeadlines(quizzes || []),
        [quizzes],
    )
    
    const [selectedId, setSelectedId] = useState<string>("")
    const [deadline, setDeadline] = useState<string>("")
    const [goalType, setGoalType] = useState<"quiz" | "file">(quizToEdit ? "quiz" : docToEdit ? "file" : "file")
    const [goalLabel, setGoalLabel] = useState<string>("")

    useEffect(() => {
        if (quizToEdit) {
            setGoalType("quiz")
            setSelectedId(quizToEdit.id)
            const parentDoc = documents?.find(d => d.id === quizToEdit.document_id)
            const quizDeadline = getEffectiveQuizDeadline({
                quiz: quizToEdit,
                latestQuizIdByDocument,
                documentDeadline: parentDoc?.deadline ?? null,
                documentsWithExplicitQuizDeadlines,
            })
            setDeadline(quizDeadline ? quizDeadline.split('T')[0] : "")
            setGoalLabel(parentDoc?.quiz_deadline_label || "")
        } else if (docToEdit) {
            setGoalType("file")
            setSelectedId(docToEdit.id)
            setDeadline(docToEdit.exam_date ? docToEdit.exam_date.split('T')[0] : "")
            setGoalLabel(docToEdit.goal_label || "")
        } else {
            setSelectedId("")
            setDeadline("")
            setGoalLabel("")
        }
    }, [documents, docToEdit, documentsWithExplicitQuizDeadlines, latestQuizIdByDocument, open, quizToEdit])

    const handleSubmit = () => {
        if (!selectedId || !deadline) {
            toast.error("Please fill all fields.")
            return
        }

        if (goalType === "quiz") {
            const quiz = quizzes?.find(q => q.id === selectedId)
            if (!quiz) return

            updateQuizDeadline.mutate({
                quizId: quiz.id,
                documentId: quiz.document_id,
                deadline,
                quizDeadlineLabel: goalLabel.trim() ? goalLabel.trim() : null,
            }, {
                onSuccess: () => {
                    toast.success("Quiz deadline set!")
                    onClose()
                },
                onError: (err) => toast.error("Failed: " + err.message)
            })
        } else {
            updateDocument.mutate({
                documentId: selectedId,
                updates: { exam_date: deadline, goal_label: goalLabel.trim() ? goalLabel.trim() : null },
            }, {
                onSuccess: (updatedDoc) => {
                    toast.success("File goal set!")
                    onClose()
                    if (updatedDoc?.exam_date) {
                        scheduleGoalWindow.mutate({
                            document: { id: updatedDoc.id, exam_date: updatedDoc.exam_date },
                            examDate: updatedDoc.exam_date,
                        })
                    }
                },
                onError: (err) => toast.error("Failed: " + err.message)
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        {quizToEdit || docToEdit ? 'Update Goal' : 'Set New Study Goal'}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={goalType} onValueChange={(v) => setGoalType(v as any)} className="w-full">
                    {!quizToEdit && !docToEdit && (
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="file">File Goal</TabsTrigger>
                            <TabsTrigger value="quiz">Quiz Deadline</TabsTrigger>
                        </TabsList>
                    )}

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>
                                {goalType === "file" ? "Goal name (optional)" : "Deadline label (optional)"}
                            </Label>
                            <Input
                                value={goalLabel}
                                onChange={(e) => setGoalLabel(e.target.value)}
                                placeholder={goalType === "file" ? "e.g., Finish Chapter 4" : "e.g., Midterm quiz"}
                                maxLength={80}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>{goalType === "file" ? "Select Document" : "Select Quiz"}</Label>
                            <Select value={selectedId} onValueChange={setSelectedId} disabled={!!quizToEdit || !!docToEdit}>
                                <SelectTrigger>
                                    <SelectValue placeholder={goalType === "file" ? "Choose file…" : "Choose quiz…"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-52">
                                    {goalType === "file" ? (
                                        documents?.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)
                                    ) : (
                                        quizzes?.map(q => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <CalendarDays className="w-3.5 h-3.5" />
                                Target Date
                            </Label>
                            <Input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                            />
                        </div>
                    </div>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                        {quizToEdit || docToEdit ? 'Update Goal' : 'Set Goal'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function StudyGoalsPanel() {
    const { data: documents, isLoading: docsLoading } = useDocuments()
    const { data: quizzes, isLoading: quizzesLoading, isError: quizzesError } = useQuizzes()
    const { data: allMastery } = useConceptMasteryList()
    const { data: studyGoals } = useStudyGoals()
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
    const getQuizDeadline = (quiz: Quiz) => getEffectiveQuizDeadline({
        quiz,
        latestQuizIdByDocument,
        documentDeadline: docsById.get(quiz.document_id)?.deadline ?? null,
        documentsWithExplicitQuizDeadlines,
    })
    
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [quizToEdit, setQuizToEdit] = useState<Quiz | undefined>(undefined)
    const [docToEdit, setDocToEdit] = useState<Document | undefined>(undefined)

    const getDocPreparation = (docId: string) => {
        if (!allMastery) return null
        const allDocConcepts = allMastery.filter(m => m.document_id === docId)
        if (allDocConcepts.length === 0) return null
        const attempted = allDocConcepts.filter(m => m.total_attempts > 0)
        if (attempted.length === 0) return null
        const coverage = attempted.length / allDocConcepts.length
        const avgMastery = Math.round(attempted.reduce((acc, m) => acc + m.display_mastery_score, 0) / attempted.length)
        // Penalize low coverage: effective score scales with how much material was attempted
        return Math.round(avgMastery * Math.min(coverage * 1.5, 1))
    }

    const docsWithGoals = useMemo(() => {
        if (!documents) return []
        return documents.filter(d => d.exam_date).sort((a, b) => {
            return new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime()
        })
    }, [documents])

    const quizzesWithDeadlines = useMemo(() => {
        return (quizzes || [])
            .filter((quiz) => !!getQuizDeadline(quiz))
            .sort((a, b) => {
                const aDeadline = getQuizDeadline(a) ?? ""
                const bDeadline = getQuizDeadline(b) ?? ""
                return new Date(aDeadline).getTime() - new Date(bDeadline).getTime()
            })
    }, [getQuizDeadline, quizzes])

    const handleEditQuiz = (quiz: Quiz) => {
        setQuizToEdit(quiz)
        setDocToEdit(undefined)
        setShowAddDialog(true)
    }

    const handleEditDoc = (doc: Document) => {
        setDocToEdit(doc)
        setQuizToEdit(undefined)
        setShowAddDialog(true)
    }

    const handleAddGoal = () => {
        setQuizToEdit(undefined)
        setDocToEdit(undefined)
        setShowAddDialog(true)
    }

    return (
        <div className="container mx-auto px-1 sm:px-4 py-8">
            <div className="space-y-6 mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-white/50 p-6 rounded-2xl border border-border/50 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
                            <Target className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Study Goals & Deadlines</h1>
                            <p className="text-sm sm:text-base text-muted-foreground font-medium">
                                Plan your learning path by setting targets for files and assessments
                            </p>
                        </div>
                    </div>
                    <Button onClick={handleAddGoal} size="lg" className="gap-2 w-full sm:w-auto shadow-md hover:shadow-lg transition-all rounded-xl">
                        <Plus className="w-5 h-5" />
                        Set New Goal
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Column: File Study Goals */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            File Study Goals
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {docsLoading ? (
                             <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin opacity-20" /></div>
                        ) : docsWithGoals.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10 opacity-60">
                                <p className="text-xs font-medium text-muted-foreground">No file goals set</p>
                            </div>
                        ) : (
                            docsWithGoals.map(doc => (
                                <DocumentGoalCard 
                                    key={doc.id} 
                                    doc={doc} 
                                    onEdit={handleEditDoc} 
                                    preparationScore={getDocPreparation(doc.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Middle Column: Quiz Deadlines */}
                <div className="xl:col-span-5 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            Quiz Deadlines
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {quizzesLoading ? (
                             <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin opacity-20" /></div>
                        ) : quizzesError ? (
                            <Card className="border-red-200 bg-red-50/50"><CardContent className="py-12 text-center text-red-600 font-medium">Failed to load quizzes.</CardContent></Card>
                        ) : quizzesWithDeadlines.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10 opacity-60">
                                <p className="text-xs font-medium text-muted-foreground">No quiz deadlines set</p>
                            </div>
                        ) : (
                            quizzesWithDeadlines.map((quiz) => (
                                <QuizGoalCard 
                                    key={quiz.id} 
                                    quiz={quiz} 
                                    doc={docsById.get(quiz.document_id)}
                                    deadline={getQuizDeadline(quiz)}
                                    preparationScore={getDocPreparation(quiz.document_id)}
                                    onEdit={handleEditQuiz}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Explicit Study Goals (read-only surfacing) */}
                {studyGoals && studyGoals.length > 0 && (
                    <div className="xl:col-span-12 space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Explicit Study Goals
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {studyGoals.map((goal) => (
                                <Card key={goal.id} className={goal.is_completed ? "opacity-60" : ""}>
                                    <CardContent className="py-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">{goal.title}</span>
                                            {goal.is_completed && (
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            )}
                                        </div>
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                            <span className="capitalize">{goal.goal_type.replace('_', ' ')}</span>
                                            <span>Target: {goal.target_value}{goal.goal_type.includes('mastery') ? '%' : ''}</span>
                                            {goal.deadline && <span>Due: {goal.deadline}</span>}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Right Column: Sidebar */}
                <div className="xl:col-span-3 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-muted-foreground" />
                        Summary
                    </h2>
                    <ExamManager />
                </div>
            </div>

            <SetGoalDialog 
                open={showAddDialog} 
                onClose={() => setShowAddDialog(false)} 
                quizToEdit={quizToEdit}
                docToEdit={docToEdit}
            />
        </div>
    )
}
