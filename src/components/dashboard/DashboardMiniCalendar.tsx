import { useMemo, useState } from "react"
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLearningPathPlan } from "@/hooks/useLearningPathPlan"
import { getLearningPathItemsForDate } from "@/lib/learningPathPlan"
import { cn } from "@/lib/utils"

interface DashboardMiniCalendarProps {
    className?: string
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

function formatDateToLocalString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DashboardMiniCalendar({ className }: DashboardMiniCalendarProps) {
    const [viewMode, setViewMode] = useState<"week" | "month">("week")
    const [anchorDate, setAnchorDate] = useState(() => new Date())
    const plan = useLearningPathPlan()

    const now = anchorDate
    const today = formatDateToLocalString(new Date())
    const [selectedDate, setSelectedDate] = useState(today)
    const [selectedScope, setSelectedScope] = useState("all")

    const weekDays = useMemo(() => {
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - dayOfWeek)
        startOfWeek.setHours(0, 0, 0, 0)
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(startOfWeek)
            d.setDate(startOfWeek.getDate() + i)
            return d
        })
    }, [now])

    const monthDaysCount = getDaysInMonth(now.getFullYear(), now.getMonth())
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay()

    const moveWindow = (direction: -1 | 1) => {
        setAnchorDate((prev) => {
            const d = new Date(prev)
            if (viewMode === "week") {
                d.setDate(d.getDate() + direction * 7)
            } else {
                d.setMonth(d.getMonth() + direction)
            }
            return d
        })
    }

    const documentOptions = useMemo(() => {
        const seen = new Map<string, string>()

        for (const item of plan.items) {
            if (item.kind === "planned_review" && item.documentId && item.documentTitle && !seen.has(item.documentId)) {
                seen.set(item.documentId, item.documentTitle)
            }
            if (item.kind === "adaptive_task" && item.task.documentId && item.task.documentTitle && !seen.has(item.task.documentId)) {
                seen.set(item.task.documentId, item.task.documentTitle)
            }
            if (item.kind === "goal_marker" && item.documentId && item.documentTitle && !seen.has(item.documentId)) {
                seen.set(item.documentId, item.documentTitle)
            }
        }

        return Array.from(seen.entries())
            .map(([id, title]) => ({ id, title }))
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [plan.items])

    const filteredItems = useMemo(() => {
        if (selectedScope === "all") return plan.items

        return plan.items.filter((item) => {
            if (item.kind === "planned_review") return item.documentId === selectedScope
            if (item.kind === "adaptive_task") return item.task.documentId === selectedScope
            return item.documentId === selectedScope
        })
    }, [plan.items, selectedScope])

    const getCount = (dateObj: Date) => {
        const dateStr = formatDateToLocalString(dateObj)
        return getLearningPathItemsForDate(filteredItems, dateStr).length
    }

    const selectedItems = useMemo(
        () => getLearningPathItemsForDate(filteredItems, selectedDate),
        [filteredItems, selectedDate],
    )

    const selectedDateLabel = useMemo(
        () => new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        [selectedDate],
    )

    const itemLabel = (item: (typeof selectedItems)[number]) => {
        if (item.kind === "planned_review") return `Review: ${item.conceptName}`
        if (item.kind === "adaptive_task") return `${item.task.type === "quiz" ? "Quiz" : item.task.type === "flashcards" ? "Cards" : "Review"}: ${item.task.documentTitle}`
        return `Goal: ${item.title}`
    }

    return (
        <Card variant="dashboard" className={cn("flex min-h-0 flex-col", className)}>
            <CardHeader density="compact" className="">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                            <CardTitle className="truncate text-sm">Learning Paths</CardTitle>
                        </div>
                        <Select value={selectedScope} onValueChange={setSelectedScope}>
                            <SelectTrigger className="h-7 w-[128px] text-[11px]">
                                <SelectValue placeholder="Select file" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All files / goals</SelectItem>
                                {documentOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                        {option.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWindow(-1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-medium text-muted-foreground">
                                {viewMode === "week"
                                    ? `${weekDays[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekDays[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                                    : now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWindow(1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setViewMode("week")}
                                className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    viewMode === "week" ? "bg-primary/10 text-primary" : "text-muted-foreground",
                                )}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("month")}
                                className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    viewMode === "month" ? "bg-primary/10 text-primary" : "text-muted-foreground",
                                )}
                            >
                                Month
                            </button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent density="compact" className="min-h-0 flex-1 overflow-y-auto">
                {plan.isLoading ? (
                    <div className="flex h-full min-h-[90px] items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : viewMode === "week" ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {weekDays.map((dateObj) => {
                            const dateStr = formatDateToLocalString(dateObj)
                            const count = getCount(dateObj)
                            const isToday = dateStr === today
                            const isSelected = dateStr === selectedDate
                            return (
                                <button
                                    type="button"
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={cn(
                                        "w-[74px] shrink-0 rounded-xl border px-2 py-2 text-center shadow-sm transition-colors",
                                        isSelected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : count > 0
                                                ? "border-primary/30 bg-primary/10"
                                                : "border-border bg-card",
                                        isToday && !isSelected && "ring-1 ring-primary/35",
                                    )}
                                >
                                    <p className={cn("text-[10px] font-semibold", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
                                        {dateObj.toLocaleDateString(undefined, { weekday: "short" })}
                                    </p>
                                    <p className={cn("mt-0.5 text-xl font-bold leading-none", isSelected ? "text-primary-foreground" : "text-foreground")}>
                                        {dateObj.getDate()}
                                    </p>
                                    <p className={cn("mt-1 text-[9px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                        {count > 0 ? `${count} planned` : "No tasks"}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 place-items-center">
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`e-${i}`} className="h-8 w-8 rounded-full bg-muted/20" />
                            ))}
                            {Array.from({ length: monthDaysCount }).map((_, i) => {
                                const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
                                const dateStr = formatDateToLocalString(d)
                                const count = getCount(d)
                                const isToday = dateStr === today
                                const isSelected = dateStr === selectedDate
                                return (
                                    <button
                                        type="button"
                                        key={dateStr}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={cn(
                                            "h-8 w-8 rounded-full border shadow-sm transition-colors",
                                            isSelected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : count > 0
                                                    ? "border-primary/30 bg-primary/10"
                                                    : "border-border bg-card",
                                            isToday && !isSelected && "ring-1 ring-primary/35",
                                        )}
                                    >
                                        <div className="flex h-full w-full items-center justify-center">
                                            <span className={cn("text-[10px] font-semibold", isSelected ? "text-primary-foreground" : "text-foreground")}>{i + 1}</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
                {!plan.isLoading && (
                    <div className="mt-3 rounded-md border bg-muted/20 p-2">
                        <p className="text-[11px] font-semibold text-foreground">
                            {selectedDateLabel}
                        </p>
                        {selectedItems.length === 0 ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">No items plotted for this day.</p>
                        ) : (
                            <div className="mt-1 space-y-1">
                                {selectedItems.slice(0, 4).map((item) => (
                                    <div key={item.id} className="rounded bg-background px-2 py-1 text-[11px]">
                                        {itemLabel(item)}
                                    </div>
                                ))}
                                {selectedItems.length > 4 && (
                                    <p className="text-[10px] text-muted-foreground">
                                        +{selectedItems.length - 4} more
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
