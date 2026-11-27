import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Flame, Plus, Repeat } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import {
  currentStreak,
  formatProgress,
  habitsForDay,
  indexLogs,
  isDone,
  logValue,
  roundValue,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";

/** Habits planned for today, loggable with one tap. */
export function TodayHabits() {
  const { habits, habitLogs, setHabitValue, openAddHabit } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;
  const index = useMemo(() => indexLogs(habitLogs), [habitLogs]);
  const planned = todayISO ? habitsForDay(habits, todayISO) : [];
  const doneCount = todayISO
    ? planned.filter((habit) => isDone(habit, logValue(index, habit.id, todayISO))).length
    : 0;

  return (
    <SectionCard
      title="Hábitos de hoy"
      icon={<Repeat />}
      action={
        planned.length > 0 ? (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {doneCount} de {planned.length}
          </span>
        ) : (
          <Link
            to="/habitos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Hábitos <ArrowRight className="size-3" />
          </Link>
        )
      }
    >
      {todayISO === null || planned.length === 0 ? (
        <EmptyState
          icon={<Repeat />}
          title="Sin hábitos para hoy"
          description="Crea un hábito y lo marcas desde aquí."
        />
      ) : (
        <ul className="space-y-1.5">
          {planned.map((habit) => {
            const value = logValue(index, habit.id, todayISO);
            const done = isDone(habit, value);
            const streak = currentStreak(habit, index, todayISO);

            return (
              <li key={habit.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                {habit.kind === "check" ? (
                  <button
                    type="button"
                    onClick={() => setHabitValue(habit.id, todayISO, done ? 0 : 1)}
                    aria-pressed={done}
                    aria-label={`${done ? "Desmarcar" : "Marcar"} ${habit.name}`}
                    className={cn(
                      "grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {done && <Check className="size-4" strokeWidth={3} />}
                  </button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Sumar a ${habit.name}`}
                    onClick={() =>
                      setHabitValue(habit.id, todayISO, roundValue(value + habit.step))
                    }
                    className="shrink-0 rounded-full"
                  >
                    {done ? <Check /> : <Plus />}
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-semibold",
                      done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {habit.name}
                  </p>
                  {habit.kind !== "check" && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatProgress(habit, value)}
                    </p>
                  )}
                </div>
                {streak > 1 && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    <Flame className="size-3.5 text-primary" />
                    {streak}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
