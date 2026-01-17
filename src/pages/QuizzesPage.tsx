import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { QuizzesContent } from "@/components/quizzes/QuizzesContent"

export default function QuizzesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <QuizzesContent />
            </main>
        </div>
    )
}
