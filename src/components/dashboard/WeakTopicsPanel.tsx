import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Brain } from "lucide-react"
import { useWeakTopics } from "@/hooks/useLearning"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"

export function WeakTopicsPanel() {
    const { data: weakTopics, isLoading } = useWeakTopics(3)

    return (
        <Card className="lg:col-span-1 h-full">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Weak Topics
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="rounded-xl border bg-card p-3.5">
                                <div className="mb-2.5 flex items-start gap-3">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-2/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                                <Skeleton className="mb-2.5 h-2 w-full rounded-full" />
                                <Skeleton className="h-8 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : !weakTopics || weakTopics.length === 0 ? (
                    <div className="text-center py-8">
                        <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                            No weak topics yet. Complete some quizzes to start tracking mastery.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {weakTopics.map((topic) => (
                            <div key={topic.id} className="rounded-xl border bg-card p-3.5">
                                <div className="mb-2.5 flex items-start gap-3">
                                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                        topic.mastery_score < 40 ? "text-red-500" : "text-orange-500"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate text-sm font-semibold">{topic.concept_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {Math.round(topic.mastery_score)}% mastery
                                            {topic.document_title && ` · ${topic.document_title}`}
                                        </p>
                                    </div>
                                </div>
                                <Progress value={topic.mastery_score} className="mb-2.5 h-2" />
                                {topic.document_id && (
                                    <Link to={`/files/${topic.document_id}`}>
                                        <Button variant="outline" size="sm" className="w-full bg-transparent text-xs">
                                            <Brain className="w-4 h-4 mr-2" />
                                            Review Material
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
