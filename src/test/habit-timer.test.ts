import { beforeEach, describe, expect, it } from "vitest";

import {
  elapsedUnits,
  formatClock,
  getTimers,
  HABIT_TIMERS_KEY,
  isTimedHabit,
  parseTimers,
  reachesTarget,
  secondsPerUnit,
  startTimer,
  subscribeTimers,
  takeTimer,
  valueAfterTimer,
} from "@/lib/habit-timer";
import { swipeDirection, wheelDirection } from "@/lib/swipe";
import type { Habit } from "@/types/planner";

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Trabajar",
    kind: "count",
    target: 6,
    step: 1,
    unit: "h",
    frequency: { type: "daily" },
    category: "trabajo",
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("habit timer", () => {
  it("detects timed habits by unit or legacy kind", () => {
    expect(secondsPerUnit(habit())).toBe(3600);
    expect(secondsPerUnit(habit({ unit: "min" }))).toBe(60);
    expect(secondsPerUnit(habit({ kind: "time", unit: undefined }))).toBe(60);
    expect(isTimedHabit(habit({ unit: "vasos" }))).toBe(false);
    expect(isTimedHabit(habit({ kind: "check", unit: undefined }))).toBe(false);
  });

  it("converts elapsed time into the habit unit", () => {
    const start = 0;
    expect(elapsedUnits(habit(), start, 3 * 3600 * 1000)).toBe(3);
    expect(elapsedUnits(habit({ unit: "min", target: 30 }), start, 90 * 1000)).toBe(1.5);
    expect(elapsedUnits(habit(), 1000, 0)).toBe(0);
  });

  it("adds the timer to the day and caps it at the goal", () => {
    expect(valueAfterTimer(habit(), 1, 2.5)).toBe(3.5);
    expect(valueAfterTimer(habit(), 4, 5)).toBe(6);
    expect(reachesTarget(habit(), 4, 2)).toBe(true);
    expect(reachesTarget(habit(), 4, 1.9)).toBe(false);
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock((3600 + 23 * 60 + 45) * 1000)).toBe("01:23:45");
  });

  it("ignores broken stored timers", () => {
    expect(parseTimers("no json")).toEqual({});
    expect(parseTimers(JSON.stringify({ a: { startedAt: 5, date: "2026-11-27" }, b: 3 }))).toEqual({
      a: { startedAt: 5, date: "2026-11-27" },
    });
  });
});

describe("timer store", () => {
  beforeEach(() => {
    while (Object.keys(getTimers()).length > 0) takeTimer(Object.keys(getTimers())[0]!);
    window.localStorage.clear();
  });

  it("starts once, persists and stops with the original day", () => {
    const unsubscribe = subscribeTimers(() => {});
    const now = new Date(2026, 10, 27, 9, 0);
    startTimer("h1", now);
    startTimer("h1", new Date(2026, 10, 27, 10, 0));
    expect(getTimers()["h1"]).toEqual({ startedAt: now.getTime(), date: "2026-11-27" });
    expect(window.localStorage.getItem(HABIT_TIMERS_KEY)).toContain("h1");
    expect(takeTimer("h1")?.date).toBe("2026-11-27");
    expect(takeTimer("h1")).toBeNull();
    unsubscribe();
  });
});

describe("swipe", () => {
  it("accepts clear horizontal swipes only", () => {
    expect(swipeDirection(-100, 10)).toBe(1);
    expect(swipeDirection(100, 10)).toBe(-1);
    expect(swipeDirection(-30, 0)).toBe(0);
    expect(swipeDirection(-80, 120)).toBe(0);
    expect(wheelDirection(50, 5)).toBe(1);
    expect(wheelDirection(-50, 5)).toBe(-1);
    expect(wheelDirection(10, 5)).toBe(0);
    expect(wheelDirection(40, 90)).toBe(0);
  });
});
