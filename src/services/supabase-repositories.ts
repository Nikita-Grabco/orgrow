import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createLocalActivitiesRepository,
  type ActivitiesRepository,
} from "@/services/activities-repository";
import {
  createLocalHabitLogsRepository,
  createLocalHabitsRepository,
  parseHabitLogId,
  type HabitLogsRepository,
  type HabitsRepository,
} from "@/services/habits-repository";
import {
  activityFromRow,
  activityToInsert,
  activityToUpdate,
  habitFromRow,
  goalFromRow,
  goalToInsert,
  goalToUpdate,
  habitLogFromRow,
  habitLogToUpsert,
  habitToInsert,
  habitToUpdate,
  millisToDb,
  noteFromRow,
  noteToInsert,
  noteToUpdate,
  specialDateFromRow,
  specialDateToInsert,
  specialDateToUpdate,
  taskFromRow,
  taskToInsert,
  taskToUpdate,
  type ActivityRow,
  type GoalRow,
  type HabitLogRow,
  type HabitRow,
  type NoteRow,
  type SpecialDateRow,
  type TaskRow,
} from "@/services/mappers";
import { createLocalGoalsRepository, type GoalsRepository } from "@/services/goals-repository";
import {
  createLocalSpecialDatesRepository,
  type SpecialDatesRepository,
} from "@/services/special-dates-repository";
import { createLocalNotesRepository, type NotesRepository } from "@/services/notes-repository";
import { createLocalTasksRepository, type TasksRepository } from "@/services/tasks-repository";
import type { Activity, Goal, Habit, HabitLog, Note, SpecialDate, Task } from "@/types/planner";

/** Los repositorios que necesita el store, sea cual sea el almacenamiento. */
export interface PlannerRepositories {
  tasks: TasksRepository;
  notes: NotesRepository;
  activities: ActivitiesRepository;
  habits: HabitsRepository;
  habitLogs: HabitLogsRepository;
  specialDates: SpecialDatesRepository;
  goals: GoalsRepository;
}

export function createLocalPlannerRepositories(): PlannerRepositories {
  return {
    tasks: createLocalTasksRepository(),
    notes: createLocalNotesRepository(),
    activities: createLocalActivitiesRepository(),
    habits: createLocalHabitsRepository(),
    habitLogs: createLocalHabitLogsRepository(),
    specialDates: createLocalSpecialDatesRepository(),
    goals: createLocalGoalsRepository(),
  };
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

/** PostgREST devuelve como máximo 1000 filas por petición. */
const PAGE_SIZE = 1000;

interface Failure {
  message: string;
}

/** Los repositorios lanzan siempre un `Error`; el store lo muestra y recarga. */
function fail(error: Failure): never {
  throw error instanceof Error ? error : new Error(error.message);
}

interface OrderBy {
  column: string;
  ascending: boolean;
}

/** Lee la tabla completa, paginando, con un orden estable (el último criterio es el id). */
async function fetchAll<Row>(
  client: SupabaseClient,
  table: string,
  order: OrderBy[],
): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select("*");
    for (const { column, ascending } of [...order, { column: "id", ascending: true }]) {
      query = query.order(column, { ascending });
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) fail(error);

    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Borra por id. No falla si la fila ya no existe: el resultado deseado ya se da. */
async function removeById(client: SupabaseClient, table: string, id: string): Promise<void> {
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) fail(error);
}

/* -------------------------------------------------------------------------- */
/* Repositorios                                                               */
/* -------------------------------------------------------------------------- */

export function createSupabaseTasksRepository(client: SupabaseClient): TasksRepository {
  return {
    async list() {
      const rows = await fetchAll<TaskRow>(client, "tasks", [
        { column: "created_at", ascending: true },
      ]);
      return rows.map(taskFromRow);
    },

    async create(task) {
      const { data, error } = await client
        .from("tasks")
        .insert(taskToInsert(task, task.id))
        .select()
        .single<TaskRow>();
      if (error) fail(error);
      return taskFromRow(data);
    },

    async update(task) {
      const { data, error } = await client
        .from("tasks")
        .update(
          taskToUpdate({
            title: task.title,
            category: task.category,
            priority: task.priority,
            dueDate: task.dueDate,
            time: task.time,
            completed: task.completed,
            completedAt: task.completedAt ?? null,
            // `undefined` = el servidor aún no tiene la columna: no se envía.
            remindBefore: task.remindBefore,
          }),
        )
        .eq("id", task.id)
        .select()
        .maybeSingle<TaskRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe la tarea "${task.id}"`);
      return taskFromRow(data);
    },

    remove: (id) => removeById(client, "tasks", id),
  };
}

export function createSupabaseNotesRepository(client: SupabaseClient): NotesRepository {
  return {
    async list() {
      // Más recientes primero, igual que el repositorio local.
      const rows = await fetchAll<NoteRow>(client, "notes", [
        { column: "created_at", ascending: false },
      ]);
      return rows.map(noteFromRow);
    },

    async create(note) {
      const { data, error } = await client
        .from("notes")
        .insert(noteToInsert(note, note.id))
        .select()
        .single<NoteRow>();
      if (error) fail(error);
      return noteFromRow(data);
    },

    async update(note) {
      const { data, error } = await client
        .from("notes")
        .update(noteToUpdate({ content: note.content, kind: note.kind, pinned: note.pinned }))
        .eq("id", note.id)
        .select()
        .maybeSingle<NoteRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe la nota "${note.id}"`);
      return noteFromRow(data);
    },

    remove: (id) => removeById(client, "notes", id),
  };
}

export function createSupabaseActivitiesRepository(client: SupabaseClient): ActivitiesRepository {
  return {
    async list() {
      const rows = await fetchAll<ActivityRow>(client, "activities", [
        { column: "date", ascending: true },
        { column: "start_time", ascending: true },
      ]);
      return rows.map(activityFromRow);
    },

    async create(activity) {
      const { data, error } = await client
        .from("activities")
        .insert(activityToInsert(activity, activity.id))
        .select()
        .single<ActivityRow>();
      if (error) fail(error);
      return activityFromRow(data);
    },

    async update(activity) {
      const { data, error } = await client
        .from("activities")
        .update(
          activityToUpdate({
            title: activity.title,
            category: activity.category,
            date: activity.date,
            start: activity.start,
            end: activity.end ?? null,
            location: activity.location ?? null,
            remindBefore: activity.remindBefore,
          }),
        )
        .eq("id", activity.id)
        .select()
        .maybeSingle<ActivityRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe la actividad "${activity.id}"`);
      return activityFromRow(data);
    },

    remove: (id) => removeById(client, "activities", id),
  };
}

export function createSupabaseHabitsRepository(client: SupabaseClient): HabitsRepository {
  return {
    async list() {
      const rows = await fetchAll<HabitRow>(client, "habits", [
        { column: "created_at", ascending: true },
      ]);
      return rows.map(habitFromRow);
    },

    async create(habit) {
      const { data, error } = await client
        .from("habits")
        .insert(habitToInsert(habit, habit.id))
        .select()
        .single<HabitRow>();
      if (error) fail(error);
      return habitFromRow(data);
    },

    async update(habit) {
      const { data, error } = await client
        .from("habits")
        .update(
          habitToUpdate({
            name: habit.name,
            kind: habit.kind,
            target: habit.target,
            step: habit.step,
            unit: habit.unit ?? null,
            frequency: habit.frequency,
            category: habit.category,
            archived: habit.archived,
          }),
        )
        .eq("id", habit.id)
        .select()
        .maybeSingle<HabitRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe el hábito "${habit.id}"`);
      return habitFromRow(data);
    },

    remove: (id) => removeById(client, "habits", id),
  };
}

export function createSupabaseHabitLogsRepository(client: SupabaseClient): HabitLogsRepository {
  return {
    async list() {
      const rows = await fetchAll<HabitLogRow>(client, "habit_logs", [
        { column: "log_date", ascending: true },
      ]);
      return rows.map(habitLogFromRow);
    },

    async upsert(log) {
      // Una fila por hábito y día: la clave única decide si crea o reemplaza.
      const { data, error } = await client
        .from("habit_logs")
        .upsert(habitLogToUpsert(log), { onConflict: "habit_id,log_date" })
        .select()
        .single<HabitLogRow>();
      if (error) fail(error);
      return habitLogFromRow(data);
    },

    async remove(id) {
      const { habitId, date } = parseHabitLogId(id);
      const { error } = await client
        .from("habit_logs")
        .delete()
        .eq("habit_id", habitId)
        .eq("log_date", date);
      if (error) fail(error);
    },

    async removeForHabit(habitId) {
      const { error } = await client.from("habit_logs").delete().eq("habit_id", habitId);
      if (error) fail(error);
    },
  };
}

export function createSupabaseSpecialDatesRepository(
  client: SupabaseClient,
): SpecialDatesRepository {
  return {
    async list() {
      const rows = await fetchAll<SpecialDateRow>(client, "special_dates", [
        { column: "month", ascending: true },
        { column: "day", ascending: true },
      ]);
      return rows.map(specialDateFromRow);
    },

    async create(date) {
      const { data, error } = await client
        .from("special_dates")
        .insert(specialDateToInsert(date, date.id))
        .select()
        .single<SpecialDateRow>();
      if (error) fail(error);
      return specialDateFromRow(data);
    },

    async update(date) {
      const { data, error } = await client
        .from("special_dates")
        .update(
          specialDateToUpdate({
            title: date.title,
            kind: date.kind,
            month: date.month,
            day: date.day,
            year: date.year ?? null,
            remindBeforeDays: date.remindBeforeDays ?? null,
          }),
        )
        .eq("id", date.id)
        .select()
        .maybeSingle<SpecialDateRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe la fecha "${date.id}"`);
      return specialDateFromRow(data);
    },

    remove: (id) => removeById(client, "special_dates", id),
  };
}

export function createSupabaseGoalsRepository(client: SupabaseClient): GoalsRepository {
  return {
    async list() {
      const rows = await fetchAll<GoalRow>(client, "goals", [
        { column: "created_at", ascending: true },
      ]);
      return rows.map(goalFromRow);
    },

    async create(goal) {
      const { data, error } = await client
        .from("goals")
        .insert(goalToInsert(goal, goal.id))
        .select()
        .single<GoalRow>();
      if (error) fail(error);
      return goalFromRow(data);
    },

    async update(goal) {
      const { data, error } = await client
        .from("goals")
        .update(
          goalToUpdate({
            title: goal.title,
            category: goal.category,
            dueDate: goal.dueDate,
            achievedAt: goal.achievedAt,
            milestones: goal.milestones,
          }),
        )
        .eq("id", goal.id)
        .select()
        .maybeSingle<GoalRow>();
      if (error) fail(error);
      if (!data) throw new Error(`No existe el objetivo "${goal.id}"`);
      return goalFromRow(data);
    },

    remove: (id) => removeById(client, "goals", id),
  };
}

export function createSupabasePlannerRepositories(client: SupabaseClient): PlannerRepositories {
  return {
    tasks: createSupabaseTasksRepository(client),
    notes: createSupabaseNotesRepository(client),
    activities: createSupabaseActivitiesRepository(client),
    habits: createSupabaseHabitsRepository(client),
    habitLogs: createSupabaseHabitLogsRepository(client),
    specialDates: createSupabaseSpecialDatesRepository(client),
    goals: createSupabaseGoalsRepository(client),
  };
}

/* -------------------------------------------------------------------------- */
/* Importación de datos locales                                               */
/* -------------------------------------------------------------------------- */

export interface ImportPayload {
  tasks: Task[];
  notes: Note[];
  activities: Activity[];
  habits: Habit[];
  habitLogs: HabitLog[];
  /** Opcional: las copias antiguas no las traen. */
  specialDates?: SpecialDate[];
  goals?: Goal[];
}

/**
 * Sube de golpe datos que ya existían en este dispositivo. Usa `upsert` por id
 * para que repetir la importación (por ejemplo tras un corte de red a medias)
 * no cree duplicados. El orden respeta la clave foránea de `habit_logs`.
 */
export async function importPlannerData(
  client: SupabaseClient,
  data: ImportPayload,
): Promise<void> {
  const upsert = async (table: string, rows: object[], onConflict: string) => {
    if (rows.length === 0) return;
    const { error } = await client.from(table).upsert(rows, { onConflict });
    if (error) fail(error);
  };

  await upsert(
    "tasks",
    data.tasks.map((task) => ({
      ...taskToInsert(task, task.id),
      completed: task.completed,
      completed_at: task.completed && task.completedAt ? millisToDb(task.completedAt) : null,
      created_at: millisToDb(task.createdAt),
    })),
    "id",
  );

  await upsert(
    "notes",
    data.notes.map((note) => ({
      ...noteToInsert(note, note.id),
      pinned: note.pinned,
      created_at: millisToDb(note.createdAt),
    })),
    "id",
  );

  await upsert(
    "activities",
    data.activities.map((activity) => ({
      ...activityToInsert(activity, activity.id),
      created_at: millisToDb(activity.createdAt),
    })),
    "id",
  );

  await upsert(
    "habits",
    data.habits.map((habit) => ({
      ...habitToInsert(habit, habit.id),
      archived: habit.archived,
      created_at: millisToDb(habit.createdAt),
    })),
    "id",
  );

  await upsert(
    "goals",
    (data.goals ?? []).map((goal) => ({
      ...goalToInsert(goal, goal.id),
      achieved_at: goal.achievedAt ? millisToDb(goal.achievedAt) : null,
      created_at: millisToDb(goal.createdAt),
    })),
    "id",
  );

  await upsert(
    "special_dates",
    (data.specialDates ?? []).map((date) => ({
      ...specialDateToInsert(date, date.id),
      created_at: millisToDb(date.createdAt),
    })),
    "id",
  );

  await upsert(
    "habit_logs",
    data.habitLogs.map((log) => habitLogToUpsert(log)),
    "habit_id,log_date",
  );
}
