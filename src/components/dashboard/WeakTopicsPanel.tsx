import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Brain, Loader2 } from "lucide-react"
import { useWeakTopics } from "@/hooks/useLearning"
import { Link } from "react-router-dom"

export function WeakTopicsPanel() {
    const { data: weakTopics, isLoading } = useWeakTopics(3)

    return (
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Weak Topics
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : !weakTopics || weakTopics.length === 0 ? (
                    <div className="text-center py-8">
                        <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                            No weak topics yet. Complete some quizzes to start tracking mastery.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {weakTopics.map((topic) => (
                            <div key={topic.id} className="p-4 rounded-lg border bg-card">
                                <div className="flex items-start gap-3 mb-3">
                                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                        topic.mastery_score < 40 ? "text-red-500" : "text-orange-500"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{topic.concept_name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {Math.round(topic.mastery_score)}% mastery
                                            {topic.document_title && ` · ${topic.document_title}`}
                                        </p>
                                    </div>
                                </div>
                                <Progress value={topic.mastery_score} className="h-2 mb-3" />
                                {topic.document_id && (
                                    <Link to={`/files/${topic.document_id}`}>
                                        <Button variant="outline" size="sm" className="w-full bg-transparent">
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
