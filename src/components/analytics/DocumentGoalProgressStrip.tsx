import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Target, Calendar } from 'lucide-react'
import type { GoalProgressViewModel } from '@/lib/documentGoalAnalytics'

interface DocumentGoalProgressStripProps {
    model: GoalProgressViewModel
}

export function DocumentGoalProgressStrip({ model }: DocumentGoalProgressStripProps) {
    return (
        <Card className="border-primary/25 bg-primary/[0.03]">
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Target className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Your goal</CardTitle>
                            <CardDescription className="text-sm">{model.title}</CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                            {model.percentComplete}% complete
                        </Badge>
                        {model.deadlineLabel ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                                <Calendar className="h-3 w-3" />
                                Due {model.deadlineLabel}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                No deadline set
                            </Badge>
                        )}
                        {model.extraGoalsCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                                +{model.extraGoalsCount} more goal{model.extraGoalsCount === 1 ? '' : 's'}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Progress value={model.percentComplete} className="h-2.5" />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                        <span className="font-medium text-foreground">{model.currentSummary}</span>
                        <span className="mx-1">·</span>
                        {model.targetSummary}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
