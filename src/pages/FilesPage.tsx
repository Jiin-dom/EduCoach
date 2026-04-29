import { Suspense, lazy } from "react"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { Skeleton } from "@/components/ui/skeleton"

const FilesContent = lazy(async () => {
    const mod = await import("@/components/files/FilesContent")
    return { default: mod.FilesContent }
})

function FilesPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-80 max-w-[70vw]" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <Skeleton className="h-10 w-32 rounded-md" />
                </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-md" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function FilesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-8">
                <Suspense fallback={<FilesPageSkeleton />}>
                    <FilesContent />
                </Suspense>
            </main>
        </div>
    )
}
