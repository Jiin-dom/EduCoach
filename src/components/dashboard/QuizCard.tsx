import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, FileQuestion, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"

interface QuizCardProps {
    id: string
    title: string
    questions: number
    duration: string
    difficulty: "Easy" | "Medium" | "Hard"
    status: "available" | "completed"
    score?: number
}

export function QuizCard({ id, title, questions, duration, difficulty, status, score }: QuizCardProps) {
    const difficultyColors = {
        Easy: "bg-green-500/10 text-green-700 dark:text-green-400",
        Medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
        Hard: "bg-red-500/10 text-red-700 dark:text-red-400",
    }

    return (
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {status === "completed" ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                ) : (
                    <FileQuestion className="w-6 h-6 text-primary" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1">{title}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{questions} questions</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{duration}</span>
                    <span>•</span>
                    <Badge variant="secondary" className={difficultyColors[difficulty]}>
                        {difficulty}
                    </Badge>
                </div>
                {status === "completed" && score !== undefined && (
                    <p className="text-sm font-medium text-primary mt-1">Score: {score}%</p>
                )}
            </div>

            <Link to={`/quizzes/${id}`}>
                <Button size="sm" variant={status === "completed" ? "outline" : "default"}>
                    {status === "completed" ? "Review" : "Start Quiz"}
                </Button>
            </Link>
        </div>
    )
}
