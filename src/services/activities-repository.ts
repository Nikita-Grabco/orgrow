import { CATEGORY_IDS } from "@/config/categories";
import { createSampleActivities } from "@/data/sample-data";
import { isoFromOffset, isValidISODate } from "@/lib/dates";
import { createId } from "@/lib/planner";
import { readTime } from "@/lib/time";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { Activity } from "@/types/planner";

/**
 * Persistence contract for activities. Same four methods as the tasks
 * repository, so the Supabase version is a drop-in replacement.
 */
export interface ActivitiesRepository {
  list(): Promise<Activity[]>;
  create(activity: Activity): Promise<Activity>;
  update(activity: Activity): Promise<Activity>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = STORAGE_KEYS.activities;

/** Accepts the legacy shape (`dayOffset`) so old data never crashes. */
function readDate(raw: Record<string, unknown>): string | null {
  const date = raw["date"];
  if (isValidISODate(date)) return date;

  const dayOffset = raw["dayOffset"];
  if (typeof dayOffset === "number" && Number.isFinite(dayOffset)) {
    return isoFromOffset(Math.trunc(dayOffset), new Date());
  }
  return null;
}

function normalizeActivity(value: unknown, now: number): Activity | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const title = typeof raw["title"] === "string" ? raw["title"].trim() : "";
  if (!title) return null;

  const category = CATEGORY_IDS.find((id) => id === raw["category"]);
  const date = readDate(raw);
  const start = readTime(raw["start"]);
  if (!category || !date || !start) return null;

  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("a"),
    title,
    category,
    date,
    start,
    end: readTime(raw["end"]),
    location:
      typeof raw["location"] === "string" && raw["location"].trim()
        ? raw["location"].trim()
        : undefined,
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : now,
  };
}

function persist(activities: Activity[]): void {
  if (!saveCollection(STORAGE_KEY, activities)) {
    throw new Error("No se pudieron guardar las actividades en este navegador");
  }
}

function loadOrSeed(): Activity[] {
  const stored = loadCollection<unknown>(STORAGE_KEY);

  if (stored) {
    const now = Date.now();
    const items = stored.items
      .map((item) => normalizeActivity(item, now))
      .filter((activity): activity is Activity => activity !== null);

    if (stored.seeded || items.length > 0) return items;
  }

  const seeded = createSampleActivities(new Date());
  persist(seeded);
  return seeded;
}

export function createLocalActivitiesRepository(): ActivitiesRepository {
  return {
    async list() {
      return loadOrSeed();
    },

    async create(activity: Activity) {
      persist([...loadOrSeed(), activity]);
      return activity;
    },

    async update(activity: Activity) {
      const activities = loadOrSeed();
      const index = activities.findIndex((item) => item.id === activity.id);
      if (index === -1) throw new Error(`No existe la actividad "${activity.id}"`);

      const next = [...activities];
      next[index] = activity;
      persist(next);
      return activity;
    },

    async remove(id: string) {
      const activities = loadOrSeed();
      const next = activities.filter((activity) => activity.id !== id);
      if (next.length === activities.length) return;
      persist(next);
    },
  };
}
