import { Card, CardContent } from "@/components/ui/card"
import { Flame } from "lucide-react"

export function MotivationalCard() {
    const streak = 5

    return (
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-lg font-semibold mb-2 text-balance">"Consistency turns effort into excellence."</p>
                        <p className="text-sm text-muted-foreground">Keep up the great work!</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 ml-6">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                            <Flame className="w-5 h-5 text-primary" />
                            <span className="font-bold text-lg">{streak}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">day streak</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
