import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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

/* -------------------------------------------------------------------------- */
/* Calendar navigation for the agenda: weeks start on Monday, always ISO dates. */
/* -------------------------------------------------------------------------- */

const WEEK_STARTS_ON_MONDAY = { weekStartsOn: 1 } as const;

/** Initials of Monday–Sunday, used by the month grid header. */
export const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"] as const;

export function shiftISODate(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

export function shiftISOMonths(iso: string, months: number): string {
  return toISODate(addMonths(parseISODate(iso), months));
}

/** Monday → Sunday of the week that contains `iso`. */
export function weekDatesISO(iso: string): string[] {
  const start = startOfWeek(parseISODate(iso), WEEK_STARTS_ON_MONDAY);
  return Array.from({ length: 7 }, (_, index) => toISODate(addDays(start, index)));
}

/**
 * 42 consecutive dates (6 rows × 7 columns) covering the month of `iso`, so the
 * grid keeps the same height in every month.
 */
export function monthGridISO(iso: string): string[] {
  const start = startOfWeek(startOfMonth(parseISODate(iso)), WEEK_STARTS_ON_MONDAY);
  return Array.from({ length: 42 }, (_, index) => toISODate(addDays(start, index)));
}

export function isSameMonthISO(iso: string, anchor: string): boolean {
  return iso.slice(0, 7) === anchor.slice(0, 7);
}

/** "Noviembre de 2026" */
export function monthLabel(iso: string): string {
  return capitalize(format(parseISODate(iso), "MMMM 'de' yyyy", { locale: es }));
}

/** "10 – 16 nov" or "30 nov – 6 dic". */
export function weekLabel(iso: string): string {
  const dates = weekDatesISO(iso);
  const first = parseISODate(dates[0] ?? iso);
  const last = parseISODate(dates[6] ?? iso);
  const left = format(first, "d MMM", { locale: es });
  const right = format(last, "d MMM", { locale: es });
  return capitalize(`${left} – ${right}`);
}

/** "lun" / "mar"… without the trailing dot. */
export function shortWeekday(iso: string): string {
  return format(parseISODate(iso), "EEE", { locale: es }).replace(".", "");
}

export function dayOfMonth(iso: string): string {
  return format(parseISODate(iso), "d");
}

/** "Lunes, 16 de noviembre" para la cabecera de la vista de día. */
export function longDateLabel(iso: string): string {
  return capitalize(format(parseISODate(iso), "EEEE, d 'de' MMMM", { locale: es }));
}

/** Etiqueta corta con el mes, para listas que cruzan meses. */
export function shortDateLabel(iso: string): string {
  return capitalize(format(parseISODate(iso), "EEE d MMM", { locale: es }).replaceAll(".", ""));
}

/** Minutos hasta una fecha y hora locales ("YYYY-MM-DD" + "HH:mm"); negativo si ya pasó. */
export function minutesUntil(dateISO: string, time: string, now: Date): number {
  const [hours, minutes] = time.split(":").map(Number);
  const target = new Date(parseISODate(dateISO));
  target.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return differenceInMinutes(target, now);
}

/** "en 2 h 15 min", "en 40 min", "ahora" o "en 3 días". */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "ahora";
  if (minutes < 60) return `en ${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return `en ${days} ${days === 1 ? "día" : "días"}`;
}
