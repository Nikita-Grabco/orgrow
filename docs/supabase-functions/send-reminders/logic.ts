/**
 * Lógica pura de la función `send-reminders` (sin Deno, sin red, sin Supabase),
 * separada de `index.ts` para poder probarla con Vitest.
 */

export type ReminderKind = "task" | "activity";

/** Lo que la función lee de `tasks` o `activities`. */
export interface DueRow {
  id: string;
  user_id: string;
  title: string;
  remind_before_minutes: number | null;
  /** Tareas: `due_time`. Actividades: `start_time`. Formato "HH:mm:ss". */
  time: string | null;
  /** Solo actividades. */
  location?: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta de la app que se abre al pulsar el aviso. */
  url: string;
  /** Un mismo elemento sustituye a su aviso anterior en vez de apilarse. */
  tag: string;
}

/** Los avisos más viejos que esto no se envían: llegarían absurdamente tarde. */
export const MAX_LATE_MS = 24 * 60 * 60 * 1000;

/** Máximo de avisos que se atienden por ejecución (corre cada minuto). */
export const BATCH_LIMIT = 200;

const hhmm = (time: string | null): string | null => (time ? time.slice(0, 5) : null);

/** "Ahora", "En 10 min", "En 1 hora", "En 2 horas", "Mañana", "En 3 días". */
export function whenText(beforeMinutes: number | null): string {
  const minutes = beforeMinutes ?? 0;
  if (minutes <= 0) return "Ahora";
  if (minutes < 60) return `En ${minutes} min`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `En ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  const days = Math.round(minutes / 1440);
  return days === 1 ? "Mañana" : `En ${days} días`;
}

export function buildPayload(kind: ReminderKind, row: DueRow): PushPayload {
  const time = hhmm(row.time);
  const when = whenText(row.remind_before_minutes);

  if (kind === "task") {
    return {
      title: row.title,
      body: `${when} · Tarea${time ? ` a las ${time}` : ""}`,
      url: "/tareas",
      tag: `task-${row.id}`,
    };
  }

  const place = row.location?.trim();
  return {
    title: row.title,
    body: `${when} · Actividad${time ? ` a las ${time}` : ""}${place ? ` · ${place}` : ""}`,
    url: "/agenda",
    tag: `activity-${row.id}`,
  };
}

/** Intervalo de `remind_at` que se atiende ahora: ya vencidos, pero no antiguos. */
export function dueWindow(now: Date): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - MAX_LATE_MS).toISOString(),
    to: now.toISOString(),
  };
}

/** Agrupa por usuario, conservando el orden. */
export function groupByUser<T extends { user_id: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.user_id);
    if (list) list.push(row);
    else groups.set(row.user_id, [row]);
  }
  return groups;
}

export type PushFailure = "gone" | "retry" | "drop";

/**
 * Qué hacer con un fallo al enviar a un dispositivo:
 *  - gone:  404/410, la suscripción ya no existe → borrarla.
 *  - retry: el servicio de push o la red fallan (o hay límite de peticiones) → reintentar luego.
 *  - drop:  cualquier otro 4xx (clave VAPID mala, aviso rechazado…) → reintentar no arregla nada.
 */
export function classifyPushFailure(statusCode: number | undefined): PushFailure {
  if (statusCode === 404 || statusCode === 410) return "gone";
  if (statusCode === undefined || statusCode === 429 || statusCode >= 500) return "retry";
  return "drop";
}

/** Comparación en tiempo constante, para no revelar el secreto por el tiempo de respuesta. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
