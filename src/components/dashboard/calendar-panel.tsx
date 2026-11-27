import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ActivityList } from "@/components/activities/activity-list";
import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/categories";
import { useToday } from "@/hooks/use-today";
import {
  currentTimeString,
  dayOfMonth,
  dueDateLabel,
  isSameMonthISO,
  longDateLabel,
  monthGridISO,
  monthLabel,
  shiftISOMonths,
  toISODate,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { getActivitiesOn, getUpcomingActivities, groupActivitiesByDate } from "@/lib/planner";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";

const MAX_CHIPS = 2;

/** Month calendar with its events, plus the agenda of the selected day beside it. */
export function CalendarPanel() {
  const { activities, tasks } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;
  const nowTime = today ? currentTimeString(today) : null;

  const [anchorISO, setAnchorISO] = useState<string | null>(null);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  // `today` only exists after hydration: start on the current month and day.
  useEffect(() => {
    if (todayISO) {
      setAnchorISO((current) => current ?? todayISO);
      setSelectedISO((current) => current ?? todayISO);
    }
  }, [todayISO]);

  const anchor = anchorISO ?? todayISO;
  const selected = selectedISO ?? todayISO;
  const dates = anchor ? monthGridISO(anchor) : [];

  const selectedActivities = getActivitiesOn(activities, selected);
  const isTodaySelected = selected !== null && selected === todayISO;
  // On today, also show what comes next so the panel answers "what's coming up".
  const followingGroups = isTodaySelected
    ? groupActivitiesByDate(
        getUpcomingActivities(activities, todayISO, nowTime).filter(
          (activity) => activity.date !== todayISO,
        ),
      ).slice(0, 3)
    : [];

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-3">
      <section className="surface min-w-0 p-3 sm:p-5 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes anterior"
            onClick={() => anchor && setAnchorISO(shiftISOMonths(anchor, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes siguiente"
            onClick={() => anchor && setAnchorISO(shiftISOMonths(anchor, 1))}
          >
            <ChevronRight />
          </Button>
          <h2 className="min-w-0 flex-1 truncate font-display font-semibold text-xl text-foreground sm:text-2xl">
            {anchor ? monthLabel(anchor) : " "}
          </h2>
          {todayISO && (anchor !== todayISO || selected !== todayISO) && (
            <Chip
              onClick={() => {
                setAnchorISO(todayISO);
                setSelectedISO(todayISO);
              }}
            >
              Hoy
            </Chip>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 pb-1">
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
            const inMonth = anchor !== null && isSameMonthISO(dateISO, anchor);
            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selected;
            const extra = dayActivities.length - MAX_CHIPS;

            return (
              <button
                key={dateISO}
                type="button"
                onClick={() => setSelectedISO(dateISO)}
                aria-label={`Ver el día ${dayOfMonth(dateISO)}`}
                aria-pressed={isSelected}
                className={cn(
                  "flex min-h-14 min-w-0 cursor-pointer flex-col gap-1 rounded-xl border border-transparent p-1 text-left transition-colors hover:border-border hover:bg-secondary/50 sm:min-h-24 sm:p-1.5",
                  !inMonth && "opacity-35",
                  isToday && "bg-primary-soft/40",
                  isSelected && "border-primary/60",
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

                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {dayActivities.slice(0, 4).map((activity) => (
                    <span
                      key={activity.id}
                      className={cn("size-1.5 rounded-full", CATEGORIES[activity.category].dot)}
                    />
                  ))}
                </div>

                <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {dayActivities.slice(0, MAX_CHIPS).map((activity) => {
                    const category = CATEGORIES[activity.category];
                    return (
                      <span
                        key={activity.id}
                        className={cn(
                          "truncate rounded px-1 text-[10px] font-medium leading-4",
                          category.soft,
                          category.ink,
                        )}
                      >
                        {activity.title}
                      </span>
                    );
                  })}
                  {extra > 0 && (
                    <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                      +{extra} más
                    </span>
                  )}
                  {pendingTasks > 0 && dayActivities.length === 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      {pendingTasks} tarea{pendingTasks === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface min-w-0 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-foreground">
            <span className="text-primary [&_svg]:size-4">
              <CalendarDays />
            </span>
            <span className="truncate">
              {selected ? (isTodaySelected ? "Hoy y próximas" : longDateLabel(selected)) : " "}
            </span>
          </h2>
          <Link
            to="/agenda"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Agenda <ArrowRight className="size-3" />
          </Link>
        </div>

        {selectedActivities.length === 0 && followingGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isTodaySelected ? "Sin actividades hoy ni próximas." : "Sin actividades este día."}
          </p>
        ) : (
          <div className="space-y-5">
            {selectedActivities.length > 0 && (
              <div>
                {isTodaySelected && <p className="eyebrow mb-2.5">Hoy</p>}
                <ActivityList activities={selectedActivities} />
              </div>
            )}
            {followingGroups.map((group) => (
              <div key={group.date}>
                <p className="eyebrow mb-2.5">{dueDateLabel(group.date, today)}</p>
                <ActivityList activities={group.activities} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
