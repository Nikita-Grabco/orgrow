import { describe, expect, it } from "vitest";

import { currentStreak, indexLogs } from "@/lib/habits";
import { formatCountdown, minutesUntil } from "@/lib/dates";
import { describeWeather, isFresh, parseCities, parseForecast } from "@/lib/weather";
import type { Habit, HabitLog } from "@/types/planner";

describe("weather", () => {
  it("parses a forecast and rounds temperatures", () => {
    const parsed = parseForecast(
      {
        current: { temperature_2m: 13.6, weather_code: 3, is_day: 1 },
        daily: { temperature_2m_max: [16.2], temperature_2m_min: [8.7] },
      },
      1000,
    );
    expect(parsed).toEqual({
      temperature: 14,
      min: 9,
      max: 16,
      code: 3,
      isDay: true,
      fetchedAt: 1000,
    });
  });

  it("rejects malformed forecasts", () => {
    expect(parseForecast(null, 0)).toBeNull();
    expect(parseForecast({ current: {}, daily: {} }, 0)).toBeNull();
  });

  it("parses cities and skips broken rows", () => {
    expect(
      parseCities({
        results: [
          { name: "Madrid", latitude: 40.4, longitude: -3.7, admin1: "Madrid", country: "España" },
          { name: "Roto" },
        ],
      }),
    ).toEqual([{ name: "Madrid, Madrid", latitude: 40.4, longitude: -3.7 }]);
    expect(parseCities({})).toEqual([]);
  });

  it("describes weather codes by day and night", () => {
    expect(describeWeather(0, true).icon).toBe("sun");
    expect(describeWeather(0, false).icon).toBe("moon");
    expect(describeWeather(63, true).label).toBe("Lluvia");
    expect(describeWeather(95, true).icon).toBe("storm");
  });

  it("treats data older than 30 minutes as stale", () => {
    const weather = { temperature: 1, min: 0, max: 2, code: 0, isDay: true, fetchedAt: 0 };
    expect(isFresh(weather, 29 * 60 * 1000)).toBe(true);
    expect(isFresh(weather, 31 * 60 * 1000)).toBe(false);
  });
});

describe("countdown", () => {
  it("computes minutes until a local date and time", () => {
    const now = new Date(2026, 10, 27, 12, 0);
    expect(minutesUntil("2026-11-27", "14:15", now)).toBe(135);
    expect(minutesUntil("2026-11-27", "11:00", now)).toBe(-60);
  });

  it("formats the countdown", () => {
    expect(formatCountdown(0)).toBe("ahora");
    expect(formatCountdown(40)).toBe("en 40 min");
    expect(formatCountdown(135)).toBe("en 2 h 15 min");
    expect(formatCountdown(120)).toBe("en 2 h");
    expect(formatCountdown(3 * 24 * 60)).toBe("en 3 días");
  });
});

describe("currentStreak", () => {
  const habit: Habit = {
    id: "h1",
    name: "Leer",
    kind: "check",
    target: 1,
    step: 1,
    frequency: { type: "daily" },
    category: "personal",
    archived: false,
    createdAt: 0,
    updatedAt: 0,
  };
  const log = (date: string): HabitLog => ({ id: date, habitId: "h1", date, value: 1 });

  it("counts consecutive done days up to today", () => {
    const index = indexLogs([log("2026-11-27"), log("2026-11-26"), log("2026-11-25")]);
    expect(currentStreak(habit, index, "2026-11-27")).toBe(3);
  });

  it("does not break when today is still pending", () => {
    const index = indexLogs([log("2026-11-26"), log("2026-11-25")]);
    expect(currentStreak(habit, index, "2026-11-27")).toBe(2);
  });

  it("breaks on a missed scheduled day", () => {
    const index = indexLogs([log("2026-11-27"), log("2026-11-25")]);
    expect(currentStreak(habit, index, "2026-11-27")).toBe(1);
  });

  it("skips days the habit is not planned and ignores weekly habits", () => {
    // 2026-11-27 is a Friday (index 4); the habit is only planned Fri (4) and Wed (2).
    const weekdays: Habit = { ...habit, frequency: { type: "weekdays", days: [2, 4] } };
    const index = indexLogs([log("2026-11-27"), log("2026-11-25")]);
    expect(currentStreak(weekdays, index, "2026-11-27")).toBe(2);
    const weekly: Habit = { ...habit, frequency: { type: "weekly", times: 3 } };
    expect(currentStreak(weekly, index, "2026-11-27")).toBe(0);
  });
});
