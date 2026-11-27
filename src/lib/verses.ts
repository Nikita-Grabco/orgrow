import { getDayOfYear } from "date-fns";

import { VERSES, type Verse } from "@/data/verses";

/** Versículo del día: el mismo todo el día y distinto al siguiente. */
export function verseForDate(date: Date, verses: readonly Verse[] = VERSES): Verse | null {
  if (verses.length === 0) return null;
  // Se suma el año para que la rotación no arranque siempre en el mismo versículo.
  const index = (getDayOfYear(date) + date.getFullYear() * 7) % verses.length;
  return verses[index] ?? null;
}
