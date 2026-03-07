import { Card, CardContent } from "@/components/ui/card"
import { Flame } from "lucide-react"
import { useLearningStats } from "@/hooks/useLearning"

const MOTIVATIONAL_QUOTES = [
    "Consistency turns effort into excellence.",
    "Every quiz brings you closer to mastery.",
    "Small steps every day lead to big results.",
    "The more you review, the less you forget.",
    "You are building knowledge that lasts.",
]

export function MotivationalCard() {
    const { data: stats } = useLearningStats()
    const streak = stats?.studyStreak ?? 0

    const quote = MOTIVATIONAL_QUOTES[streak % MOTIVATIONAL_QUOTES.length]

    return (
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-lg font-semibold mb-2 text-balance">"{quote}"</p>
                        <p className="text-sm text-muted-foreground">
                            {streak > 0 ? "Keep up the great work!" : "Start your streak today!"}
                        </p>
                    </div>
                    <div className="flex flex-col items-center gap-2 ml-6">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                            <Flame className="w-5 h-5 text-primary" />
                            <span className="font-bold text-lg">{streak}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">day streak</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
