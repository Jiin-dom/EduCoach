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

  return (
    <div className="flex flex-wrap gap-[3px]">
      {weeks.map((cell) => {
        const intensity = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / maxCount) * 4))
        const bg = ["bg-muted", "bg-green-200", "bg-green-300", "bg-green-500", "bg-green-700"][intensity]

        return (
          <div
            key={cell.date}
            className={`h-3 w-3 rounded-sm ${bg}`}
            title={`${cell.date}: ${cell.count} question${cell.count !== 1 ? "s" : ""}`}
          />
        )
      })}
    </div>
  )
}
