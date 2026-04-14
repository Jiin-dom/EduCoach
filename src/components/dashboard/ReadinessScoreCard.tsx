import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Loader2 } from "lucide-react"
import { useLearningStats, useConceptMasteryList } from "@/hooks/useLearning"
import { computeGlobalEstimate } from "@/lib/readinessEstimate"

export function ReadinessScoreCard() {
    const { data: stats, isLoading: statsLoading } = useLearningStats()
    const { data: masteryList, isLoading: masteryLoading } = useConceptMasteryList()

    const isLoading = statsLoading || masteryLoading

    const totalTracked = stats?.totalConcepts ?? 0
    const attempted = masteryList?.filter(m => m.total_attempts > 0).length ?? 0
    const performance = stats?.averageMastery ?? 0

    const estimate = computeGlobalEstimate(totalTracked, attempted, performance)

    const coveragePct = Math.round(estimate.overallCoverage * 100)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Preparation Estimate</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="text-lg font-bold mb-1">{estimate.label}</div>
                        <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                            <span>Coverage: {coveragePct}%</span>
                            <span>Performance: {performance}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {totalTracked > 0
                                ? `${attempted} of ${totalTracked} concepts attempted`
                                : "Take a quiz to start tracking"}
                        </p>
                        {estimate.note && (
                            <p className="text-xs text-muted-foreground/70 mt-1">{estimate.note}</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
