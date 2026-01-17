import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"

export default function LearningPathPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <LearningPathContent />
        </div>
    )
}
