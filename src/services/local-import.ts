import { habitLogId } from "@/services/habits-repository";
import {
  createLocalPlannerRepositories,
  type ImportPayload,
} from "@/services/supabase-repositories";

/**
 * Pasa a la cuenta los datos que el usuario ya tenía guardados en este
 * navegador (antes de que existiera el servidor).
 *
 * - Los datos de demo de la primera ejecución no se importan: no son suyos.
 * - Los ids locales ("t-k3j…") no son uuid, así que se reemplazan por uno
 *   **derivado** de la cuenta y del id antiguo. Al ser determinista, repetir la
 *   importación escribe las mismas filas y nunca crea duplicados.
 * - Se hace una sola vez por cuenta y dispositivo (ver `importedFlagKey`).
 */

const SAMPLE_TASK_ID = /^t\d+$/;
const SAMPLE_ACTIVITY_ID = /^a\d+$/;
const SAMPLE_NOTE_ID = /^n\d+$/;
const SAMPLE_HABIT_IDS = new Set(["h-gym", "h-leer", "h-agua"]);

/** Hash de 128 bits (cyrb128) → uuid con forma de v4. No es criptográfico ni lo necesita. */
export function deterministicUuid(seed: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  const hex = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
    .map((part) => part.toString(16).padStart(8, "0"))
    .join("");

  // Versión 4 y variante RFC 4122, para que cualquier validador de uuid lo acepte.
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/** Reasigna ids y descarta lo que es demo o quedó huérfano. Pura, sin red ni navegador. */
export function buildImportPayload(local: ImportPayload, userId: string): ImportPayload {
  const idFor = (kind: string, id: string) => deterministicUuid(`${userId}:${kind}:${id}`);

  const habits = local.habits
    .filter((habit) => !SAMPLE_HABIT_IDS.has(habit.id))
    .map((habit) => ({ ...habit, id: idFor("habit", habit.id) }));

  const newHabitId = new Map(
    local.habits
      .filter((habit) => !SAMPLE_HABIT_IDS.has(habit.id))
      .map((habit) => [habit.id, idFor("habit", habit.id)] as const),
  );

  return {
    tasks: local.tasks
      .filter((task) => !SAMPLE_TASK_ID.test(task.id))
      .map((task) => ({ ...task, id: idFor("task", task.id) })),
    notes: local.notes
      .filter((note) => !SAMPLE_NOTE_ID.test(note.id))
      .map((note) => ({ ...note, id: idFor("note", note.id) })),
    activities: local.activities
      .filter((activity) => !SAMPLE_ACTIVITY_ID.test(activity.id))
      .map((activity) => ({ ...activity, id: idFor("activity", activity.id) })),
    habits,
    habitLogs: local.habitLogs.flatMap((log) => {
      const habitId = newHabitId.get(log.habitId);
      if (!habitId) return [];
      return [{ ...log, habitId, id: habitLogId(habitId, log.date) }];
    }),
  };
}

export function countImportPayload(payload: ImportPayload): number {
  return (
    payload.tasks.length +
    payload.notes.length +
    payload.activities.length +
    payload.habits.length +
    payload.habitLogs.length
  );
}

/* -------------------------------------------------------------------------- */
/* Estado de la importación (por cuenta, en este dispositivo)                 */
/* -------------------------------------------------------------------------- */

export const importedFlagKey = (userId: string) => `orgrow:v1:imported:${userId}`;

function readFlag(userId: string): boolean {
  try {
    return window.localStorage.getItem(importedFlagKey(userId)) !== null;
  } catch {
    return false;
  }
}

function writeFlag(userId: string): void {
  try {
    window.localStorage.setItem(importedFlagKey(userId), new Date().toISOString());
  } catch (error) {
    // Sin la marca se reintentaría, pero es idempotente: no duplica nada.
    console.error("[orgrow] No se pudo recordar que los datos ya se importaron", error);
  }
}

async function readLocalData(): Promise<ImportPayload> {
  const local = createLocalPlannerRepositories();
  const [tasks, notes, activities, habits, habitLogs] = await Promise.all([
    local.tasks.list(),
    local.notes.list(),
    local.activities.list(),
    local.habits.list(),
    local.habitLogs.list(),
  ]);
  return { tasks, notes, activities, habits, habitLogs };
}

/**
 * Importa una vez los datos locales de esta cuenta. Devuelve cuántos elementos
 * se subieron (0 si ya estaba hecho o solo había datos de demo). Si `upload`
 * falla no se marca como hecho y la excepción sube al llamador.
 */
export async function importLocalDataOnce(
  userId: string,
  upload: (payload: ImportPayload) => Promise<void>,
): Promise<number> {
  if (typeof window === "undefined" || readFlag(userId)) return 0;

  const payload = buildImportPayload(await readLocalData(), userId);
  const total = countImportPayload(payload);

  if (total > 0) await upload(payload);
  writeFlag(userId);
  return total;
}
