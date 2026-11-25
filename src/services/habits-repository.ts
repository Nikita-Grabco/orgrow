import { CATEGORY_IDS } from "@/config/categories";
import { createSampleHabits } from "@/data/sample-data";
import { isValidISODate } from "@/lib/dates";
import { createId } from "@/lib/planner";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { Habit, HabitFrequency, HabitKind, HabitLog } from "@/types/planner";

/** Same four-method contract as tasks/notes/activities, so Supabase can replace it. */
export interface HabitsRepository {
  list(): Promise<Habit[]>;
  create(habit: Habit): Promise<Habit>;
  update(habit: Habit): Promise<Habit>;
  remove(id: string): Promise<void>;
}

/** One log per habit and day; writing the same day again replaces it. */
export interface HabitLogsRepository {
  list(): Promise<HabitLog[]>;
  upsert(log: HabitLog): Promise<HabitLog>;
  remove(id: string): Promise<void>;
  removeForHabit(habitId: string): Promise<void>;
}

const HABIT_KINDS: HabitKind[] = ["check", "count", "time"];

export function habitLogId(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readFrequency(value: unknown): HabitFrequency {
  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    if (raw["type"] === "weekdays" && Array.isArray(raw["days"])) {
      const days = [
        ...new Set(
          raw["days"].filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6),
        ),
      ].sort((a, b) => a - b);
      if (days.length > 0) return { type: "weekdays", days };
    }
    if (raw["type"] === "weekly") {
      const times = Math.round(positive(raw["times"], 1));
      return { type: "weekly", times: Math.min(7, times) };
    }
  }
  return { type: "daily" };
}

function normalizeHabit(value: unknown, now: number): Habit | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const name = typeof raw["name"] === "string" ? raw["name"].trim() : "";
  const kind = HABIT_KINDS.find((item) => item === raw["kind"]);
  const category = CATEGORY_IDS.find((id) => id === raw["category"]);
  if (!name || !kind || !category) return null;

  const unit =
    typeof raw["unit"] === "string" && raw["unit"].trim() ? raw["unit"].trim() : undefined;

  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("h"),
    name,
    kind,
    target: kind === "check" ? 1 : positive(raw["target"], 1),
    step: kind === "check" ? 1 : positive(raw["step"], kind === "time" ? 15 : 1),
    unit: kind === "count" ? unit : undefined,
    frequency: readFrequency(raw["frequency"]),
    category,
    archived: raw["archived"] === true,
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : now,
  };
}

function normalizeLog(value: unknown): HabitLog | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const habitId = raw["habitId"];
  const date = raw["date"];
  const amount = raw["value"];
  if (typeof habitId !== "string" || !habitId || !isValidISODate(date)) return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;

  return { id: habitLogId(habitId, date), habitId, date, value: amount };
}

function persistHabits(habits: Habit[]): void {
  if (!saveCollection(STORAGE_KEYS.habits, habits)) {
    throw new Error("No se pudieron guardar los hábitos en este navegador");
  }
}

function persistLogs(logs: HabitLog[]): void {
  if (!saveCollection(STORAGE_KEYS.habitLogs, logs)) {
    throw new Error("No se pudo guardar el progreso de los hábitos en este navegador");
  }
}

function loadOrSeedHabits(): Habit[] {
  const stored = loadCollection<unknown>(STORAGE_KEYS.habits);

  if (stored) {
    const now = Date.now();
    const items = stored.items
      .map((item) => normalizeHabit(item, now))
      .filter((habit): habit is Habit => habit !== null);

    if (stored.seeded || items.length > 0) return items;
  }

  const seeded = createSampleHabits(Date.now());
  persistHabits(seeded);
  return seeded;
}

function loadLogs(): HabitLog[] {
  const stored = loadCollection<unknown>(STORAGE_KEYS.habitLogs);
  if (!stored) return [];
  return stored.items.map(normalizeLog).filter((log): log is HabitLog => log !== null);
}

export function createLocalHabitsRepository(): HabitsRepository {
  return {
    async list() {
      return loadOrSeedHabits();
    },

    async create(habit) {
      persistHabits([...loadOrSeedHabits(), habit]);
      return habit;
    },

    async update(habit) {
      const habits = loadOrSeedHabits();
      const index = habits.findIndex((item) => item.id === habit.id);
      if (index === -1) throw new Error(`No existe el hábito "${habit.id}"`);

      const next = [...habits];
      next[index] = habit;
      persistHabits(next);
      return habit;
    },

    async remove(id) {
      const habits = loadOrSeedHabits();
      const next = habits.filter((habit) => habit.id !== id);
      if (next.length === habits.length) return;
      persistHabits(next);
    },
  };
}

export function createLocalHabitLogsRepository(): HabitLogsRepository {
  return {
    async list() {
      return loadLogs();
    },

    async upsert(log) {
      const rest = loadLogs().filter((item) => item.id !== log.id);
      persistLogs([...rest, log]);
      return log;
    },

    async remove(id) {
      const logs = loadLogs();
      const next = logs.filter((log) => log.id !== id);
      if (next.length === logs.length) return;
      persistLogs(next);
    },

    async removeForHabit(habitId) {
      const logs = loadLogs();
      const next = logs.filter((log) => log.habitId !== habitId);
      if (next.length === logs.length) return;
      persistLogs(next);
    },
  };
}
