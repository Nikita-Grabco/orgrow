import { CATEGORY_IDS, NOTE_KIND_IDS, PRIORITY_IDS } from "@/config/categories";
import { SPECIAL_DATE_KIND_IDS } from "@/config/special-dates";
import { isValidISODate } from "@/lib/dates";
import { maxDayOfMonth } from "@/lib/special-dates";
import { habitLogId } from "@/services/habits-repository";
import { deterministicUuid } from "@/services/local-import";
import type { ImportPayload } from "@/services/supabase-repositories";
import type {
  Activity,
  CategoryId,
  Habit,
  HabitFrequency,
  HabitKind,
  HabitLog,
  Note,
  NoteKind,
  Priority,
  SpecialDate,
  SpecialDateKind,
  Task,
} from "@/types/planner";

/**
 * Copia de seguridad en JSON: exportar todos los datos y volver a importarlos.
 *
 * El archivo lo puede editar cualquiera, así que al importar **nada se da por
 * bueno**: cada campo se valida y se normaliza a los mismos límites que la base
 * de datos. Un elemento inválido se descarta (y se cuenta) sin tumbar el resto.
 * Pura: sin navegador ni red, para poder probarla.
 */

export const BACKUP_FORMAT = "orgrow-backup";
export const BACKUP_VERSION = 1;
/** Tope de tamaño del archivo (texto), para no colgar el navegador con uno enorme. */
export const MAX_BACKUP_CHARS = 10_000_000;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Cuenta de origen; si coincide con la de destino se conservan los ids (restaurar sin duplicar). */
  owner: string | null;
  data: ImportPayload;
}

export function createBackup(data: ImportPayload, owner: string | null, now: Date): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    owner,
    data,
  };
}

export function backupFileName(now: Date): string {
  return `orgrow-copia-${now.toISOString().slice(0, 10)}.json`;
}

/* -------------------------------------------------------------------------- */
/* Lectura defensiva                                                          */
/* -------------------------------------------------------------------------- */

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length >= min && clean.length <= max ? clean : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function time(value: unknown): string | null {
  return typeof value === "string" && TIME.test(value) ? value : null;
}

function millis(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 8.64e15
    ? Math.trunc(value)
    : fallback;
}

function positive(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max
    ? Math.round(value * 100) / 100
    : null;
}

function remind(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10080
    ? value
    : null;
}

/* -------------------------------------------------------------------------- */
/* Un lector por tipo; devuelven null si el elemento no vale                   */
/* -------------------------------------------------------------------------- */

function readTask(raw: unknown, now: number): Task | null {
  if (!isObject(raw)) return null;
  const id = text(raw["id"], 1, 100);
  const title = text(raw["title"], 1, 200);
  const category = oneOf<CategoryId>(raw["category"], CATEGORY_IDS);
  const priority = oneOf<Priority>(raw["priority"], PRIORITY_IDS);
  if (!id || !title || !category || !priority) return null;

  const dueDate = isValidISODate(raw["dueDate"]) ? raw["dueDate"] : null;
  const taskTime = dueDate ? time(raw["time"]) : null;
  const completed = raw["completed"] === true;
  const createdAt = millis(raw["createdAt"], now);
  const remindBefore = dueDate ? remind(raw["remindBefore"]) : null;

  return {
    id,
    title,
    category,
    priority,
    dueDate,
    ...(taskTime ? { time: taskTime } : {}),
    completed,
    remindBefore,
    completedAt: completed ? millis(raw["completedAt"], createdAt) : null,
    createdAt,
    updatedAt: millis(raw["updatedAt"], createdAt),
  };
}

function readNote(raw: unknown, now: number): Note | null {
  if (!isObject(raw)) return null;
  const id = text(raw["id"], 1, 100);
  const content = text(raw["content"], 1, 4000);
  const kind = oneOf<NoteKind>(raw["kind"], NOTE_KIND_IDS);
  if (!id || !content || !kind) return null;

  return {
    id,
    content,
    kind,
    pinned: raw["pinned"] === true,
    createdAt: millis(raw["createdAt"], now),
  };
}

function readActivity(raw: unknown, now: number): Activity | null {
  if (!isObject(raw)) return null;
  const id = text(raw["id"], 1, 100);
  const title = text(raw["title"], 1, 200);
  const category = oneOf<CategoryId>(raw["category"], CATEGORY_IDS);
  const start = time(raw["start"]);
  if (!id || !title || !category || !start || !isValidISODate(raw["date"])) return null;

  const end = time(raw["end"]);
  const location = text(raw["location"], 1, 200);
  const createdAt = millis(raw["createdAt"], now);

  return {
    id,
    title,
    category,
    date: raw["date"],
    start,
    // Un fin anterior al inicio violaría la restricción de la base de datos.
    ...(end && end > start ? { end } : {}),
    ...(location ? { location } : {}),
    remindBefore: remind(raw["remindBefore"]),
    createdAt,
    updatedAt: millis(raw["updatedAt"], createdAt),
  };
}

function readSpecialDate(raw: unknown, now: number): SpecialDate | null {
  if (!isObject(raw)) return null;
  const id = text(raw["id"], 1, 100);
  const title = text(raw["title"], 1, 100);
  const kind = oneOf<SpecialDateKind>(raw["kind"], SPECIAL_DATE_KIND_IDS);
  const month = raw["month"];
  const day = raw["day"];
  if (!id || !title || !kind) return null;
  if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > maxDayOfMonth(month)) {
    return null;
  }
  const year = raw["year"];
  const remindBeforeDays = raw["remindBeforeDays"];
  const createdAt = millis(raw["createdAt"], now);

  return {
    id,
    title,
    kind,
    month,
    day,
    ...(typeof year === "number" && Number.isInteger(year) && year >= 1 && year <= 9999
      ? { year }
      : {}),
    remindBeforeDays:
      typeof remindBeforeDays === "number" &&
      Number.isInteger(remindBeforeDays) &&
      remindBeforeDays >= 0 &&
      remindBeforeDays <= 30
        ? remindBeforeDays
        : null,
    createdAt,
    updatedAt: millis(raw["updatedAt"], createdAt),
  };
}

function readFrequency(raw: unknown): HabitFrequency | null {
  if (!isObject(raw)) return null;
  if (raw["type"] === "daily") return { type: "daily" };

  if (raw["type"] === "weekdays") {
    const days = Array.isArray(raw["days"])
      ? [
          ...new Set(
            raw["days"].filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6),
          ),
        ].sort()
      : [];
    return days.length > 0 ? { type: "weekdays", days } : null;
  }

  if (raw["type"] === "weekly") {
    const times = raw["times"];
    return typeof times === "number" && Number.isInteger(times) && times >= 1 && times <= 7
      ? { type: "weekly", times }
      : null;
  }
  return null;
}

function readHabit(raw: unknown, now: number): Habit | null {
  if (!isObject(raw)) return null;
  const id = text(raw["id"], 1, 100);
  const name = text(raw["name"], 1, 100);
  const kind = oneOf<HabitKind>(raw["kind"], ["check", "count", "time"]);
  const category = oneOf<CategoryId>(raw["category"], CATEGORY_IDS);
  const frequency = readFrequency(raw["frequency"]);
  if (!id || !name || !kind || !category || !frequency) return null;

  let target = 1;
  let step = 1;
  if (kind !== "check") {
    const t = positive(raw["target"], 99_999_999);
    const s = positive(raw["step"], 99_999_999);
    if (t === null || s === null) return null;
    target = t;
    step = s;
  }
  const unit = kind === "count" ? text(raw["unit"], 1, 20) : null;
  const createdAt = millis(raw["createdAt"], now);

  return {
    id,
    name,
    kind,
    target,
    step,
    ...(unit ? { unit } : {}),
    frequency,
    category,
    archived: raw["archived"] === true,
    createdAt,
    updatedAt: millis(raw["updatedAt"], createdAt),
  };
}

function readLog(raw: unknown): HabitLog | null {
  if (!isObject(raw)) return null;
  const habitId = text(raw["habitId"], 1, 100);
  const value = positive(raw["value"], 99_999_999);
  if (!habitId || value === null || !isValidISODate(raw["date"])) return null;
  return { id: "", habitId, date: raw["date"], value };
}

/* -------------------------------------------------------------------------- */
/* Lectura del archivo completo                                               */
/* -------------------------------------------------------------------------- */

export interface ParsedBackup {
  owner: string | null;
  payload: ImportPayload;
  /** Elementos que no eran válidos y se han saltado. */
  skipped: number;
}

export type BackupResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

function readList<T>(
  raw: unknown,
  read: (item: unknown) => T | null,
): { items: T[]; skipped: number } {
  if (!Array.isArray(raw)) return { items: [], skipped: 0 };
  const items: T[] = [];
  let skipped = 0;
  for (const entry of raw) {
    const item = read(entry);
    if (item) items.push(item);
    else skipped += 1;
  }
  return { items, skipped };
}

export function parseBackup(source: string, now: number = Date.now()): BackupResult {
  if (source.length > MAX_BACKUP_CHARS)
    return { ok: false, error: "El archivo es demasiado grande." };

  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    return { ok: false, error: "El archivo no es una copia de Orgrow válida (no es JSON)." };
  }

  if (!isObject(json) || json["format"] !== BACKUP_FORMAT || !isObject(json["data"])) {
    return { ok: false, error: "Este archivo no es una copia de seguridad de Orgrow." };
  }
  if (typeof json["version"] !== "number" || json["version"] > BACKUP_VERSION) {
    return {
      ok: false,
      error: "La copia es de una versión más nueva de Orgrow. Actualiza la app.",
    };
  }

  const data = json["data"];
  const tasks = readList(data["tasks"], (item) => readTask(item, now));
  const notes = readList(data["notes"], (item) => readNote(item, now));
  const activities = readList(data["activities"], (item) => readActivity(item, now));
  const habits = readList(data["habits"], (item) => readHabit(item, now));
  const logs = readList(data["habitLogs"], readLog);
  const specialDates = readList(data["specialDates"], (item) => readSpecialDate(item, now));

  // Un registro de hábito sin su hábito (o repetido el mismo día) no sirve.
  const habitIds = new Set(habits.items.map((habit) => habit.id));
  const seen = new Set<string>();
  const habitLogs: HabitLog[] = [];
  let orphanLogs = 0;
  for (const log of logs.items) {
    const key = `${log.habitId}:${log.date}`;
    if (!habitIds.has(log.habitId) || seen.has(key)) {
      orphanLogs += 1;
      continue;
    }
    seen.add(key);
    habitLogs.push({ ...log, id: habitLogId(log.habitId, log.date) });
  }

  const owner =
    typeof json["owner"] === "string" && UUID.test(json["owner"]) ? json["owner"] : null;

  return {
    ok: true,
    backup: {
      owner,
      payload: {
        tasks: tasks.items,
        notes: notes.items,
        activities: activities.items,
        habits: habits.items,
        habitLogs,
        specialDates: specialDates.items,
      },
      skipped:
        tasks.skipped +
        notes.skipped +
        activities.skipped +
        habits.skipped +
        logs.skipped +
        specialDates.skipped +
        orphanLogs,
    },
  };
}

/**
 * Prepara los ids para la cuenta de destino. Los ids de una copia pueden
 * pertenecer a otro usuario (y la base de datos los rechazaría), así que:
 *  - misma cuenta de origen y destino y id con forma de uuid → se conserva (restaurar);
 *  - en cualquier otro caso → uuid **derivado** de la cuenta y del id, que es estable:
 *    importar dos veces el mismo archivo no duplica nada.
 */
export function assignBackupIds(parsed: ParsedBackup, userId: string): ImportPayload {
  const same = parsed.owner !== null && parsed.owner === userId;
  const idFor = (kind: string, id: string) =>
    same && UUID.test(id) ? id : deterministicUuid(`${userId}:backup:${kind}:${id}`);

  const habitIds = new Map(
    parsed.payload.habits.map((habit) => [habit.id, idFor("habit", habit.id)] as const),
  );

  return {
    tasks: parsed.payload.tasks.map((task) => ({ ...task, id: idFor("task", task.id) })),
    notes: parsed.payload.notes.map((note) => ({ ...note, id: idFor("note", note.id) })),
    activities: parsed.payload.activities.map((activity) => ({
      ...activity,
      id: idFor("activity", activity.id),
    })),
    specialDates: (parsed.payload.specialDates ?? []).map((date) => ({
      ...date,
      id: idFor("special-date", date.id),
    })),
    habits: parsed.payload.habits.map((habit) => ({ ...habit, id: habitIds.get(habit.id)! })),
    habitLogs: parsed.payload.habitLogs.map((log) => {
      const habitId = habitIds.get(log.habitId)!;
      return { ...log, habitId, id: habitLogId(habitId, log.date) };
    }),
  };
}
