import { NOTE_KIND_IDS } from "@/config/categories";
import { createSampleNotes } from "@/data/sample-data";
import { createId } from "@/lib/planner";
import { loadCollection, saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { Note } from "@/types/planner";

/**
 * Persistence contract for notes. Same shape as `TasksRepository`, so a future
 * Supabase implementation stays symmetrical.
 */
export interface NotesRepository {
  list(): Promise<Note[]>;
  create(note: Note): Promise<Note>;
  update(note: Note): Promise<Note>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = STORAGE_KEYS.notes;

function normalizeNote(value: unknown, now: number): Note | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const content = typeof raw["content"] === "string" ? raw["content"].trim() : "";
  if (!content) return null;

  const kind = NOTE_KIND_IDS.find((id) => id === raw["kind"]);
  if (!kind) return null;

  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : createId("n"),
    content,
    kind,
    pinned: raw["pinned"] === true,
    createdAt: typeof raw["createdAt"] === "number" ? raw["createdAt"] : now,
  };
}

function persist(notes: Note[]): void {
  if (!saveCollection(STORAGE_KEY, notes)) {
    throw new Error("No se pudieron guardar las notas en este navegador");
  }
}

function loadOrSeed(): Note[] {
  const stored = loadCollection<unknown>(STORAGE_KEY);

  if (stored) {
    const now = Date.now();
    const items = stored.items
      .map((item) => normalizeNote(item, now))
      .filter((note): note is Note => note !== null);

    if (stored.seeded || items.length > 0) return items;
  }

  const seeded = createSampleNotes();
  persist(seeded);
  return seeded;
}

export function createLocalNotesRepository(): NotesRepository {
  return {
    async list() {
      return loadOrSeed();
    },

    async create(note: Note) {
      persist([note, ...loadOrSeed()]);
      return note;
    },

    async update(note: Note) {
      const notes = loadOrSeed();
      const index = notes.findIndex((item) => item.id === note.id);
      if (index === -1) throw new Error(`No existe la nota "${note.id}"`);

      const next = [...notes];
      next[index] = note;
      persist(next);
      return note;
    },

    async remove(id: string) {
      const notes = loadOrSeed();
      const next = notes.filter((note) => note.id !== id);
      if (next.length === notes.length) return;
      persist(next);
    },
  };
}
