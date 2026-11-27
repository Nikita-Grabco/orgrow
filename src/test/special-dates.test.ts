import { describe, expect, it } from "vitest";

import { createBackup, parseBackup } from "@/lib/backup";
import {
  applySpecialDatePatch,
  daysUntilNext,
  inDaysLabel,
  maxDayOfMonth,
  nextOccurrence,
  occursOn,
  sortByNextOccurrence,
  specialDatesOn,
  upcomingSpecialDates,
  yearsLabel,
  yearsOn,
} from "@/lib/special-dates";
import {
  specialDateFromRow,
  specialDateToInsert,
  specialDateToUpdate,
  type SpecialDateRow,
} from "@/services/mappers";
import { createLocalSpecialDatesRepository } from "@/services/special-dates-repository";
import type { SpecialDate } from "@/types/planner";

function make(overrides: Partial<SpecialDate> = {}): SpecialDate {
  return {
    id: "d1",
    title: "Ana",
    kind: "cumpleanos",
    month: 12,
    day: 5,
    year: 1990,
    remindBeforeDays: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("special dates logic", () => {
  it("knows the longest valid day of each month", () => {
    expect(maxDayOfMonth(2)).toBe(29);
    expect(maxDayOfMonth(4)).toBe(30);
    expect(maxDayOfMonth(12)).toBe(31);
  });

  it("repeats every year and moves 29 February to 28 in common years", () => {
    expect(occursOn(make(), "2026-12-05")).toBe(true);
    expect(occursOn(make(), "2031-12-05")).toBe(true);
    expect(occursOn(make(), "2026-12-06")).toBe(false);
    const leapDay = make({ month: 2, day: 29 });
    expect(occursOn(leapDay, "2027-02-28")).toBe(true);
    expect(occursOn(leapDay, "2028-02-29")).toBe(true);
    expect(occursOn(leapDay, "2028-02-28")).toBe(false);
  });

  it("finds the next occurrence, today included", () => {
    expect(nextOccurrence(make(), "2026-11-27")).toBe("2026-12-05");
    expect(nextOccurrence(make(), "2026-12-05")).toBe("2026-12-05");
    expect(nextOccurrence(make(), "2026-12-06")).toBe("2027-12-05");
    expect(daysUntilNext(make(), "2026-11-27")).toBe(8);
    expect(daysUntilNext(make(), "2026-12-05")).toBe(0);
  });

  it("computes ages only when the year is known", () => {
    expect(yearsOn(make(), "2026-12-05")).toBe(36);
    expect(yearsOn(make({ year: undefined }), "2026-12-05")).toBeNull();
    expect(yearsLabel("cumpleanos", 36)).toBe("cumple 36");
    expect(yearsLabel("aniversario", 5)).toBe("5 años");
    expect(yearsLabel("otra", null)).toBeNull();
  });

  it("lists upcoming dates in order and within a window", () => {
    const dates = [
      make({ id: "a", title: "Ana", month: 12, day: 5 }),
      make({ id: "b", title: "Beto", month: 11, day: 28 }),
      make({ id: "c", title: "Cris", month: 3, day: 1 }),
    ];
    const upcoming = upcomingSpecialDates(dates, "2026-11-27", 30);
    expect(upcoming.map((item) => item.date.id)).toEqual(["b", "a"]);
    expect(upcoming[0]).toMatchObject({ inDays: 1, on: "2026-11-28" });
    expect(sortByNextOccurrence(dates, "2026-11-27").map((item) => item.date.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(specialDatesOn(dates, "2026-12-05").map((d) => d.id)).toEqual(["a"]);
    expect(specialDatesOn(dates, null)).toEqual([]);
  });

  it("labels the distance in days", () => {
    expect(inDaysLabel(0)).toBe("Hoy");
    expect(inDaysLabel(1)).toBe("Mañana");
    expect(inDaysLabel(9)).toBe("En 9 días");
  });

  it("applies patches, clearing the year with null", () => {
    expect(applySpecialDatePatch(make(), { title: "Ana M." }).title).toBe("Ana M.");
    expect(applySpecialDatePatch(make(), { year: null }).year).toBeUndefined();
    expect(applySpecialDatePatch(make(), { remindBeforeDays: undefined }).remindBeforeDays).toBe(1);
    expect(applySpecialDatePatch(make(), { remindBeforeDays: null }).remindBeforeDays).toBeNull();
  });
});

describe("special dates storage", () => {
  it("maps rows to the domain and back", () => {
    const row: SpecialDateRow = {
      id: "x",
      title: "Mamá",
      kind: "cumpleanos",
      month: 3,
      day: 14,
      year: null,
      remind_before_days: 7,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    const date = specialDateFromRow(row);
    expect(date).toMatchObject({ id: "x", year: undefined, remindBeforeDays: 7 });
    expect(specialDateToInsert(date, date.id)).toMatchObject({
      id: "x",
      month: 3,
      day: 14,
      year: null,
      remind_before_days: 7,
    });
    expect(specialDateToUpdate({ year: null })).toEqual({ year: null });
    expect(specialDateToUpdate({ title: "A" })).toEqual({ title: "A" });
  });

  it("keeps dates in the local repository and drops invalid stored rows", async () => {
    window.localStorage.clear();
    const repo = createLocalSpecialDatesRepository();
    expect(await repo.list()).toEqual([]);
    await repo.create(make());
    await repo.create(make({ id: "d2", title: "Beto", month: 2, day: 29 }));
    expect((await repo.list()).map((d) => d.id)).toEqual(["d1", "d2"]);
    await repo.update(make({ title: "Ana M." }));
    expect((await repo.list())[0]?.title).toBe("Ana M.");
    await repo.remove("d1");
    expect((await repo.list()).map((d) => d.id)).toEqual(["d2"]);

    window.localStorage.setItem(
      "orgrow:v1:special-dates",
      JSON.stringify({
        schemaVersion: 1,
        seeded: true,
        items: [make({ id: "ok" }), { id: "bad", title: "x", kind: "otra", month: 2, day: 30 }],
      }),
    );
    expect((await repo.list()).map((d) => d.id)).toEqual(["ok"]);
  });

  it("round-trips through the backup and skips invalid entries", () => {
    const now = new Date(2026, 10, 27);
    const file = createBackup(
      { tasks: [], notes: [], activities: [], habits: [], habitLogs: [], specialDates: [make()] },
      null,
      now,
    );
    const broken = JSON.parse(JSON.stringify(file)) as typeof file;
    broken.data.specialDates = [
      ...(broken.data.specialDates ?? []),
      { id: "bad", title: "x", kind: "otra", month: 4, day: 31, createdAt: 1, updatedAt: 1 },
    ];
    const result = parseBackup(JSON.stringify(broken));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.payload.specialDates?.map((d) => d.id)).toEqual(["d1"]);
      expect(result.backup.skipped).toBe(1);
    }
  });
});
