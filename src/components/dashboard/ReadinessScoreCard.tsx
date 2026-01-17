import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

export function ReadinessScoreCard() {
    const readinessScore = 78
    const readinessLevel = readinessScore >= 80 ? "High" : readinessScore >= 60 ? "Medium" : "Low"
    const forecast = 4

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Readiness</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{readinessScore}%</div>
                <p className="text-xs text-muted-foreground mb-2">{readinessLevel}</p>
                <div className="flex items-center gap-1 text-xs text-primary">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{forecast}% forecast</span>
                </div>
            </CardContent>
        </Card>
    )
}
