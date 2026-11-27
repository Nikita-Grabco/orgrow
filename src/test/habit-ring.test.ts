import { describe, expect, it } from "vitest";

import { monthDatesISO } from "@/lib/dates";
import {
  arcPath,
  daySlices,
  habitMonthCells,
  polar,
  RING_SPAN_DEGREES,
  ringTotals,
} from "@/lib/habit-ring";
import { indexLogs } from "@/lib/habits";
import type { Habit, HabitLog } from "@/types/planner";

const habit: Habit = {
  id: "h1",
  name: "Leer",
  kind: "count",
  target: 10,
  step: 1,
  unit: "páginas",
  frequency: { type: "daily" },
  category: "personal",
  archived: false,
  createdAt: 0,
  updatedAt: 0,
};

const log = (date: string, value: number): HabitLog => ({
  id: `${habit.id}:${date}`,
  habitId: habit.id,
  date,
  value,
});

describe("habit ring", () => {
  it("lists every day of the month", () => {
    expect(monthDatesISO("2026-11-15")).toHaveLength(30);
    expect(monthDatesISO("2026-02-10")).toHaveLength(28);
    expect(monthDatesISO("2026-12-01")[30]).toBe("2026-12-31");
  });

  it("places angles from the top, clockwise", () => {
    const top = polar(100, 100, 50, 0);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    const right = polar(100, 100, 50, 90);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
  });

  it("splits the span into one slice per day, leaving the circle open", () => {
    const slices = daySlices(31);
    expect(slices).toHaveLength(31);
    expect(slices[0]?.start).toBeGreaterThan(0);
    expect(slices[30]?.end).toBeLessThan(RING_SPAN_DEGREES);
    expect(slices[1]!.start).toBeGreaterThan(slices[0]!.end);
  });

  it("builds a closed annular sector path", () => {
    const path = arcPath(100, 100, 40, 60, 0, 30);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path.match(/A /g)).toHaveLength(2);
  });

  it("classifies each day against today", () => {
    const index = indexLogs([log("2026-11-01", 10), log("2026-11-02", 4)]);
    const cells = habitMonthCells(habit, index, "2026-11-15", "2026-11-04");
    expect(cells[0]).toMatchObject({ state: "done", ratio: 1 });
    expect(cells[1]).toMatchObject({ state: "partial", ratio: 0.4 });
    expect(cells[2]?.state).toBe("missed");
    expect(cells[4]?.state).toBe("future");
    expect(ringTotals(cells)).toEqual({ done: 1, planned: 4 });
  });

  it("marks days the habit is not planned as off, unless something was logged", () => {
    // 2026-11-02 is a Monday (0); the habit is only planned on Tuesdays (1).
    const tuesdays: Habit = { ...habit, frequency: { type: "weekdays", days: [1] } };
    const index = indexLogs([log("2026-11-03", 10)]);
    const cells = habitMonthCells(tuesdays, index, "2026-11-15", "2026-11-04");
    expect(cells[1]?.state).toBe("off");
    expect(cells[2]?.state).toBe("done");
    expect(ringTotals(cells)).toEqual({ done: 1, planned: 1 });
  });
});
