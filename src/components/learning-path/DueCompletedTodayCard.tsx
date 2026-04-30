import { ArrowUpRight, CheckCircle2, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface LearningPathTodayItem {
    id: string
    title: string
    documentTitle: string | null
    itemType?: "quiz" | "flashcards" | "review"
    status?: string
}

interface DueCompletedTodayCardProps {
    dueItems: LearningPathTodayItem[]
    completedItems: LearningPathTodayItem[]
    onDueItemClick: (item: LearningPathTodayItem) => void
    onCompletedItemClick: (item: LearningPathTodayItem) => void
    dismissedDueItemIds?: Record<string, true>
    className?: string
}

export function DueCompletedTodayCard({
    dueItems,
    completedItems,
    onDueItemClick,
    onCompletedItemClick,
    dismissedDueItemIds,
    className,
}: DueCompletedTodayCardProps) {
    const visibleDueItems = dueItems.filter((item) => !dismissedDueItemIds?.[item.id])
    const hasContent = visibleDueItems.length > 0 || completedItems.length > 0

    if (!hasContent) return null

    return (
        <Card className={`mb-6 border-red-200 bg-red-50/10 shadow-sm overflow-hidden ${className ?? ""}`}>
            <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-red-100">
                {visibleDueItems.length > 0 && (
                    <div className="flex-1">
                        <CardHeader className="pb-2 pt-3 px-4 bg-red-50/50">
                            <CardTitle className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-600">
                                <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    Due Today
                                </div>
                                <span className="bg-red-100 px-1.5 py-0.5 rounded text-[10px]">{visibleDueItems.length}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white/50 overflow-y-auto max-h-[200px] scrollbar-thin">
                            <div className="flex flex-col gap-2">
                                {visibleDueItems.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onDueItemClick(item)}
                                        className="flex items-center justify-between rounded-lg border bg-card p-2.5 shadow-sm transition-all hover:border-red-400 hover:shadow-md text-left group"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="truncate font-bold text-xs tracking-tight group-hover:text-red-600 transition-colors">
                                                {item.title}
                                                {item.status && item.status !== "ready" && (
                                                    <span className="ml-2 text-[8px] opacity-60 italic lowercase">({item.status})</span>
                                                )}
                                            </p>
                                            {item.documentTitle && (
                                                <p className="truncate text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{item.documentTitle}</p>
                                            )}
                                        </div>
                                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-red-500" />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </div>
                )}

                {completedItems.length > 0 && (
                    <div className="flex-1">
                        <CardHeader className="pb-2 pt-3 px-4 bg-green-50/50">
                            <CardTitle className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-green-600">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Completed Today
                                </div>
                                <span className="bg-green-100 px-1.5 py-0.5 rounded text-[10px]">{completedItems.length}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white/50 overflow-y-auto max-h-[200px] scrollbar-thin">
                            <div className="flex flex-col gap-2">
                                {completedItems.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onCompletedItemClick(item)}
                                        className="flex items-center justify-between rounded-lg border bg-card p-2.5 shadow-sm transition-all hover:border-green-400 hover:shadow-md text-left group"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="truncate font-bold text-xs tracking-tight group-hover:text-green-600 transition-colors">{item.title}</p>
                                            {item.documentTitle && (
                                                <p className="truncate text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{item.documentTitle}</p>
                                            )}
                                        </div>
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </div>
                )}
            </div>
        </Card>
    )
}
