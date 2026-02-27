import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, FileQuestion, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
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
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
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

            <div className="flex-1 min-w-0">
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

            {isReady && (
                <Link to={`/quizzes/${quiz.id}`}>
                    <Button size="sm" variant={hasAttempt ? "outline" : "default"}>
                        {hasAttempt ? "Retake" : "Start Quiz"}
                    </Button>
                </Link>
            )}
            {isGenerating && (
                <Button size="sm" variant="outline" disabled>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Generating...
                </Button>
            )}
        </div>
    )
}
