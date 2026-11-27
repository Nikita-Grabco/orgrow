import { getDaysInMonth, isLeapYear } from "date-fns";

import { parseISODate } from "@/lib/dates";
import type { SpecialDate, SpecialDatePatch } from "@/types/planner";

const pad = (value: number) => String(value).padStart(2, "0");

/** Mayor día válido de un mes, contando el 29 de febrero. */
export function maxDayOfMonth(month: number): number {
  return getDaysInMonth(new Date(2024, month - 1, 1));
}

/**
 * Fecha ("YYYY-MM-DD") en que cae en `year`. El 29 de febrero cae el 28 en los
 * años que no son bisiestos.
 */
export function occurrenceInYear(date: SpecialDate, year: number): string {
  const leap = isLeapYear(new Date(year, 0, 1));
  const day = date.month === 2 && date.day === 29 && !leap ? 28 : date.day;
  return `${String(year).padStart(4, "0")}-${pad(date.month)}-${pad(day)}`;
}

/** Si la fecha cae en el día `iso`. */
export function occursOn(date: SpecialDate, iso: string): boolean {
  return occurrenceInYear(date, Number(iso.slice(0, 4))) === iso;
}

/** La próxima vez que ocurre, hoy incluido. */
export function nextOccurrence(date: SpecialDate, todayISO: string): string {
  const year = Number(todayISO.slice(0, 4));
  const thisYear = occurrenceInYear(date, year);
  return thisYear >= todayISO ? thisYear : occurrenceInYear(date, year + 1);
}

/** Años cumplidos en la ocurrencia dada; `null` si no se guardó el año de origen. */
export function yearsOn(date: SpecialDate, occurrenceISO: string): number | null {
  if (date.year === undefined) return null;
  const years = Number(occurrenceISO.slice(0, 4)) - date.year;
  return years >= 0 ? years : null;
}

export function daysUntilNext(date: SpecialDate, todayISO: string): number {
  const next = parseISODate(nextOccurrence(date, todayISO));
  const today = parseISODate(todayISO);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/** Fechas que caen en un día, por título. */
export function specialDatesOn(dates: SpecialDate[], iso: string | null): SpecialDate[] {
  if (!iso) return [];
  return dates.filter((date) => occursOn(date, iso)).sort((a, b) => a.title.localeCompare(b.title));
}

export interface UpcomingSpecialDate {
  date: SpecialDate;
  /** "YYYY-MM-DD" de la próxima ocurrencia. */
  on: string;
  inDays: number;
  /** Años que cumple ese día, si se conoce el año de origen. */
  years: number | null;
}

/** Las que ocurren en los próximos `withinDays` días (hoy incluido), de la más cercana a la más lejana. */
export function upcomingSpecialDates(
  dates: SpecialDate[],
  todayISO: string,
  withinDays: number,
): UpcomingSpecialDate[] {
  return dates
    .map((date) => {
      const on = nextOccurrence(date, todayISO);
      return { date, on, inDays: daysUntilNext(date, todayISO), years: yearsOn(date, on) };
    })
    .filter((item) => item.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays || a.date.title.localeCompare(b.date.title));
}

/** Todas ordenadas por la próxima vez que ocurren. */
export function sortByNextOccurrence(
  dates: SpecialDate[],
  todayISO: string,
): UpcomingSpecialDate[] {
  return upcomingSpecialDates(dates, todayISO, 366);
}

/** "Hoy", "Mañana" o "En 5 días". */
export function inDaysLabel(inDays: number): string {
  if (inDays === 0) return "Hoy";
  if (inDays === 1) return "Mañana";
  return `En ${inDays} días`;
}

/** Edad o años cumplidos para mostrar junto al título: "cumple 30", "25 años". */
export function yearsLabel(kind: SpecialDate["kind"], years: number | null): string | null {
  if (years === null) return null;
  if (years === 0) return kind === "cumpleanos" ? "nace" : "primer año";
  return kind === "cumpleanos" ? `cumple ${years}` : `${years} años`;
}

/** Aplica un cambio a una fecha. `year: null` quita el año; `undefined` no toca nada. */
export function applySpecialDatePatch(date: SpecialDate, patch: SpecialDatePatch): SpecialDate {
  const { year, remindBeforeDays, ...rest } = patch;
  return {
    ...date,
    ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
    year: year === undefined ? date.year : (year ?? undefined),
    remindBeforeDays: remindBeforeDays === undefined ? date.remindBeforeDays : remindBeforeDays,
    updatedAt: Date.now(),
  };
}
