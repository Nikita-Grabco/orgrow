import type { ActivitiesRepository } from "@/services/activities-repository";
import type { HabitLogsRepository, HabitsRepository } from "@/services/habits-repository";
import type { NotesRepository } from "@/services/notes-repository";
import { syncStatus } from "@/services/sync-status";
import type { PlannerRepositories } from "@/services/supabase-repositories";
import type { TasksRepository } from "@/services/tasks-repository";
import type { Activity, Habit, HabitLog, Note, Task } from "@/types/planner";

/**
 * Uso sin conexión, por encima de los repositorios de Supabase.
 *
 *  - **Lectura**: cada lectura correcta guarda una copia en este dispositivo.
 *    Sin red se sirve esa copia, así que la app abre y se puede consultar.
 *  - **Escritura**: se aplica a la copia al momento. Si el servidor no responde,
 *    el cambio entra en una **cola** (también guardada en el dispositivo) que se
 *    envía, en orden, en cuanto vuelve la conexión. La interfaz nunca ve el fallo.
 *  - Un error que NO es de conexión (permiso, dato inválido…) no se encola: se
 *    propaga y el store deshace el cambio, igual que antes.
 *
 * Todo se guarda por usuario. Última escritura gana: no hay fusión de conflictos.
 */

type RepoName = "tasks" | "notes" | "activities" | "habits" | "habitLogs";

/** `undefined` = esa lista aún no se ha leído nunca del servidor. */
interface Snapshot {
  tasks?: Task[] | undefined;
  notes?: Note[] | undefined;
  activities?: Activity[] | undefined;
  habits?: Habit[] | undefined;
  habitLogs?: HabitLog[] | undefined;
}

export interface OutboxEntry {
  repo: RepoName;
  method: string;
  arg: unknown;
  /** Epoch millis en que se hizo el cambio. */
  at: number;
}

export interface OfflineOptions {
  /** Por defecto `localStorage`. `null` = solo memoria. */
  storage?: Storage | null;
  /** Se llama con un cambio que el servidor rechazó de forma definitiva y se descartó. */
  onDiscard?: (entry: OutboxEntry, error: unknown) => void;
}

export interface OfflinePlanner {
  repositories: PlannerRepositories;
  /** Envía los cambios pendientes. Nunca lanza: lo que no se pueda enviar se queda en la cola. */
  flush: () => Promise<void>;
  /** Escucha red y foco para reenviar solo. Devuelve la función que lo detiene. */
  start: () => () => void;
}

/* -------------------------------------------------------------------------- */
/* ¿El fallo es de conexión (reintentar) o definitivo (descartar)?            */
/* -------------------------------------------------------------------------- */

const NETWORK_MESSAGE =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timed? ?out|econn|enotfound/i;
const AUTH_MESSAGE = /jwt|token.*expired|not authenticated/i;
const AUTH_CODES = new Set(["PGRST301", "PGRST303"]);

/**
 * Un fallo "reintentable" no es culpa del cambio: no hay red, el servidor está
 * caído o el token caducó mientras no había conexión. Se reintenta más tarde.
 */
export function isRetryableError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  const raw = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const message = typeof raw?.message === "string" ? raw.message : String(error ?? "");
  const code = typeof raw?.code === "string" ? raw.code : "";
  const status = typeof raw?.status === "number" ? raw.status : 0;

  if (NETWORK_MESSAGE.test(message)) return true;
  if (AUTH_CODES.has(code) || AUTH_MESSAGE.test(message)) return true;
  return status === 0 ? false : status === 401 || status === 408 || status === 429 || status >= 500;
}

/* -------------------------------------------------------------------------- */
/* Almacenamiento local                                                       */
/* -------------------------------------------------------------------------- */

const SCHEMA = 1;

export const offlineKeys = (userId: string) => ({
  cache: `orgrow:v1:cache:${userId}`,
  outbox: `orgrow:v1:outbox:${userId}`,
});

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(storage: Storage | null, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { schema?: number; data?: T };
    return parsed.schema === SCHEMA && parsed.data !== undefined ? parsed.data : null;
  } catch (error) {
    console.error(`[orgrow] No se pudo leer "${key}"`, error);
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, data: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ schema: SCHEMA, data }));
  } catch (error) {
    // Cuota llena o modo privado: se sigue en memoria, pero se avisa en consola.
    console.error(`[orgrow] No se pudo guardar "${key}" en este dispositivo`, error);
  }
}

/**
 * Borra la copia de los datos de este usuario (al cerrar sesión). La cola de
 * cambios pendientes se conserva: son cambios suyos aún no enviados y se
 * enviarán la próxima vez que entre con la misma cuenta.
 */
export function clearOfflineCache(
  userId: string,
  storage: Storage | null = defaultStorage(),
): void {
  try {
    storage?.removeItem(offlineKeys(userId).cache);
  } catch (error) {
    console.error("[orgrow] No se pudo borrar la copia local", error);
  }
}

/** Borra TODO lo de esta cuenta en el dispositivo, incluida la cola pendiente (al borrar la cuenta). */
export function clearAllLocalData(
  userId: string,
  storage: Storage | null = defaultStorage(),
): void {
  try {
    const keys = offlineKeys(userId);
    storage?.removeItem(keys.cache);
    storage?.removeItem(keys.outbox);
    storage?.removeItem(`orgrow:v1:imported:${userId}`);
  } catch (error) {
    console.error("[orgrow] No se pudieron borrar los datos locales", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Motor                                                                      */
/* -------------------------------------------------------------------------- */

const RETRY_EVERY_MS = 30_000;

type AnyRepo = Record<string, (arg: unknown) => Promise<unknown>>;

export function createOfflinePlanner(
  remote: PlannerRepositories,
  userId: string,
  options: OfflineOptions = {},
): OfflinePlanner {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const keys = offlineKeys(userId);

  const snapshot: Snapshot = readJson<Snapshot>(storage, keys.cache) ?? {};
  let outbox: OutboxEntry[] = readJson<OutboxEntry[]>(storage, keys.outbox) ?? [];
  let flushing: Promise<void> | null = null;
  let rerun = false;

  const saveSnapshot = () => writeJson(storage, keys.cache, snapshot);
  const saveOutbox = () => {
    writeJson(storage, keys.outbox, outbox);
    syncStatus.set({ pending: outbox.length });
  };
  syncStatus.set({ pending: outbox.length });

  /* ---- Envío de la cola ---- */

  async function drain(): Promise<void> {
    syncStatus.set({ syncing: true });
    try {
      while (outbox.length > 0) {
        const entry = outbox[0]!;
        try {
          await (remote[entry.repo] as unknown as AnyRepo)[entry.method]!(entry.arg);
        } catch (error) {
          if (isRetryableError(error)) return; // se queda en la cola
          // El servidor lo rechaza de forma definitiva: bloquear la cola no ayudaría a nadie.
          console.error("[orgrow] Cambio pendiente descartado", entry, error);
          options.onDiscard?.(entry, error);
        }
        outbox = outbox.slice(1);
        saveOutbox();
      }
    } finally {
      syncStatus.set({ syncing: false });
    }
  }

  function flush(): Promise<void> {
    if (outbox.length === 0) return Promise.resolve();

    // Si ya hay un envío en marcha puede estar a punto de rendirse por la falta de
    // red: se anota la petición y, al terminar, se vuelve a intentar una vez más.
    if (flushing) {
      rerun = true;
      return flushing;
    }

    flushing = (async () => {
      do {
        rerun = false;
        await drain().catch((error: unknown) =>
          console.error("[orgrow] Falló el envío de cambios pendientes", error),
        );
      } while (rerun && outbox.length > 0);
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  /* ---- Lectura y escritura ---- */

  async function read<T>(name: RepoName, list: () => Promise<T[]>): Promise<T[]> {
    await flush();

    const cached = snapshot[name] as T[] | undefined;
    // Con cambios sin enviar, el servidor aún no tiene la verdad: manda la copia.
    if (outbox.length > 0 && cached) return cached;

    try {
      const rows = await list();
      (snapshot as Record<string, unknown>)[name] = rows;
      saveSnapshot();
      return rows;
    } catch (error) {
      if (cached && isRetryableError(error)) return cached;
      throw error;
    }
  }

  async function write<R>(
    name: RepoName,
    method: string,
    arg: unknown,
    reduce: (snap: Snapshot) => void,
    call: () => Promise<R>,
    fallback: R,
  ): Promise<R> {
    reduce(snapshot);
    saveSnapshot();

    const enqueue = () => {
      outbox = [...outbox, { repo: name, method, arg, at: Date.now() }];
      saveOutbox();
    };

    // Con cambios por enviar, este va detrás para no adelantarse a ellos.
    if (outbox.length > 0) {
      enqueue();
      void flush();
      return fallback;
    }

    try {
      return await call();
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      enqueue();
      return fallback;
    }
  }

  /* ---- Repositorios envueltos ---- */

  const replaceById = <T extends { id: string }>(list: T[] | undefined, item: T) =>
    list?.map((existing) => (existing.id === item.id ? item : existing));

  function crud<T extends { id: string }>(
    name: "tasks" | "notes" | "activities" | "habits",
    inner: {
      list(): Promise<T[]>;
      create(item: T): Promise<T>;
      update(item: T): Promise<T>;
      remove(id: string): Promise<void>;
    },
    {
      newestFirst = false,
      onRemove,
    }: { newestFirst?: boolean; onRemove?: (id: string) => void } = {},
  ) {
    const slot = (snap: Snapshot) => snap as unknown as Record<string, T[] | undefined>;

    return {
      list: () => read<T>(name, () => inner.list()),

      create: (item: T) =>
        write(
          name,
          "create",
          item,
          (snap) => {
            const list = slot(snap)[name];
            if (list) slot(snap)[name] = newestFirst ? [item, ...list] : [...list, item];
          },
          () => inner.create(item),
          item,
        ),

      update: (item: T) =>
        write(
          name,
          "update",
          item,
          (snap) => {
            slot(snap)[name] = replaceById(slot(snap)[name], item);
          },
          () => inner.update(item),
          item,
        ),

      remove: (id: string) =>
        write(
          name,
          "remove",
          id,
          (snap) => {
            slot(snap)[name] = slot(snap)[name]?.filter((existing) => existing.id !== id);
            onRemove?.(id);
          },
          () => inner.remove(id),
          undefined,
        ),
    };
  }

  const tasks: TasksRepository = crud("tasks", remote.tasks);
  const notes: NotesRepository = crud("notes", remote.notes, { newestFirst: true });
  const activities: ActivitiesRepository = crud("activities", remote.activities);
  const habits: HabitsRepository = crud("habits", remote.habits, {
    // En la base de datos los registros de un hábito se borran en cascada.
    onRemove: (id) => {
      snapshot.habitLogs = snapshot.habitLogs?.filter((log) => log.habitId !== id);
    },
  });

  const habitLogs: HabitLogsRepository = {
    list: () => read("habitLogs", () => remote.habitLogs.list()),

    upsert: (log) =>
      write(
        "habitLogs",
        "upsert",
        log,
        (snap) => {
          const list = snap.habitLogs;
          if (!list) return;
          snap.habitLogs = list.some((item) => item.id === log.id)
            ? replaceById(list, log)
            : [...list, log];
        },
        () => remote.habitLogs.upsert(log),
        log,
      ),

    remove: (id) =>
      write(
        "habitLogs",
        "remove",
        id,
        (snap) => {
          snap.habitLogs = snap.habitLogs?.filter((log) => log.id !== id);
        },
        () => remote.habitLogs.remove(id),
        undefined,
      ),

    removeForHabit: (habitId) =>
      write(
        "habitLogs",
        "removeForHabit",
        habitId,
        (snap) => {
          snap.habitLogs = snap.habitLogs?.filter((log) => log.habitId !== habitId);
        },
        () => remote.habitLogs.removeForHabit(habitId),
        undefined,
      ),
  };

  /* ---- Reenvío automático ---- */

  function start(): () => void {
    if (typeof window === "undefined") return () => {};

    syncStatus.set({ online: navigator.onLine });

    const onOnline = () => {
      syncStatus.set({ online: true });
      void flush();
    };
    const onOffline = () => syncStatus.set({ online: false });
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    // Por si el navegador dice "online" pero el servidor no contestó al primer intento.
    const timer = window.setInterval(() => void flush(), RETRY_EVERY_MS);
    void flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }

  return {
    repositories: { tasks, notes, activities, habits, habitLogs },
    flush,
    start,
  };
}
