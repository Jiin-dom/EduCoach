import { useMemo } from "react"
import { Link } from "react-router-dom"
import { BarChart3, BookOpen, Brain, Loader2, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useConceptMasteryList, useLearningStats, useScoreTrend, useStudyActivity } from "@/hooks/useLearning"
import {
  buildDashboardMasterySummary,
  getDashboardAnalyticsCta,
  selectDashboardProgressInsight,
} from "@/lib/dashboardInsights"

export function ProgressInsightsSection({ hasPremiumEntitlement }: { hasPremiumEntitlement: boolean }) {
  const { data: scoreTrend, isLoading: scoreTrendLoading } = useScoreTrend()
  const { data: studyActivity, isLoading: studyActivityLoading } = useStudyActivity()
  const { data: masteryList, isLoading: masteryLoading } = useConceptMasteryList()
  const { data: stats, isLoading: statsLoading } = useLearningStats()

  const chartInsight = useMemo(
    () => selectDashboardProgressInsight(scoreTrend, studyActivity),
    [scoreTrend, studyActivity],
  )
  const masterySummary = useMemo(() => buildDashboardMasterySummary(masteryList), [masteryList])
  const displayedMasterySummary = useMemo(() => masterySummary.slice(0, 2), [masterySummary])
  const hiddenMasteryCount = Math.max(0, masterySummary.length - displayedMasterySummary.length)
  const cta = getDashboardAnalyticsCta(hasPremiumEntitlement)
  const singleScorePoint = chartInsight.kind === "score_trend" && chartInsight.data.length === 1
    ? chartInsight.data[0]
    : null
  const singleScorePointLabel = singleScorePoint
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(singleScorePoint.date))
    : null
  const scoreInsightStats = useMemo(() => {
    if (chartInsight.kind !== "score_trend" || chartInsight.data.length === 0) {
      return null
    }

    const scores = chartInsight.data.map((point) => point.score)
    const total = scores.reduce((sum, score) => sum + score, 0)
    const average = Math.round(total / scores.length)
    const highest = Math.max(...scores)
    const lowest = Math.min(...scores)

    return { average, highest, lowest, totalDays: scores.length }
  }, [chartInsight])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Progress Insights</h2>
          <p className="text-sm text-muted-foreground">
            Everyone gets core progress visibility here. Premium unlocks the deeper analytics workspace.
          </p>
        </div>
        <Link to={cta.href}>
          <Button variant="outline" className="bg-transparent">
            <BarChart3 className="mr-2 h-4 w-4" />
            {cta.label}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {chartInsight.title}
            </CardTitle>
            <CardDescription>{chartInsight.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {scoreTrendLoading || studyActivityLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chartInsight.kind === "score_trend" ? (
              <div className="flex flex-1 flex-col gap-3">
                {scoreInsightStats && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border bg-primary/5 p-3">
                      <p className="text-[11px] text-muted-foreground">Avg Score</p>
                      <p className="text-lg font-semibold text-primary">{scoreInsightStats.average}%</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-500/5 p-3">
                      <p className="text-[11px] text-muted-foreground">Highest</p>
                      <p className="text-lg font-semibold text-emerald-600">{scoreInsightStats.highest}%</p>
                    </div>
                    <div className="rounded-lg border bg-amber-500/5 p-3">
                      <p className="text-[11px] text-muted-foreground">Lowest</p>
                      <p className="text-lg font-semibold text-amber-600">{scoreInsightStats.lowest}%</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[11px] text-muted-foreground">Quiz Days</p>
                      <p className="text-lg font-semibold">{scoreInsightStats.totalDays}</p>
                    </div>
                  </div>
                )}
                {singleScorePoint && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Latest scored quiz day</p>
                        <p className="mt-1 text-sm font-medium">{singleScorePointLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">{singleScorePoint.score}%</p>
                        <p className="text-xs text-muted-foreground">Average score</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      One scored quiz day is recorded so far. Complete another quiz on a different day to draw a visible trend line.
                    </p>
                  </div>
                )}
                <div className="min-h-[280px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartInsight.data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value) => [`${value}%`, "Average score"]} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scores reflect completed quiz attempts grouped by day.
                </p>
              </div>
            ) : chartInsight.kind === "study_activity" ? (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex min-h-[280px] flex-1 items-center">
                  <ActivityHeatmap data={chartInsight.data} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Darker squares mean more questions answered on that day.
                </p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Brain className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No progress chart yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Take a quiz to see score trends, or answer questions to start building activity history.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Topic Mastery
            </CardTitle>
            <CardDescription>
              Top study materials by attempt-backed mastery, using the same rules as full analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {masteryLoading || statsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : masterySummary.length === 0 ? (
              <div className="py-10 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No topic mastery yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete some quizzes to start measuring topic mastery across your study materials.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    {stats?.totalConcepts ?? 0} concepts tracked across {masterySummary.length} highlighted study material
                    {masterySummary.length === 1 ? "" : "s"}.
                  </div>
                  {displayedMasterySummary.map((item) => (
                    <div key={item.documentId} className="space-y-3 rounded-xl border border-border/80 bg-card/70 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold sm:text-base">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.conceptCount} concept{item.conceptCount === 1 ? "" : "s"} tracked
                          </p>
                        </div>
                        <div className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-right">
                          <p className="text-lg font-bold leading-none text-primary">{item.averageMastery}%</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Average mastery</p>
                        </div>
                      </div>
                      <Progress value={item.averageMastery} className="h-2" />
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">
                          {item.masteredCount} mastered
                        </span>
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">
                          {item.developingCount} developing
                        </span>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                          {item.needsReviewCount} needs review
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {hiddenMasteryCount > 0 && (
                  <div className="mt-auto border-t border-dashed pt-4 text-sm text-muted-foreground">
                    +{hiddenMasteryCount} more study material{hiddenMasteryCount === 1 ? "" : "s"} in the full analytics view.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
