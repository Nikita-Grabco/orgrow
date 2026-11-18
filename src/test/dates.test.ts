import { describe, expect, it } from "vitest";

import {
  daysUntil,
  dueDateLabel,
  isOverdue,
  isSameMonthISO,
  isoFromOffset,
  isValidISODate,
  monthGridISO,
  monthLabel,
  shiftISODate,
  shiftISOMonths,
  toISODate,
  weekDatesISO,
  weekLabel,
} from "@/lib/dates";

// Local dates: a task due "today" must not shift with the time zone.
const today = new Date(2026, 10, 16);

describe("calendar dates", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(toISODate(today)).toBe("2026-11-16");
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidISODate("2026-11-16")).toBe(true);
    expect(isValidISODate("2026-02-31")).toBe(false);
    expect(isValidISODate("16/11/2026")).toBe(false);
    expect(isValidISODate("")).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(20261116)).toBe(false);
  });

  it("converts day offsets to real dates", () => {
    expect(isoFromOffset(0, today)).toBe("2026-11-16");
    expect(isoFromOffset(1, today)).toBe("2026-11-17");
    expect(isoFromOffset(3, today)).toBe("2026-11-19");
    expect(isoFromOffset(0, null)).toBeNull();
  });

  it("labels dates relative to today", () => {
    expect(dueDateLabel("2026-11-16", today)).toBe("Hoy");
    expect(dueDateLabel("2026-11-17", today)).toBe("Mañana");
    expect(dueDateLabel("2026-11-15", today)).toBe("Ayer");
    expect(dueDateLabel("2026-11-20", today)).toMatch(/^Vie/);
    expect(dueDateLabel(null, today)).toBe("Sin fecha");
  });

  it("detects overdue pending tasks only", () => {
    expect(daysUntil("2026-11-14", today)).toBe(-2);
    expect(isOverdue("2026-11-14", false, today)).toBe(true);
    expect(isOverdue("2026-11-14", true, today)).toBe(false);
    expect(isOverdue("2026-11-16", false, today)).toBe(false);
    expect(isOverdue("2026-11-18", false, today)).toBe(false);
    expect(isOverdue(null, false, today)).toBe(false);
    expect(isOverdue("2026-11-14", false, null)).toBe(false);
  });
});

describe("agenda calendar helpers", () => {
  it("shifts days and months on the real calendar", () => {
    expect(shiftISODate("2026-11-16", 1)).toBe("2026-11-17");
    expect(shiftISODate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftISOMonths("2026-11-16", 1)).toBe("2026-12-16");
    // 31 Jan + 1 month clamps to the last day of February.
    expect(shiftISOMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("returns the Monday–Sunday week of a date", () => {
    const week = weekDatesISO("2026-11-16"); // Monday
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-11-16");
    expect(week[6]).toBe("2026-11-22");
    // A Sunday belongs to the week that started six days earlier.
    expect(weekDatesISO("2026-11-22")[0]).toBe("2026-11-16");
  });

  it("builds a fixed 42-day month grid starting on Monday", () => {
    const grid = monthGridISO("2026-11-16");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid).toContain("2026-11-01");
    expect(grid).toContain("2026-11-30");
    // Same size in months that start on a Sunday (Feb 2026 starts on Sunday).
    expect(monthGridISO("2026-02-01")).toHaveLength(42);
  });

  it("labels months, weeks and month membership", () => {
    expect(monthLabel("2026-11-01")).toBe("Noviembre de 2026");
    expect(weekLabel("2026-11-16")).toBe("16 nov – 22 nov");
    expect(weekLabel("2026-11-30")).toBe("30 nov – 6 dic");
    expect(isSameMonthISO("2026-11-30", "2026-11-16")).toBe(true);
    expect(isSameMonthISO("2026-12-01", "2026-11-16")).toBe(false);
  });
});
