import { CATEGORY_IDS, PRIORITY_IDS } from "@/config/categories";
import { createSampleTasks } from "@/data/sample-data";
import { isoFromOffset, isValidISODate } from "@/lib/dates";
import { createId } from "@/lib/planner";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { Task } from "@/types/planner";

/**
 * Persistence contract for tasks. It mirrors a `tasks` table on purpose:
 * swapping `localStorage` for Supabase means writing another implementation
 * with the same four methods, with zero changes in the UI.
 */
export interface TasksRepository {
  list(): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = STORAGE_KEYS.tasks;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function readTime(value: unknown): string | undefined {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : undefined;
}

/** Accepts the legacy frontend-only shape (`dayOffset`) so old data never crashes. */
function readDueDate(raw: Record<string, unknown>): string | null {
  const dueDate = raw["dueDate"];
  if (isValidISODate(dueDate)) return dueDate;

  const dayOffset = raw["dayOffset"];
  if (typeof dayOffset === "number" && Number.isFinite(dayOffset)) {
    return isoFromOffset(Math.trunc(dayOffset), new Date());
  }
  return null;
}

function normalizeTask(value: unknown, now: number): Task | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const title = typeof raw["title"] === "string" ? raw["title"].trim() : "";
  if (!title) return null;

  const category = CATEGORY_IDS.find((id) => id === raw["category"]);
  const priority = PRIORITY_IDS.find((id) => id === raw["priority"]);
  if (!category || !priority) return null;

  const id = typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("t");

  return {
    id,
    title,
    category,
    priority,
    dueDate: readDueDate(raw),
    time: readTime(raw["time"]),
    completed: raw["completed"] === true,
    completedAt: typeof raw["completedAt"] === "number" ? raw["completedAt"] : null,
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : now,
  };
}

function persist(tasks: Task[]): void {
  if (!saveCollection(STORAGE_KEY, tasks)) {
    throw new Error("No se pudieron guardar las tareas en este navegador");
  }
}

/** Reads stored tasks and seeds the demo ones only on the very first run. */
function loadOrSeed(): Task[] {
  const stored = loadCollection<unknown>(STORAGE_KEY);

  if (stored) {
    const now = Date.now();
    const items = stored.items
      .map((item) => normalizeTask(item, now))
      .filter((task): task is Task => task !== null);

    // Once seeded, an empty list is a valid state: the user deleted everything.
    if (stored.seeded || items.length > 0) return items;
  }

  const seeded = createSampleTasks(new Date());
  persist(seeded);
  return seeded;
}

export function createLocalTasksRepository(): TasksRepository {
  return {
    async list() {
      return loadOrSeed();
    },

    async create(task: Task) {
      persist([...loadOrSeed(), task]);
      return task;
    },

    async update(task: Task) {
      const tasks = loadOrSeed();
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index === -1) throw new Error(`No existe la tarea "${task.id}"`);

      const next = [...tasks];
      next[index] = task;
      persist(next);
      return task;
    },

    async remove(id: string) {
      const tasks = loadOrSeed();
      const next = tasks.filter((task) => task.id !== id);
      if (next.length === tasks.length) return;
      persist(next);
    },
  };
}
