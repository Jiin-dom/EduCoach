import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers, Clock } from "lucide-react"
import { Link } from "react-router-dom"

interface FlashcardCardProps {
    id: string
    title: string
    cards: number
    subject: string
    lastStudied: string
}

export function FlashcardCard({ id, title, cards, subject, lastStudied }: FlashcardCardProps) {
    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {subject}
                    </span>
                </div>
                <CardTitle className="text-lg mt-3">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{cards} cards</span>
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{lastStudied}</span>
                    </div>
                </div>
                <Button className="w-full">Study Now</Button>
            </CardContent>
        </Card>
    )
}
