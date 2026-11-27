import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { indexLogs, logValue } from "@/lib/habits";
import {
  elapsedUnits,
  getServerTimers,
  getTimers,
  reachesTarget,
  startTimer,
  subscribeTimers,
  takeTimer,
  valueAfterTimer,
} from "@/lib/habit-timer";
import { usePlanner } from "@/store/planner-store";
import type { Habit } from "@/types/planner";

/**
 * Cronómetros de hábitos en marcha. Suma el tiempo al registro del día al parar
 * y para solo cuando el tiempo registrado llega a la meta.
 */
export function useHabitTimers() {
  const { habits, habitLogs, setHabitValue } = usePlanner();
  const timers = useSyncExternalStore(subscribeTimers, getTimers, getServerTimers);
  const [now, setNow] = useState(() => Date.now());
  const running = Object.keys(timers).length > 0;

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const index = useMemo(() => indexLogs(habitLogs), [habitLogs]);

  const stop = useCallback(
    (habit: Habit) => {
      const taken = takeTimer(habit.id);
      if (!taken) return;
      const elapsed = elapsedUnits(habit, taken.startedAt, Date.now());
      const current = logValue(index, habit.id, taken.date);
      setHabitValue(habit.id, taken.date, valueAfterTimer(habit, current, elapsed));
    },
    [index, setHabitValue],
  );

  const start = useCallback((habit: Habit) => startTimer(habit.id, new Date()), []);

  // Al llegar a la meta el hábito se da por cumplido y el cronómetro se para.
  useEffect(() => {
    for (const habit of habits) {
      const timer = timers[habit.id];
      if (!timer) continue;
      const elapsed = elapsedUnits(habit, timer.startedAt, now);
      if (reachesTarget(habit, logValue(index, habit.id, timer.date), elapsed)) stop(habit);
    }
  }, [habits, index, now, stop, timers]);

  return { timers, now, start, stop };
}
