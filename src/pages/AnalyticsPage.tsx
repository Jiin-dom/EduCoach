import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { AnalyticsContent } from "@/components/analytics/AnalyticsContent"

export default function AnalyticsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <AnalyticsContent />
            </main>
        </div>
    )
}
