import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { QuizView } from "@/components/quizzes/QuizView"

export default function QuizSessionPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <QuizView />
            </main>
        </div>
    )
}
