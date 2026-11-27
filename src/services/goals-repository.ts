import { CATEGORY_IDS } from "@/config/categories";
import { isValidISODate, toISODate } from "@/lib/dates";
import { normalizeMilestones } from "@/lib/goals";
import { createId } from "@/lib/planner";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { Goal } from "@/types/planner";

/** Same four-method contract as the other repositories, so Supabase can replace it. */
export interface GoalsRepository {
  list(): Promise<Goal[]>;
  create(goal: Goal): Promise<Goal>;
  update(goal: Goal): Promise<Goal>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = STORAGE_KEYS.goals;

function normalize(value: unknown, now: number): Goal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const title = typeof raw["title"] === "string" ? raw["title"].trim() : "";
  const category = CATEGORY_IDS.find((id) => id === raw["category"]);
  if (!title || !category) return null;

  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("g"),
    title,
    category,
    dueDate: isValidISODate(raw["dueDate"]) ? raw["dueDate"] : null,
    startDate: isValidISODate(raw["startDate"]) ? raw["startDate"] : toISODate(new Date(now)),
    achievedAt: typeof raw["achievedAt"] === "number" ? raw["achievedAt"] : null,
    milestones: normalizeMilestones(raw["milestones"]),
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : now,
  };
}

function load(): Goal[] {
  const stored = loadCollection<unknown>(STORAGE_KEY);
  if (!stored) return [];
  const now = Date.now();
  return stored.items
    .map((item) => normalize(item, now))
    .filter((item): item is Goal => item !== null);
}

function persist(goals: Goal[]): void {
  if (!saveCollection(STORAGE_KEY, goals)) {
    throw new Error("No se pudieron guardar los objetivos en este navegador");
  }
}

export function createLocalGoalsRepository(): GoalsRepository {
  return {
    async list() {
      return load();
    },

    async create(goal) {
      persist([...load(), goal]);
      return goal;
    },

    async update(goal) {
      const goals = load();
      const index = goals.findIndex((item) => item.id === goal.id);
      if (index === -1) throw new Error(`No existe el objetivo "${goal.id}"`);
      const next = [...goals];
      next[index] = goal;
      persist(next);
      return goal;
    },

    async remove(id) {
      const goals = load();
      const next = goals.filter((goal) => goal.id !== id);
      if (next.length !== goals.length) persist(next);
    },
  };
}
