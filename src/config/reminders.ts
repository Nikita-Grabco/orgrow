/**
 * Cuánto antes se avisa de una tarea o actividad. Los valores son minutos y
 * coinciden con `remind_before_minutes` en la base de datos (0 a 10080).
 * Las etiquetas viven aquí para cambiarlas en un solo sitio.
 */
export interface ReminderOption {
  /** `null` = sin aviso. */
  value: number | null;
  label: string;
}

export const REMINDER_OPTIONS: readonly ReminderOption[] = [
  { value: null, label: "Sin aviso" },
  { value: 0, label: "A la hora" },
  { value: 10, label: "10 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 día antes" },
];

/** Hora a la que se avisa una tarea con fecha pero sin hora (igual que en la base de datos). */
export const DEFAULT_REMINDER_TIME = "09:00";

/** Texto corto de un aviso ya guardado; acepta valores que no estén en la lista. */
export function reminderLabel(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  const known = REMINDER_OPTIONS.find((option) => option.value === minutes);
  if (known) return known.label;

  if (minutes % 1440 === 0) return `${minutes / 1440} días antes`;
  if (minutes % 60 === 0) return `${minutes / 60} horas antes`;
  return `${minutes} min antes`;
}
