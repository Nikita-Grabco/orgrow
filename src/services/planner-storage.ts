/**
 * Safe, versioned access to `localStorage`.
 *
 * Client-only by design: on the server every read returns null, so SSR never
 * touches browser storage and hydration stays deterministic. A future Supabase
 * repository will ignore this module entirely.
 */

export const STORAGE_VERSION = 1;

export const STORAGE_KEYS = {
  tasks: "orgadia:v1:tasks",
  notes: "orgadia:v1:notes",
  activities: "orgadia:v1:activities",
  habits: "orgrow:v1:habits",
  habitLogs: "orgrow:v1:habit-logs",
  specialDates: "orgrow:v1:special-dates",
  goals: "orgrow:v1:goals",
} as const;

export interface StoredCollection<T> {
  schemaVersion: number;
  /** False only when the key exists but the demo data was never written. */
  seeded: boolean;
  items: T[];
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
}

export function loadCollection<T>(key: string): StoredCollection<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCollection<T>> | null;
    if (!parsed || !Array.isArray(parsed["items"])) return null;

    return {
      schemaVersion: typeof parsed["schemaVersion"] === "number" ? parsed["schemaVersion"] : 0,
      seeded: parsed["seeded"] === true,
      items: parsed["items"],
    };
  } catch (error) {
    console.error(`[orgrow] No se pudo leer "${key}"`, error);
    return null;
  }
}

/** Returns false when the browser rejects the write (quota, private mode…). */
export function saveCollection<T>(key: string, items: T[]): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    const payload: StoredCollection<T> = {
      schemaVersion: STORAGE_VERSION,
      seeded: true,
      items,
    };
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error(`[orgrow] No se pudo guardar "${key}"`, error);
    return false;
  }
}

export function clearCollection(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (error) {
    console.error(`[orgrow] No se pudo borrar "${key}"`, error);
  }
}
