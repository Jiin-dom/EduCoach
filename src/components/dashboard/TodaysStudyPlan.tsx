import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Clock, BookOpen, Brain, Loader2, Calendar } from "lucide-react"
import { useDueTopics, useConceptMasteryList } from "@/hooks/useLearning"
import { todayUTC } from "@/lib/learningAlgorithms"
import { Link } from "react-router-dom"

function masteryBadge(level: string) {
    switch (level) {
        case 'mastered':
            return <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">Mastered</Badge>
        case 'developing':
            return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 text-xs">Developing</Badge>
        default:
            return <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">Needs Review</Badge>
    }
}

export function TodaysStudyPlan() {
    const { data: dueTopics, isLoading } = useDueTopics()
    const { data: allMastery } = useConceptMasteryList()

    const topItems = (dueTopics || []).slice(0, 5)

    const completionPercent = useMemo(() => {
        const all = (allMastery || []).filter((m) => m.total_attempts > 0)
        if (all.length === 0) return 0
        const today = todayUTC()
        const totalDue = all.filter((m) => m.due_date <= today).length
        if (totalDue === 0) return 100
        const reviewedToday = all.filter(
            (m) => m.due_date <= today && m.last_reviewed_at &&
                   m.last_reviewed_at.split('T')[0] === today
        ).length
        return Math.round((reviewedToday / totalDue) * 100)
    }, [allMastery])

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <CardTitle>Today's Study Plan</CardTitle>
                    </div>
                    {topItems.length > 0 && (
                        <span className="text-sm text-muted-foreground">
                            {topItems.length} topic{topItems.length !== 1 ? 's' : ''} due
                        </span>
                    )}
                </div>
                {topItems.length > 0 && (
                    <Progress
                        value={completionPercent}
                        className="mt-2"
                    />
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : topItems.length === 0 ? (
                    <div className="text-center py-8">
                        <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                            No topics due today. You're all caught up!
                        </p>
                        <Link to="/quizzes">
                            <Button variant="outline" size="sm" className="mt-3">
                                Take a Quiz
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topItems.map((topic) => (
                            <div key={topic.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                    <BookOpen className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium truncate">{topic.concept_name}</p>
                                        {masteryBadge(topic.display_mastery_level)}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {topic.document_title && (
                                            <span className="truncate">{topic.document_title}</span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {Math.round(topic.display_mastery_score)}% mastery
                                        </span>
                                    </div>
                                </div>
                                {topic.document_id && (
                                    <Link to={`/files/${topic.document_id}`}>
                                        <Button variant="ghost" size="sm" className="shrink-0">
                                            Review
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ))}
                        {(dueTopics || []).length > 5 && (
                            <Link to="/learning-path">
                                <Button variant="outline" size="sm" className="w-full">
                                    View All Due Topics
                                </Button>
                            </Link>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
