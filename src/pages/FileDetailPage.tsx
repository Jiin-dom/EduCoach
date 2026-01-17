import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { FileViewer } from "@/components/files/FileViewer"

export default function FileDetailPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <FileViewer />
            </main>
        </div>
    )
}
