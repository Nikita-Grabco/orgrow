import { SPECIAL_DATE_KIND_IDS } from "@/config/special-dates";
import { createId } from "@/lib/planner";
import { maxDayOfMonth } from "@/lib/special-dates";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { SpecialDate } from "@/types/planner";

/** Same four-method contract as the other repositories, so Supabase can replace it. */
export interface SpecialDatesRepository {
  list(): Promise<SpecialDate[]>;
  create(date: SpecialDate): Promise<SpecialDate>;
  update(date: SpecialDate): Promise<SpecialDate>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = STORAGE_KEYS.specialDates;

function readRemind(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 30
    ? value
    : null;
}

function normalize(value: unknown, now: number): SpecialDate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const title = typeof raw["title"] === "string" ? raw["title"].trim() : "";
  const kind = SPECIAL_DATE_KIND_IDS.find((id) => id === raw["kind"]);
  const month = raw["month"];
  const day = raw["day"];
  if (!title || !kind) return null;
  if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > maxDayOfMonth(month)) {
    return null;
  }
  const year = raw["year"];

  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("d"),
    title,
    kind,
    month,
    day,
    year:
      typeof year === "number" && Number.isInteger(year) && year >= 1 && year <= 9999
        ? year
        : undefined,
    remindBeforeDays: readRemind(raw["remindBeforeDays"]),
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : now,
  };
}

function load(): SpecialDate[] {
  const stored = loadCollection<unknown>(STORAGE_KEY);
  if (!stored) return [];
  const now = Date.now();
  return stored.items
    .map((item) => normalize(item, now))
    .filter((item): item is SpecialDate => item !== null);
}

function persist(dates: SpecialDate[]): void {
  if (!saveCollection(STORAGE_KEY, dates)) {
    throw new Error("No se pudieron guardar las fechas en este navegador");
  }
}

export function createLocalSpecialDatesRepository(): SpecialDatesRepository {
  return {
    async list() {
      return load();
    },

    async create(date) {
      persist([...load(), date]);
      return date;
    },

    async update(date) {
      const dates = load();
      const index = dates.findIndex((item) => item.id === date.id);
      if (index === -1) throw new Error(`No existe la fecha "${date.id}"`);
      const next = [...dates];
      next[index] = date;
      persist(next);
      return date;
    },

    async remove(id) {
      const dates = load();
      const next = dates.filter((date) => date.id !== id);
      if (next.length !== dates.length) persist(next);
    },
  };
}
