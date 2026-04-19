import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DocumentAnalyticsContent } from '@/components/analytics/DocumentAnalyticsContent'

export default function DocumentAnalyticsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <DocumentAnalyticsContent />
            </main>
        </div>
    )
}
