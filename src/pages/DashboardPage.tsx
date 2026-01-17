import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { DashboardContent } from "@/components/dashboard/DashboardContent"

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <DashboardContent />
            </main>
        </div>
    )
}
