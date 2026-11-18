import { CATEGORIES } from "@/config/categories";
import { dayOfMonth, shortWeekday } from "@/lib/dates";
import { getActivitiesOn } from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Activity, Task } from "@/types/planner";

interface WeekViewProps {
  dates: string[];
  activities: Activity[];
  tasks: Task[];
  todayISO: string | null;
  onSelectDay: (dateISO: string) => void;
}

/** Seven columns (two on tablets, one on phones) with a preview of each day. */
export function WeekView({ dates, activities, tasks, todayISO, onSelectDay }: WeekViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2">
      {dates.map((dateISO) => {
        const dayActivities = getActivitiesOn(activities, dateISO);
        const pendingTasks = tasks.filter(
          (task) => task.dueDate === dateISO && !task.completed,
        ).length;
        const isToday = dateISO === todayISO;

        return (
          <button
            key={dateISO}
            type="button"
            onClick={() => onSelectDay(dateISO)}
            aria-label={`Ver el día ${dateISO}`}
            className={cn(
              "flex min-h-32 cursor-pointer flex-col gap-2 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/40",
              isToday ? "border-primary/60 bg-primary-soft/30" : "border-border",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wide",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {shortWeekday(dateISO)}
              </span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  isToday ? "text-primary" : "text-foreground",
                )}
              >
                {dayOfMonth(dateISO)}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1">
              {dayActivities.slice(0, 3).map((activity) => (
                <span
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                    CATEGORIES[activity.category].soft,
                    CATEGORIES[activity.category].ink,
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", CATEGORIES[activity.category].dot)} />
                  <span className="tabular-nums">{activity.start}</span>
                  <span className="truncate">{activity.title}</span>
                </span>
              ))}
              {dayActivities.length > 3 && (
                <span className="px-1.5 text-[11px] font-semibold text-muted-foreground">
                  +{dayActivities.length - 3} más
                </span>
              )}
              {dayActivities.length === 0 && (
                <span className="px-1.5 text-[11px] text-muted-foreground/70">Sin actividades</span>
              )}
            </div>

            {pendingTasks > 0 && (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                {pendingTasks} tarea{pendingTasks === 1 ? "" : "s"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
