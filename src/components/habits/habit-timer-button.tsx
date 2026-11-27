import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHabitTimers } from "@/hooks/use-habit-timers";
import { formatClock } from "@/lib/habit-timer";
import type { Habit } from "@/types/planner";

/** Play/pausa de un hábito de tiempo, con el reloj en marcha. */
export function HabitTimerButton({ habit }: { habit: Habit }) {
  const { timers, now, start, stop } = useHabitTimers();
  const timer = timers[habit.id];

  if (timer) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="text-xs font-semibold tabular-nums text-primary"
          aria-label="Tiempo en marcha"
        >
          {formatClock(now - timer.startedAt)}
        </span>
        <Button
          size="icon-sm"
          onClick={() => stop(habit)}
          aria-label={`Parar el cronómetro de ${habit.name}`}
          className="rounded-full"
        >
          <Pause />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={() => start(habit)}
      aria-label={`Cronometrar ${habit.name}`}
      className="shrink-0 rounded-full"
    >
      <Play />
    </Button>
  );
}
