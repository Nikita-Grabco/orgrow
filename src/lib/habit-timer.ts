import { toISODate } from "@/lib/dates";
import { roundValue } from "@/lib/habits";
import type { Habit } from "@/types/planner";

/**
 * Cronómetro de hábitos de tiempo. Solo se guarda la hora de inicio de cada
 * cronómetro (por dispositivo, en localStorage): el tiempo transcurrido se
 * calcula con el reloj, así que sigue contando aunque se cierre la app y se
 * completa al volver a abrirla.
 */

export interface RunningTimer {
  /** Epoch millis del inicio. */
  startedAt: number;
  /** Día del hábito al que se suma el tiempo, "YYYY-MM-DD". */
  date: string;
}

export type TimerMap = Record<string, RunningTimer>;

export const HABIT_TIMERS_KEY = "orgrow:habit-timers";

/** Segundos que vale una unidad del hábito, o `null` si no es un hábito de tiempo. */
export function secondsPerUnit(habit: Habit): number | null {
  if (habit.kind === "time") return 60;
  if (habit.kind !== "count") return null;
  const unit = habit.unit?.trim().toLowerCase();
  if (unit === "min" || unit === "minutos") return 60;
  if (unit === "h" || unit === "horas") return 3600;
  return null;
}

export function isTimedHabit(habit: Habit): boolean {
  return secondsPerUnit(habit) !== null;
}

/** Unidades del hábito (min u h) que han pasado entre dos instantes. */
export function elapsedUnits(habit: Habit, startedAt: number, now: number): number {
  const perUnit = secondsPerUnit(habit);
  if (perUnit === null) return 0;
  return Math.max(0, now - startedAt) / 1000 / perUnit;
}

/** Valor del día tras sumar el cronómetro, sin pasar de la meta. */
export function valueAfterTimer(habit: Habit, current: number, elapsed: number): number {
  return roundValue(Math.min(habit.target, current + elapsed));
}

/** Si lo registrado más el cronómetro ya alcanza la meta. */
export function reachesTarget(habit: Habit, current: number, elapsed: number): boolean {
  return current + elapsed >= habit.target;
}

/** "01:23:45" */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

export function parseTimers(raw: string | null): TimerMap {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return {};
    const result: TimerMap = {};
    for (const [habitId, value] of Object.entries(data)) {
      if (typeof value !== "object" || value === null) continue;
      const { startedAt, date } = value as Record<string, unknown>;
      if (typeof startedAt === "number" && Number.isFinite(startedAt) && typeof date === "string") {
        result[habitId] = { startedAt, date };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/* ---- Almacén compartido entre pantallas (inicio y hábitos) ---- */

const EMPTY: TimerMap = {};
let timers: TimerMap = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): TimerMap {
  try {
    return parseTimers(window.localStorage.getItem(HABIT_TIMERS_KEY));
  } catch {
    return {};
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function persist(next: TimerMap) {
  timers = Object.keys(next).length === 0 ? EMPTY : next;
  try {
    window.localStorage.setItem(HABIT_TIMERS_KEY, JSON.stringify(timers));
  } catch {
    // sin storage: el cronómetro solo dura mientras la app siga abierta
  }
  emit();
}

export function subscribeTimers(listener: () => void): () => void {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    const stored = readStorage();
    timers = Object.keys(stored).length === 0 ? EMPTY : stored;
    // Otra pestaña ha cambiado los cronómetros.
    window.addEventListener("storage", (event) => {
      if (event.key === HABIT_TIMERS_KEY) {
        const next = readStorage();
        timers = Object.keys(next).length === 0 ? EMPTY : next;
        emit();
      }
    });
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTimers(): TimerMap {
  return timers;
}

export function getServerTimers(): TimerMap {
  return EMPTY;
}

export function startTimer(habitId: string, now: Date): void {
  if (timers[habitId]) return;
  persist({ ...timers, [habitId]: { startedAt: now.getTime(), date: toISODate(now) } });
}

/** Quita el cronómetro y devuelve lo que llevaba, o `null` si no estaba en marcha. */
export function takeTimer(habitId: string): RunningTimer | null {
  const running = timers[habitId];
  if (!running) return null;
  const { [habitId]: _removed, ...rest } = timers;
  persist(rest);
  return running;
}
