import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { useLearningStats } from "@/hooks/useLearning"

export function ReadinessScoreCard() {
    const { data: stats } = useLearningStats()

    const readinessScore = stats?.averageMastery ?? 0
    const readinessLevel = readinessScore >= 80 ? "High" : readinessScore >= 60 ? "Medium" : "Low"
    const tracked = stats?.totalConcepts ?? 0

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Readiness</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{readinessScore}%</div>
                <p className="text-xs text-muted-foreground mb-2">{readinessLevel}</p>
                <p className="text-xs text-muted-foreground">
                    {tracked > 0 ? `${tracked} concepts tracked` : "Take a quiz to start tracking"}
                </p>
            </CardContent>
        </Card>
    )
}
