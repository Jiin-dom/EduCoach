import { useMemo } from "react"

export interface ActivityHeatmapDay {
  date: string
  count: number
}

export function ActivityHeatmap({ data }: { data: ActivityHeatmapDay[] }) {
  const weeks = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d.count]))
    const cells: { date: string; count: number }[] = []
    const today = new Date()

    for (let i = 89; i >= 0; i--) {
      const date = new Date(today)
      date.setUTCDate(date.getUTCDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      cells.push({ date: dateStr, count: map.get(dateStr) ?? 0 })
    }

    return cells
  }, [data])

  const maxCount = Math.max(1, ...weeks.map((week) => week.count))
  const totalQuestions = weeks.reduce((sum, day) => sum + day.count, 0)
  const activeDays = weeks.filter((day) => day.count > 0).length
  const avgPerActiveDay = activeDays > 0 ? (totalQuestions / activeDays).toFixed(1) : "0.0"
  const todayStr = new Date().toISOString().split("T")[0]

  let currentStreak = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].count > 0) currentStreak += 1
    else break
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total answered</p>
          <p className="text-sm font-semibold">{totalQuestions}</p>
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Active days</p>
          <p className="text-sm font-semibold">{activeDays}/90</p>
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Current streak</p>
          <p className="text-sm font-semibold">{currentStreak} day{currentStreak !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Avg on active days</p>
          <p className="text-sm font-semibold">{avgPerActiveDay}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {weeks.map((cell) => {
          const intensity = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / maxCount) * 4))
          const bg = [
            "bg-muted/70",
            "bg-primary/20",
            "bg-primary/40",
            "bg-primary/70",
            "bg-primary"
          ][intensity]
          const isToday = cell.date === todayStr

          return (
            <div
              key={cell.date}
              className={`h-3.5 w-3.5 rounded-[3px] ${bg} transition-all duration-200 hover:scale-125 hover:shadow-[0_0_8px_rgba(var(--primary),0.4)] ${isToday ? "ring-2 ring-primary/60 ring-offset-1" : ""}`}
              title={`${cell.date}: ${cell.count} question${cell.count !== 1 ? "s" : ""}`}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        <span>Less active</span>
        <div className="flex items-center gap-1">
          {["bg-muted/70", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"].map((color) => (
            <span key={color} className={`h-2.5 w-2.5 rounded-[2px] ${color}`} />
          ))}
        </div>
        <span>More active</span>
      </div>
    </div>
  )
}
