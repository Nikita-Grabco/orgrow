/**
 * Horas "HH:mm" en formato de 24 h.
 *
 * Vive aparte de los repositorios porque tanto tareas como actividades guardan
 * horas y las dos necesitan la misma validación.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** Devuelve la hora solo si es válida; si no, `undefined`. */
export function readTime(value: unknown): string | undefined {
  return isValidTime(value) ? value : undefined;
}

/** Compara dos horas para ordenar; las ausentes van al final. */
export function compareTime(a: string | undefined, b: string | undefined): number {
  return (a ?? "99:99").localeCompare(b ?? "99:99");
}

/** Minutos desde medianoche; útil para duraciones y solapamientos. */
export function timeToMinutes(time: string): number {
  if (!isValidTime(time)) return 0;
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}
