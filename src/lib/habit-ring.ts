import { monthDatesISO } from "@/lib/dates";
import { dayRatio, isDone, isScheduledOn, logValue, type HabitLogIndex } from "@/lib/habits";
import type { Habit } from "@/types/planner";

/** Grados que ocupa el mes en el círculo; el resto queda abierto, como en un reloj sin cerrar. */
export const RING_SPAN_DEGREES = 310;

/** Punto del círculo; el ángulo se mide en grados desde arriba, en sentido horario. */
export function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Trazado de un sector anular entre dos radios y dos ángulos. */
export function arcPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startDegrees: number,
  endDegrees: number,
): string {
  const a = polar(cx, cy, outerRadius, startDegrees);
  const b = polar(cx, cy, outerRadius, endDegrees);
  const c = polar(cx, cy, innerRadius, endDegrees);
  const d = polar(cx, cy, innerRadius, startDegrees);
  const large = endDegrees - startDegrees > 180 ? 1 : 0;
  return [
    `M ${round(a.x)} ${round(a.y)}`,
    `A ${outerRadius} ${outerRadius} 0 ${large} 1 ${round(b.x)} ${round(b.y)}`,
    `L ${round(c.x)} ${round(c.y)}`,
    `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${round(d.x)} ${round(d.y)}`,
    "Z",
  ].join(" ");
}

/** Ángulo inicial y final de cada día del mes (`gap` grados de separación entre días). */
export function daySlices(
  days: number,
  gap = 1.2,
  span = RING_SPAN_DEGREES,
): { start: number; end: number; mid: number }[] {
  const step = span / days;
  return Array.from({ length: days }, (_, i) => ({
    start: i * step + gap / 2,
    end: (i + 1) * step - gap / 2,
    mid: i * step + step / 2,
  }));
}

export type RingCellState = "done" | "partial" | "missed" | "off" | "future";

export interface RingCell {
  date: string;
  state: RingCellState;
  /** 0–1: cuánto se hizo ese día (para dar más o menos color a los parciales). */
  ratio: number;
}

/** Estado de cada día del mes para un hábito. `todayISO` separa pasado de futuro. */
export function habitMonthCells(
  habit: Habit,
  index: HabitLogIndex,
  monthISO: string,
  todayISO: string,
): RingCell[] {
  return monthDatesISO(monthISO).map((date) => {
    if (date > todayISO) return { date, state: "future", ratio: 0 };
    const value = logValue(index, habit.id, date);
    if (!isScheduledOn(habit, date) && value <= 0) return { date, state: "off", ratio: 0 };
    if (isDone(habit, value)) return { date, state: "done", ratio: 1 };
    const ratio = dayRatio(habit, value);
    return { date, state: ratio > 0 ? "partial" : "missed", ratio };
  });
}

/** Días cumplidos y días en que tocaba (hasta hoy) en esas celdas. */
export function ringTotals(cells: RingCell[]): { done: number; planned: number } {
  let done = 0;
  let planned = 0;
  for (const cell of cells) {
    if (cell.state === "future" || cell.state === "off") continue;
    planned += 1;
    if (cell.state === "done") done += 1;
  }
  return { done, planned };
}
