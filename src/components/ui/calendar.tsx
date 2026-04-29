import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useNavigation } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center items-center h-10 relative mb-4",
        caption_label: "text-sm font-bold tracking-tight",
        nav: "hidden", // Hide default nav
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-bold text-[10px] uppercase tracking-widest text-center",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          "h-9 w-9 p-0 font-medium rounded-full transition-all flex items-center justify-center mx-auto text-sm hover:bg-primary/10 hover:text-primary focus:bg-primary focus:text-primary-foreground"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary! text-primary-foreground! opacity-100! shadow-lg shadow-primary/40 rounded-full scale-105 font-bold z-30",
        today: "text-amber-600! font-black! bg-amber-50! ring-2 ring-amber-200! rounded-full",
        outside:
          "day-outside text-muted-foreground opacity-20 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-20 pointer-events-none",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
            const Icon = orientation === "left" ? ChevronLeft : ChevronRight
            return <Icon className="h-4 w-4" />
        },
        MonthCaption: (captionProps) => {
            const { goToMonth, nextMonth, previousMonth } = useNavigation()
            
            // Extract month and year from captionProps
            // In v9, captionProps has calendarMonth
            const date = captionProps.calendarMonth.date
            const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

            return (
                <div className="flex items-center justify-between w-full h-10 mb-2">
                    <button
                        type="button"
                        onClick={() => previousMonth && goToMonth(previousMonth)}
                        disabled={!previousMonth}
                        className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "h-8 w-8 bg-transparent p-0 opacity-80 hover:opacity-100 rounded-full transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-20"
                        )}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold tracking-tight">{label}</span>
                    <button
                        type="button"
                        onClick={() => nextMonth && goToMonth(nextMonth)}
                        disabled={!nextMonth}
                        className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "h-8 w-8 bg-transparent p-0 opacity-80 hover:opacity-100 rounded-full transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-20"
                        )}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
