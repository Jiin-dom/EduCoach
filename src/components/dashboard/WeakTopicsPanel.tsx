import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Brain, BarChart2 } from "lucide-react"
import { useWeakTopics } from "@/hooks/useLearning"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"

export function WeakTopicsPanel() {
    const { data: weakTopics, isLoading } = useWeakTopics(3)

    return (
        <Card variant="dashboard" className="h-full flex flex-col">
            <CardHeader density="compact" className="pb-4 shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                    <span>Weak Topics</span>
                </CardTitle>
            </CardHeader>
            <CardContent density="compact" className="space-y-3 flex-1 overflow-y-auto pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="rounded-xl border border-border/50 bg-card/50 p-3.5">
                                <div className="mb-2.5 flex items-start gap-3">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-2/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                                <Skeleton className="mb-2.5 h-1.5 w-full rounded-full" />
                                <Skeleton className="h-8 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : !weakTopics || weakTopics.length === 0 ? (
                    <div className="text-center py-12 px-4 shadow-none">
                        <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10">
                            <Brain className="w-8 h-8 text-primary/60" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            No weak topics yet. Complete some quizzes to start tracking mastery.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {weakTopics.map((topic) => (
                            <div key={topic.id} className="rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:border-primary/20 hover:shadow-sm">
                                <div className="mb-2.5 flex items-start gap-3">
                                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                        topic.mastery_score < 40 ? "text-red-500" : "text-orange-500"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground/90">{topic.concept_name}</p>
                                        <p className="text-xs text-muted-foreground/80">
                                            {Math.round(topic.mastery_score)}% mastery
                                            {topic.document_title && ` · ${topic.document_title}`}
                                        </p>
                                    </div>
                                </div>
                                <Progress value={topic.mastery_score} className="mb-3 h-1.5 bg-primary/5" />
                                {topic.document_id && (
                                    <Link to={`/files/${topic.document_id}`}>
                                        <Button variant="outline" size="sm" className="w-full h-8 text-[11px] font-medium border-border/60 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors">
                                            <Brain className="w-3.5 h-3.5 mr-2" />
                                            Review Material
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            {weakTopics && weakTopics.length > 0 && (
                <CardFooter density="compact" className="pt-0 shrink-0">
                    <Link to="/analytics" className="w-full">
                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-primary">
                            <BarChart2 className="w-3.5 h-3.5 mr-2" />
                            View mastery details
                        </Button>
                    </Link>
                </CardFooter>
            )}
        </Card>
    )
}
