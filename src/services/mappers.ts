/**
 * Único sitio donde la base de datos (snake_case, tipos de Postgres) se traduce
 * a los tipos del dominio (camelCase, ver `src/types/planner.ts`) y al revés.
 *
 * Los repositorios de Supabase (Parte 4) solo hablan con este módulo, así la UI
 * nunca ve una fila cruda y un cambio de columna se arregla en un solo lugar.
 *
 * Reglas de conversión:
 *  - `date` llega como "YYYY-MM-DD": coincide con el dominio, se pasa tal cual.
 *  - `time` llega como "HH:mm:ss": el dominio usa "HH:mm", se recorta.
 *  - `timestamptz` llega como ISO: el dominio usa milisegundos desde epoch.
 *  - `numeric` puede llegar como número o texto según el cliente: se normaliza.
 *  - `user_id`, `created_at` y `updated_at` los rellena el servidor al escribir.
 */

import { normalizeMilestones } from "@/lib/goals";
import { habitLogId } from "@/services/habits-repository";
import type {
  Activity,
  ActivityPatch,
  CategoryId,
  Habit,
  HabitFrequency,
  HabitKind,
  HabitLog,
  HabitPatch,
  NewActivityInput,
  NewHabitInput,
  NewNoteInput,
  Goal,
  GoalPatch,
  NewGoalInput,
  NewSpecialDateInput,
  NewTaskInput,
  Note,
  NoteKind,
  NotePatch,
  Priority,
  SpecialDate,
  SpecialDateKind,
  SpecialDatePatch,
  Task,
  TaskPatch,
} from "@/types/planner";

/* -------------------------------------------------------------------------- */
/* Filas (lo que devuelve la base de datos)                                   */
/* -------------------------------------------------------------------------- */

export interface ProfileRow {
  id: string;
  display_name: string;
  timezone: string;
}

export interface TaskRow {
  id: string;
  title: string;
  category: CategoryId;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  completed: boolean;
  completed_at: string | null;
  /** Ausente mientras no se aplique `docs/supabase-reminders.sql`. */
  remind_before_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  content: string;
  kind: NoteKind;
  pinned: boolean;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  title: string;
  category: CategoryId;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  remind_before_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface HabitRow {
  id: string;
  name: string;
  kind: HabitKind;
  target: number | string;
  step: number | string;
  unit: string | null;
  frequency_type: HabitFrequency["type"];
  frequency_days: number[] | null;
  frequency_times: number | null;
  category: CategoryId;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitLogRow {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | string;
}

export interface GoalRow {
  id: string;
  title: string;
  category: CategoryId;
  due_date: string | null;
  start_date: string;
  achieved_at: string | null;
  milestones: unknown;
  created_at: string;
  updated_at: string;
}

export interface SpecialDateRow {
  id: string;
  title: string;
  kind: SpecialDateKind;
  month: number;
  day: number;
  year: number | null;
  remind_before_days: number | null;
  created_at: string;
  updated_at: string;
}

/** Perfil tal como lo usa la app. */
export interface Profile {
  id: string;
  displayName: string;
  timezone: string;
}

/* -------------------------------------------------------------------------- */
/* Conversiones básicas                                                       */
/* -------------------------------------------------------------------------- */

/** "09:30:00" → "09:30". Acepta ya "09:30". */
export function timeFromDb(value: string | null): string | undefined {
  return value ? value.slice(0, 5) : undefined;
}

/** ISO de Postgres → milisegundos. Una fecha ilegible cae a 0, nunca a NaN. */
export function millisFromDb(value: string | null): number {
  if (!value) return 0;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 0 : millis;
}

export function millisToDb(value: number): string {
  return new Date(value).toISOString();
}

const numberFromDb = (value: number | string): number => Number(value);

/**
 * Al crear solo se envía la columna cuando hay aviso: sin él no hace falta, y así
 * la app sigue guardando aunque `docs/supabase-reminders.sql` no se haya aplicado.
 */
function reminderToInsert(minutes: number | null | undefined): number | undefined {
  return typeof minutes === "number" ? minutes : undefined;
}

/** Quita las claves con valor `undefined` para no enviar columnas que no cambian. */
function defined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/* -------------------------------------------------------------------------- */
/* Perfil                                                                     */
/* -------------------------------------------------------------------------- */

export function profileFromRow(row: ProfileRow): Profile {
  return { id: row.id, displayName: row.display_name, timezone: row.timezone };
}

/* -------------------------------------------------------------------------- */
/* Tareas                                                                     */
/* -------------------------------------------------------------------------- */

export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    dueDate: row.due_date,
    time: timeFromDb(row.due_time),
    completed: row.completed,
    // `undefined` (columna inexistente) se distingue de `null` (sin aviso).
    remindBefore: row.remind_before_minutes,
    completedAt: row.completed_at ? millisFromDb(row.completed_at) : null,
    createdAt: millisFromDb(row.created_at),
    updatedAt: millisFromDb(row.updated_at),
  };
}

/** `id` opcional: el cliente puede generarlo (crypto.randomUUID) para la UI optimista. */
export function taskToInsert(input: NewTaskInput, id?: string) {
  return defined({
    id,
    title: input.title,
    category: input.category,
    priority: input.priority,
    due_date: input.dueDate,
    due_time: input.time ?? null,
    remind_before_minutes: reminderToInsert(input.remindBefore),
  });
}

export function taskToUpdate(patch: TaskPatch) {
  return defined({
    title: patch.title,
    category: patch.category,
    priority: patch.priority,
    due_date: patch.dueDate,
    // `undefined` = sin cambios; la UI limpia la hora con `null` en la fila.
    due_time: "time" in patch ? (patch.time ?? null) : undefined,
    remind_before_minutes: patch.remindBefore,
    completed: patch.completed,
    completed_at:
      patch.completedAt === undefined
        ? undefined
        : patch.completedAt === null
          ? null
          : millisToDb(patch.completedAt),
  });
}

/* -------------------------------------------------------------------------- */
/* Notas                                                                      */
/* -------------------------------------------------------------------------- */

export function noteFromRow(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    kind: row.kind,
    pinned: row.pinned,
    createdAt: millisFromDb(row.created_at),
  };
}

export function noteToInsert(input: NewNoteInput, id?: string) {
  return defined({ id, content: input.content, kind: input.kind });
}

export function noteToUpdate(patch: NotePatch) {
  return defined({ content: patch.content, kind: patch.kind, pinned: patch.pinned });
}

/* -------------------------------------------------------------------------- */
/* Actividades                                                                */
/* -------------------------------------------------------------------------- */

export function activityFromRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    start: row.start_time.slice(0, 5),
    end: timeFromDb(row.end_time),
    location: row.location ?? undefined,
    remindBefore: row.remind_before_minutes,
    createdAt: millisFromDb(row.created_at),
    updatedAt: millisFromDb(row.updated_at),
  };
}

export function activityToInsert(input: NewActivityInput, id?: string) {
  return defined({
    id,
    title: input.title,
    category: input.category,
    date: input.date,
    start_time: input.start,
    end_time: input.end ?? null,
    location: input.location ?? null,
    remind_before_minutes: reminderToInsert(input.remindBefore),
  });
}

export function activityToUpdate(patch: ActivityPatch) {
  return defined({
    title: patch.title,
    category: patch.category,
    date: patch.date,
    start_time: patch.start,
    // `null` limpia el valor opcional; `undefined` no lo toca.
    end_time: patch.end,
    location: patch.location,
    remind_before_minutes: patch.remindBefore,
  });
}

/* -------------------------------------------------------------------------- */
/* Hábitos                                                                    */
/* -------------------------------------------------------------------------- */

function frequencyFromRow(row: HabitRow): HabitFrequency {
  if (row.frequency_type === "weekdays") {
    return { type: "weekdays", days: [...(row.frequency_days ?? [])] };
  }
  if (row.frequency_type === "weekly") {
    return { type: "weekly", times: row.frequency_times ?? 1 };
  }
  return { type: "daily" };
}

/** Las tres columnas de frecuencia, coherentes con el CHECK de la tabla. */
function frequencyToDb(frequency: HabitFrequency) {
  return {
    frequency_type: frequency.type,
    frequency_days: frequency.type === "weekdays" ? frequency.days : null,
    frequency_times: frequency.type === "weekly" ? frequency.times : null,
  };
}

export function habitFromRow(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    target: numberFromDb(row.target),
    step: numberFromDb(row.step),
    unit: row.unit ?? undefined,
    frequency: frequencyFromRow(row),
    category: row.category,
    archived: row.archived,
    createdAt: millisFromDb(row.created_at),
    updatedAt: millisFromDb(row.updated_at),
  };
}

export function habitToInsert(input: NewHabitInput, id?: string) {
  return defined({
    id,
    name: input.name,
    kind: input.kind,
    target: input.target,
    step: input.step,
    unit: input.kind === "count" ? (input.unit ?? null) : null,
    category: input.category,
    ...frequencyToDb(input.frequency),
  });
}

export function habitToUpdate(patch: HabitPatch) {
  return defined({
    name: patch.name,
    kind: patch.kind,
    target: patch.target,
    step: patch.step,
    unit: patch.unit,
    category: patch.category,
    archived: patch.archived,
    ...(patch.frequency ? frequencyToDb(patch.frequency) : {}),
  });
}

/* -------------------------------------------------------------------------- */
/* Registros de hábito                                                        */
/* -------------------------------------------------------------------------- */

export function habitLogFromRow(row: HabitLogRow): HabitLog {
  return {
    // El dominio identifica un registro por hábito y día (igual que en local);
    // el uuid de la fila no sale de aquí.
    id: habitLogId(row.habit_id, row.log_date),
    habitId: row.habit_id,
    date: row.log_date,
    value: numberFromDb(row.value),
  };
}

export function habitLogToUpsert(log: Pick<HabitLog, "habitId" | "date" | "value">, id?: string) {
  return defined({ id, habit_id: log.habitId, log_date: log.date, value: log.value });
}

/* -------------------------------------------------------------------------- */
/* Fechas importantes                                                         */
/* -------------------------------------------------------------------------- */

export function specialDateFromRow(row: SpecialDateRow): SpecialDate {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    month: row.month,
    day: row.day,
    year: row.year ?? undefined,
    remindBeforeDays: row.remind_before_days,
    createdAt: millisFromDb(row.created_at),
    updatedAt: millisFromDb(row.updated_at),
  };
}

export function specialDateToInsert(input: NewSpecialDateInput, id?: string) {
  return defined({
    id,
    title: input.title,
    kind: input.kind,
    month: input.month,
    day: input.day,
    year: input.year ?? null,
    remind_before_days: input.remindBeforeDays ?? null,
  });
}

export function specialDateToUpdate(patch: SpecialDatePatch) {
  return defined({
    title: patch.title,
    kind: patch.kind,
    month: patch.month,
    day: patch.day,
    // `null` limpia el valor opcional; `undefined` no lo toca.
    year: patch.year,
    remind_before_days: patch.remindBeforeDays,
  });
}

/* -------------------------------------------------------------------------- */
/* Objetivos                                                                  */
/* -------------------------------------------------------------------------- */

export function goalFromRow(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    startDate: row.start_date,
    achievedAt: row.achieved_at ? millisFromDb(row.achieved_at) : null,
    milestones: normalizeMilestones(row.milestones),
    createdAt: millisFromDb(row.created_at),
    updatedAt: millisFromDb(row.updated_at),
  };
}

export function goalToInsert(input: NewGoalInput & { startDate?: string }, id?: string) {
  return defined({
    id,
    title: input.title,
    category: input.category,
    due_date: input.dueDate,
    start_date: input.startDate,
    milestones: input.milestones,
  });
}

export function goalToUpdate(patch: GoalPatch) {
  return defined({
    title: patch.title,
    category: patch.category,
    due_date: patch.dueDate,
    achieved_at:
      patch.achievedAt === undefined
        ? undefined
        : patch.achievedAt === null
          ? null
          : millisToDb(patch.achievedAt),
    milestones: patch.milestones,
  });
}
