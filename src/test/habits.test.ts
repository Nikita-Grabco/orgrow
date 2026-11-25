import { beforeEach, describe, expect, it } from "vitest";

import {
  formatMinutes,
  formatProgress,
  frequencyLabel,
  habitsForDay,
  heatLevel,
  heatmapWeeks,
  indexLogs,
  isScheduledOn,
  weekdayIndex,
  weekProgress,
} from "@/lib/habits";
import {
  createLocalHabitLogsRepository,
  createLocalHabitsRepository,
  habitLogId,
} from "@/services/habits-repository";
import { STORAGE_KEYS } from "@/services/planner-storage";
import type { Habit } from "@/types/planner";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Leer",
    kind: "time",
    target: 60,
    step: 15,
    frequency: { type: "daily" },
    category: "personal",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

// 2026-11-25 is a Wednesday.
describe("habit rules", () => {
  it("indexes weekdays from Monday", () => {
    expect(weekdayIndex("2026-11-23")).toBe(0);
    expect(weekdayIndex("2026-11-25")).toBe(2);
    expect(weekdayIndex("2026-11-29")).toBe(6);
  });

  it("schedules specific weekdays only on those days", () => {
    const gym = makeHabit({ frequency: { type: "weekdays", days: [0, 2, 4] } });
    expect(isScheduledOn(gym, "2026-11-25")).toBe(true);
    expect(isScheduledOn(gym, "2026-11-26")).toBe(false);
    expect(habitsForDay([gym], "2026-11-26")).toEqual([]);
    expect(
      isScheduledOn(makeHabit({ frequency: { type: "weekly", times: 3 } }), "2026-11-26"),
    ).toBe(true);
  });

  it("maps progress to five heat levels", () => {
    const habit = makeHabit();
    expect([0, 10, 30, 50, 60, 90].map((value) => heatLevel(habit, value))).toEqual([
      0, 1, 2, 3, 4, 4,
    ]);
  });

  it("counts completed days of the week, capped at the goal", () => {
    const habit = makeHabit({ frequency: { type: "weekly", times: 2 } });
    const index = indexLogs([
      { id: "a", habitId: "h1", date: "2026-11-23", value: 60 },
      { id: "b", habitId: "h1", date: "2026-11-24", value: 70 },
      { id: "c", habitId: "h1", date: "2026-11-25", value: 60 },
      { id: "d", habitId: "h1", date: "2026-11-26", value: 20 },
    ]);
    expect(weekProgress(habit, index, "2026-11-25")).toEqual({ done: 2, goal: 2 });
    expect(weekProgress(makeHabit(), index, "2026-11-25")).toEqual({ done: 3, goal: 7 });
  });

  it("builds heatmap columns of Monday–Sunday ending in the current week", () => {
    const weeks = heatmapWeeks("2026-11-25", 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[2]?.[0]).toBe("2026-11-23");
    expect(weeks[2]?.[6]).toBe("2026-11-29");
    expect(weeks[0]?.[0]).toBe("2026-11-09");
  });

  it("formats progress and frequency in Spanish", () => {
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatProgress(makeHabit(), 30)).toBe("30 min / 1 h");
    expect(formatProgress(makeHabit({ kind: "count", target: 1, unit: "L" }), 0.25)).toBe(
      "0,25 / 1 L",
    );
    expect(frequencyLabel({ type: "weekdays", days: [4, 0, 2] })).toBe("lun, mié y vie");
    expect(frequencyLabel({ type: "weekly", times: 3 })).toBe("3 veces por semana");
    expect(frequencyLabel({ type: "daily" })).toBe("Cada día");
  });
});

describe("habits repositories", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("seeds example habits on the first run only", async () => {
    const first = await createLocalHabitsRepository().list();
    expect(first.length).toBeGreaterThan(0);

    for (const habit of first) await createLocalHabitsRepository().remove(habit.id);
    expect(await createLocalHabitsRepository().list()).toEqual([]);
  });

  it("creates, updates and removes a habit", async () => {
    const repo = createLocalHabitsRepository();
    await repo.list();
    await repo.create(makeHabit({ id: "x" }));
    await repo.update(makeHabit({ id: "x", name: "Leer 1 h" }));
    expect((await repo.list()).find((habit) => habit.id === "x")?.name).toBe("Leer 1 h");

    await repo.remove("x");
    expect((await repo.list()).some((habit) => habit.id === "x")).toBe(false);
  });

  it("drops corrupt habits and repairs odd values instead of crashing", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.habits,
      JSON.stringify({
        schemaVersion: 1,
        seeded: true,
        items: [
          {
            id: "ok",
            name: "Agua",
            kind: "count",
            target: -2,
            category: "salud",
            frequency: { type: "weekdays", days: [] },
          },
          { id: "bad", name: "", kind: "check", category: "salud" },
          { id: "worse", name: "X", kind: "nope", category: "salud" },
          null,
        ],
      }),
    );

    const habits = await createLocalHabitsRepository().list();
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({ id: "ok", target: 1, frequency: { type: "daily" } });
  });

  it("keeps one log per habit and day and clears them with the habit", async () => {
    const logs = createLocalHabitLogsRepository();
    const id = habitLogId("h1", "2026-11-25");

    await logs.upsert({ id, habitId: "h1", date: "2026-11-25", value: 15 });
    await logs.upsert({ id, habitId: "h1", date: "2026-11-25", value: 45 });
    await logs.upsert({
      id: habitLogId("h2", "2026-11-25"),
      habitId: "h2",
      date: "2026-11-25",
      value: 1,
    });

    expect((await logs.list()).filter((log) => log.habitId === "h1")).toEqual([
      { id, habitId: "h1", date: "2026-11-25", value: 45 },
    ]);

    await logs.removeForHabit("h1");
    expect((await logs.list()).map((log) => log.habitId)).toEqual(["h2"]);
  });
});
