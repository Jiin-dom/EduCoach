import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { DashboardContent } from "@/components/dashboard/DashboardContent"

export default function DashboardPage() {
    return (
        <div className="h-screen overflow-hidden bg-background">
            <DashboardHeader />
            <main className="container mx-auto h-[calc(100vh-81px)] overflow-hidden px-4 py-6">
                <DashboardContent />
            </main>
        </div>
    )
}
