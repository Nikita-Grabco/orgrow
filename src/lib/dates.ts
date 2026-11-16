import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function getGreeting(hour: number): string {
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function formatLongDate(date: Date): string {
  return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es }));
}

export function dayOffsetLabel(offset: number, today: Date | null): string {
  if (offset === 0) return "Hoy";
  if (offset === 1) return "Mañana";
  if (!today) return `En ${offset} días`;
  return capitalize(format(addDays(today, offset), "EEEE d", { locale: es }));
}

export function dayParts(offset: number, today: Date | null) {
  if (!today) return { weekday: offset === 0 ? "Hoy" : `+${offset}`, day: "" };
  const date = addDays(today, offset);
  return {
    weekday: capitalize(format(date, "EEE", { locale: es }).replace(".", "")),
    day: format(date, "d"),
  };
}

export function currentTimeString(date: Date): string {
  return format(date, "HH:mm");
}

/* -------------------------------------------------------------------------- */
/* Calendar dates for tasks: always "YYYY-MM-DD" in the user's local calendar. */
/* -------------------------------------------------------------------------- */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  return isValid(parseISO(value)) && toISODate(parseISO(value)) === value;
}

export function parseISODate(value: string): Date {
  return startOfDay(parseISO(value));
}

/**
 * "YYYY-MM-DD" for `offset` days from `today` (0 = today, 1 = tomorrow).
 * Returns null while `today` is unknown (server render), so callers can skip it.
 */
export function isoFromOffset(offset: number, today: Date | null): string | null {
  return today ? toISODate(addDays(today, offset)) : null;
}

/** Negative when the date is in the past, 0 today, positive in the future. */
export function daysUntil(dueDate: string | null | undefined, today: Date | null): number | null {
  if (!today || !isValidISODate(dueDate)) return null;
  return differenceInCalendarDays(parseISODate(dueDate), startOfDay(today));
}

export function isDueToday(dueDate: string | null | undefined, today: Date | null): boolean {
  return daysUntil(dueDate, today) === 0;
}

export function isOverdue(
  dueDate: string | null | undefined,
  completed: boolean,
  today: Date | null,
): boolean {
  if (completed) return false;
  const diff = daysUntil(dueDate, today);
  return diff !== null && diff < 0;
}

/** "Hoy", "Mañana", "Ayer", "lun 16 nov" or "Sin fecha". */
export function dueDateLabel(dueDate: string | null | undefined, today: Date | null): string {
  if (!dueDate || !isValidISODate(dueDate)) return "Sin fecha";
  const diff = daysUntil(dueDate, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return capitalize(format(parseISODate(dueDate), "EEE d MMM", { locale: es }).replaceAll(".", ""));
}
