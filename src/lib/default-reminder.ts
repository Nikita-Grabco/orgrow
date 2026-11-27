/**
 * Aviso por defecto de las tareas y actividades nuevas. Vive en este dispositivo
 * (`localStorage`), igual que el permiso de notificaciones; cada tarea o actividad
 * sigue pudiendo cambiarlo. `null` = sin aviso.
 */

export const DEFAULT_REMINDER_KEY = "orgrow:default-reminder";

/** Lee el valor guardado: minutos (0 a 10080) o `null` si no hay o no es válido. */
export function readDefaultReminder(storage: Pick<Storage, "getItem"> | null): number | null {
  try {
    const raw = storage?.getItem(DEFAULT_REMINDER_KEY);
    if (raw === null || raw === undefined || raw === "") return null;
    const minutes = Number(raw);
    return Number.isInteger(minutes) && minutes >= 0 && minutes <= 10080 ? minutes : null;
  } catch {
    return null;
  }
}

export function writeDefaultReminder(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  minutes: number | null,
): void {
  try {
    if (minutes === null) storage?.removeItem(DEFAULT_REMINDER_KEY);
    else storage?.setItem(DEFAULT_REMINDER_KEY, String(minutes));
  } catch {
    /* sin almacenamiento: no se guarda */
  }
}

/** Para los formularios: en navegador lee `localStorage`; en servidor, nada. */
export function initialReminder(): number | null {
  return typeof window === "undefined" ? null : readDefaultReminder(window.localStorage);
}
