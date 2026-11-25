import { Check, Minus, Pencil, Plus } from "lucide-react";

import { HabitHeatmap } from "@/components/habits/habit-heatmap";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/categories";
import {
  dayRatio,
  formatProgress,
  frequencyLabel,
  isDone,
  isScheduledOn,
  logValue,
  roundValue,
  weekProgress,
  type HabitLogIndex,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Habit } from "@/types/planner";

interface HabitCardProps {
  habit: Habit;
  index: HabitLogIndex;
  /** Day being logged. */
  dateISO: string;
  todayISO: string;
  onSelectDay: (dateISO: string) => void;
}

export function HabitCard({ habit, index, dateISO, todayISO, onSelectDay }: HabitCardProps) {
  const { setHabitValue, openEditHabit } = usePlanner();
  const category = CATEGORIES[habit.category];
  const value = logValue(index, habit.id, dateISO);
  const done = isDone(habit, value);
  const week = weekProgress(habit, index, dateISO);
  const offPlan = !isScheduledOn(habit, dateISO);

  return (
    <article className="surface min-w-0 space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", category.dot)} />
            <h2 className="truncate text-base font-bold text-foreground">{habit.name}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {frequencyLabel(habit.frequency)} · {week.done}/{week.goal} esta semana
            {offPlan && " · hoy no toca"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openEditHabit(habit.id)}
          aria-label={`Editar ${habit.name}`}
          className="-mr-2 -mt-1 size-8 text-muted-foreground"
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {habit.kind === "check" ? (
        <button
          type="button"
          onClick={() => setHabitValue(habit.id, dateISO, done ? 0 : 1)}
          aria-pressed={done}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done
              ? "border-primary bg-primary-soft text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border",
              done ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {done && <Check className="size-4" strokeWidth={3} />}
          </span>
          {done ? "Hecho" : "Marcar como hecho"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHabitValue(habit.id, dateISO, roundValue(value - habit.step))}
              disabled={value <= 0}
              aria-label={`Restar de ${habit.name}`}
              className="size-10 shrink-0 rounded-xl"
            >
              <Minus />
            </Button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-center text-sm font-bold tabular-nums",
                  done ? "text-primary" : "text-foreground",
                )}
              >
                {formatProgress(habit, value)}
              </p>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={habit.target}
                aria-valuenow={Math.min(value, habit.target)}
                aria-label={`Progreso de ${habit.name}`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.round(dayRatio(habit, value) * 100)}%` }}
                />
              </div>
            </div>
            <Button
              size="icon"
              onClick={() => setHabitValue(habit.id, dateISO, roundValue(value + habit.step))}
              aria-label={`Sumar a ${habit.name}`}
              className="size-10 shrink-0 rounded-xl"
            >
              <Plus />
            </Button>
          </div>
        </div>
      )}

      <HabitHeatmap
        habit={habit}
        index={index}
        todayISO={todayISO}
        selectedISO={dateISO}
        onSelectDay={onSelectDay}
      />
    </article>
  );
}
