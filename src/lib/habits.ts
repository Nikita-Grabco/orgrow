import { parseISODate, shiftISODate, weekDatesISO } from "@/lib/dates";
import type { Habit, HabitFrequency, HabitLog } from "@/types/planner";

/** Fast lookup of "how much of this habit was done on this day". */
export type HabitLogIndex = Map<string, number>;

const key = (habitId: string, date: string) => `${habitId}|${date}`;

export function indexLogs(logs: HabitLog[]): HabitLogIndex {
  const index: HabitLogIndex = new Map();
  for (const log of logs) index.set(key(log.habitId, log.date), log.value);
  return index;
}

export function logValue(index: HabitLogIndex, habitId: string, date: string): number {
  return index.get(key(habitId, date)) ?? 0;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

/** Whether the habit is planned for that day. "X times a week" habits count every day. */
export function isScheduledOn(habit: Habit, iso: string): boolean {
  if (habit.frequency.type === "weekdays") return habit.frequency.days.includes(weekdayIndex(iso));
  return true;
}

export function isDone(habit: Habit, value: number): boolean {
  return value >= habit.target;
}

/** Clamped 0–1 progress of the day. */
export function dayRatio(habit: Habit, value: number): number {
  if (habit.target <= 0 || value <= 0) return 0;
  return Math.min(1, value / habit.target);
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(habit: Habit, value: number): HeatLevel {
  const ratio = dayRatio(habit, value);
  if (ratio <= 0) return 0;
  if (ratio < 1 / 3) return 1;
  if (ratio < 2 / 3) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/** Days of the week (Mon–Sun) that contain `anchorISO` in which the habit was completed. */
export function weekProgress(
  habit: Habit,
  index: HabitLogIndex,
  anchorISO: string,
): { done: number; goal: number } {
  const done = weekDatesISO(anchorISO).filter((date) =>
    isDone(habit, logValue(index, habit.id, date)),
  ).length;

  const goal =
    habit.frequency.type === "daily"
      ? 7
      : habit.frequency.type === "weekdays"
        ? habit.frequency.days.length
        : habit.frequency.times;

  return { done: Math.min(done, goal), goal };
}

/** Columns of 7 dates (Mon–Sun) ending in the week of `todayISO`, oldest first. */
export function heatmapWeeks(todayISO: string, weeks: number): string[][] {
  const currentMonday = weekDatesISO(todayISO)[0] ?? todayISO;
  return Array.from({ length: weeks }, (_, column) => {
    const monday = shiftISODate(currentMonday, -(weeks - 1 - column) * 7);
    return weekDatesISO(monday);
  });
}

export function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return String(roundValue(value)).replace(".", ",");
}

export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Amount of a day, without the goal: "750 ml" style text for the heatmap tooltip. */
export function formatAmount(habit: Habit, value: number): string {
  if (habit.kind === "check") return value >= 1 ? "Hecho" : "Sin hacer";
  if (habit.kind === "time") return formatMinutes(value);
  return `${formatNumber(value)}${habit.unit ? ` ${habit.unit}` : ""}`;
}

/** "0,5 / 1 L", "30 min / 1 h". */
export function formatProgress(habit: Habit, value: number): string {
  if (habit.kind === "check") return value >= 1 ? "Hecho" : "Pendiente";
  if (habit.kind === "time") return `${formatMinutes(value)} / ${formatMinutes(habit.target)}`;
  const unit = habit.unit ? ` ${habit.unit}` : "";
  return `${formatNumber(value)} / ${formatNumber(habit.target)}${unit}`;
}

const WEEKDAY_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

export function frequencyLabel(frequency: HabitFrequency): string {
  if (frequency.type === "daily") return "Cada día";
  if (frequency.type === "weekly") {
    return frequency.times === 1 ? "1 vez por semana" : `${frequency.times} veces por semana`;
  }
  const names = [...frequency.days].sort((a, b) => a - b).map((day) => WEEKDAY_SHORT[day] ?? "");
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Habits planned for a day, in creation order. */
export function habitsForDay(habits: Habit[], iso: string): Habit[] {
  return habits
    .filter((habit) => !habit.archived && isScheduledOn(habit, iso))
    .sort((a, b) => a.createdAt - b.createdAt);
}
