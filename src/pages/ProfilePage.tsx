import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { ProfileContent } from "@/components/profile/ProfileContent"

export default function ProfilePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <ProfileContent />
            </main>
        </div>
    )
}
