import { describe, expect, it } from "vitest";

import {
  daysUntil,
  dueDateLabel,
  isOverdue,
  isoFromOffset,
  isValidISODate,
  toISODate,
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
