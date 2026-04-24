import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { AnalyticsContent } from "@/components/analytics/AnalyticsContent"
import { Sparkles, Lightbulb, Compass } from "lucide-react"

export default function AnalyticsPage() {
    return (
        <div className="relative min-h-screen bg-background">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
            <DashboardHeader />
            <main className="container relative mx-auto px-4 py-8 md:py-10">
                <section className="mb-6 rounded-2xl border bg-card/70 p-5 shadow-sm backdrop-blur-sm md:mb-8 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Insights Workspace
                            </p>
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                Understand your learning story
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                                Track progress, spot weak areas early, and use trends to make smarter study decisions.
                            </p>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground md:min-w-72">
                            <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2">
                                <Compass className="mt-0.5 h-4 w-4 text-primary" />
                                <span>Start with Performance to see your strongest and weakest documents.</span>
                            </div>
                            <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2">
                                <Lightbulb className="mt-0.5 h-4 w-4 text-amber-500" />
                                <span>Use Trends weekly to check if your study habits are improving outcomes.</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
                    <AnalyticsContent />
                </section>
            </main>
        </div>
    )
}
