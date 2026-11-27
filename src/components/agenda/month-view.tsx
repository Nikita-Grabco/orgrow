import { CATEGORIES } from "@/config/categories";
import { dayOfMonth, isSameMonthISO, monthGridISO, WEEKDAY_INITIALS } from "@/lib/dates";
import { getActivitiesOn } from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Activity, Task } from "@/types/planner";

interface MonthViewProps {
  anchorISO: string;
  activities: Activity[];
  tasks: Task[];
  todayISO: string | null;
  onSelectDay: (dateISO: string) => void;
}

/** Full month grid. Clicking a day opens it in the day view. */
export function MonthView({ anchorISO, activities, tasks, todayISO, onSelectDay }: MonthViewProps) {
  const dates = monthGridISO(anchorISO);

  return (
    <div className="surface p-2 sm:p-4">
      <div className="grid grid-cols-7 gap-1 pb-2">
        {WEEKDAY_INITIALS.map((initial) => (
          <span
            key={initial}
            className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {initial}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dates.map((dateISO) => {
          const dayActivities = getActivitiesOn(activities, dateISO);
          const pendingTasks = tasks.filter(
            (task) => task.dueDate === dateISO && !task.completed,
          ).length;
          const inMonth = isSameMonthISO(dateISO, anchorISO);
          const isToday = dateISO === todayISO;

          return (
            <button
              key={dateISO}
              type="button"
              onClick={() => onSelectDay(dateISO)}
              aria-label={`Ver el día ${dayOfMonth(dateISO)}`}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col gap-1 rounded-xl border border-border/70 p-1.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50 sm:min-h-24",
                !inMonth && "opacity-35",
                isToday && "border-primary/60 bg-primary-soft/40",
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  isToday ? "text-primary" : "text-foreground",
                )}
              >
                {dayOfMonth(dateISO)}
              </span>

              <div className="flex flex-wrap gap-0.5">
                {dayActivities.slice(0, 4).map((activity) => (
                  <span
                    key={activity.id}
                    className={cn("size-1.5 rounded-full", CATEGORIES[activity.category].dot)}
                  />
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-0.5">
                {dayActivities.slice(0, 1).map((activity) => (
                  <span
                    key={activity.id}
                    className={cn(
                      "hidden truncate text-[10px] font-medium sm:block",
                      CATEGORIES[activity.category].ink,
                    )}
                  >
                    {activity.start} {activity.title}
                  </span>
                ))}
                {pendingTasks > 0 && (
                  <span className="text-[10px] font-semibold text-muted-foreground sm:hidden">
                    {pendingTasks}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
