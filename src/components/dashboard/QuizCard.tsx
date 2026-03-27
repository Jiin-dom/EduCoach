import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, FileQuestion, CheckCircle2, Loader2, AlertCircle, Eye } from "lucide-react"
import { Link } from "react-router-dom"
import type { Quiz } from "@/hooks/useQuizzes"

interface QuizCardProps {
    quiz: Quiz
    lastScore?: number | null
}

export function QuizCard({ quiz, lastScore }: QuizCardProps) {
    const difficultyColors: Record<string, string> = {
        easy: "bg-green-500/10 text-green-700 dark:text-green-400",
        medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
        hard: "bg-red-500/10 text-red-700 dark:text-red-400",
        mixed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    }

    const estimatedMinutes = quiz.time_limit_minutes
        ?? Math.max(5, Math.ceil(quiz.question_count * 1.5))

    const isGenerating = quiz.status === 'generating'
    const isError = quiz.status === 'error'
    const isReady = quiz.status === 'ready'
    const hasAttempt = lastScore !== null && lastScore !== undefined

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {isGenerating ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : isError ? (
                        <AlertCircle className="w-6 h-6 text-destructive" />
                    ) : hasAttempt ? (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                        <FileQuestion className="w-6 h-6 text-primary" />
                    )}
                </div>

                <div className="flex-1 min-w-0 sm:hidden">
                    <h4 className="font-semibold mb-1 truncate">{quiz.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{quiz.question_count} qs</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {estimatedMinutes} min</span>
                    </div>
                </div>
            </div>

            <div className="hidden sm:block flex-1 min-w-0">
                <h4 className="font-semibold mb-1 truncate">{quiz.title}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{quiz.question_count} questions</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{estimatedMinutes} min</span>
                    <span>•</span>
                    <Badge variant="secondary" className={difficultyColors[quiz.difficulty] || difficultyColors.mixed}>
                        {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
                    </Badge>
                </div>
                {hasAttempt && (
                    <p className="text-sm font-medium text-primary mt-1">
                        Last Score: {Math.round(lastScore)}%
                    </p>
                )}
                {isError && quiz.error_message && (
                    <p className="text-sm text-destructive mt-1 truncate">{quiz.error_message}</p>
                )}
            </div>
            
            <div className="sm:hidden w-full space-y-2 mt-1 mb-1">
                <Badge variant="secondary" className={difficultyColors[quiz.difficulty] || difficultyColors.mixed}>
                    {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
                </Badge>
                {hasAttempt && (
                    <p className="text-sm font-medium text-primary mt-1">
                        Last Score: {Math.round(lastScore)}%
                    </p>
                )}
                {isError && quiz.error_message && (
                    <p className="text-sm text-destructive mt-1 truncate">{quiz.error_message}</p>
                )}
            </div>

            <div className="shrink-0 w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-stretch gap-2">
                {isReady && (
                    <>
                        {hasAttempt && (
                            <Link to={`/quizzes/${quiz.id}?review=true`} className="flex-1 sm:w-full">
                                <Button size="sm" variant="outline" className="w-full gap-2">
                                    <Eye className="w-4 h-4" />
                                    View
                                </Button>
                            </Link>
                        )}
                        <Link to={`/quizzes/${quiz.id}`} className="flex-1 sm:w-full">
                            <Button size="sm" variant={hasAttempt ? "ghost" : "default"} className="w-full">
                                {hasAttempt ? "Retake" : "Start Quiz"}
                            </Button>
                        </Link>
                    </>
                )}
                {isGenerating && (
                    <Button size="sm" variant="outline" disabled className="w-full sm:w-auto">
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Generating...
                    </Button>
                )}
            </div>
        </div>
    )
}
