import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers, Clock, ChevronRight } from "lucide-react"

interface FlashcardCardProps {
    id: string
    title: string
    cards: number
    subject: string
    lastStudied: string
}

export function FlashcardCard({ id, title, cards, subject, lastStudied }: FlashcardCardProps) {
    return (
        <Card
            className="group relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/10"
            data-flashcard-id={id}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-5 h-24"
                style={{ perspective: "1000px" }}
            >
                <div className="absolute inset-x-8 top-0 h-16 rounded-xl border border-border/50 bg-card/90 shadow-sm will-change-transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg]" />
                <div className="absolute inset-x-4 top-2 h-16 rounded-xl border border-border/50 bg-card/90 shadow-sm will-change-transform transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-[1.5deg]" />
                <div className="absolute inset-x-0 top-4 h-16 rounded-xl border border-primary/15 bg-background/95 shadow-md will-change-transform transition-transform duration-300 group-hover:translate-y-0.5 group-hover:rotate-[0.75deg]" />
            </div>

            <CardHeader className="relative z-10 pt-24">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Layers className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">
                            {cards} card{cards !== 1 ? "s" : ""}
                        </div>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {subject}
                    </span>
                </div>
                <CardTitle className="mt-4 text-xl leading-tight">{title}</CardTitle>
            </CardHeader>

            <CardContent className="relative z-10 space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{lastStudied}</span>
                    </div>
                    <span className="text-xs">Last reviewed</span>
                </div>

                <Button className="h-10 w-full gap-1.5 rounded-xl">
                    Study now
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
            </CardContent>
        </Card>
    )
}
