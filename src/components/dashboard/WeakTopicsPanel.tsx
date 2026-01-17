import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Brain } from "lucide-react"

export function WeakTopicsPanel() {
    const weakTopics = [
        { id: "1", name: "Grammar", accuracy: 58, color: "text-red-500" },
        { id: "2", name: "Algebra", accuracy: 61, color: "text-orange-500" },
    ]

    return (
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Weak Topics
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {weakTopics.map((topic) => (
                        <div key={topic.id} className="p-4 rounded-lg border bg-card">
                            <div className="flex items-start gap-3 mb-3">
                                <AlertTriangle className={`w-5 h-5 ${topic.color} flex-shrink-0 mt-0.5`} />
                                <div className="flex-1">
                                    <p className="font-semibold">{topic.name}</p>
                                    <p className="text-sm text-muted-foreground">{topic.accuracy}% accuracy</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full bg-transparent">
                                <Brain className="w-4 h-4 mr-2" />
                                Review with AI Tutor
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
