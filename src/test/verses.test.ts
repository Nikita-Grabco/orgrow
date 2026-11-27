import { describe, expect, it } from "vitest";

import { VERSES } from "@/data/verses";
import { verseForDate } from "@/lib/verses";

describe("verse of the day", () => {
  it("has well-formed, unique verses", () => {
    expect(VERSES.length).toBeGreaterThanOrEqual(30);
    const refs = new Set(VERSES.map((v) => v.reference));
    expect(refs.size).toBe(VERSES.length);
    for (const verse of VERSES) {
      expect(verse.text.trim().length).toBeGreaterThan(10);
      expect(verse.reference).toMatch(/\d+:\d+/);
    }
  });

  it("is stable within a day and changes the next", () => {
    const morning = verseForDate(new Date(2026, 10, 27, 7, 0));
    const night = verseForDate(new Date(2026, 10, 27, 23, 59));
    const next = verseForDate(new Date(2026, 10, 28, 7, 0));
    expect(morning).toEqual(night);
    expect(next).not.toEqual(morning);
  });

  it("returns null with no verses", () => {
    expect(verseForDate(new Date(), [])).toBeNull();
  });
});
