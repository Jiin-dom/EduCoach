import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { FilesContent } from "@/components/files/FilesContent"

export default function FilesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <FilesContent />
            </main>
        </div>
    )
}
