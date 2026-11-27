import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOfflineCache,
  createOfflinePlanner,
  isRetryableError,
  offlineKeys,
  type OutboxEntry,
} from "@/services/offline-repositories";
import { syncStatus } from "@/services/sync-status";
import type { PlannerRepositories } from "@/services/supabase-repositories";
import type { Habit, HabitLog, Task } from "@/types/planner";

const USER = "user-1";

/** `Storage` mínimo en memoria, compartible entre "reinicios" de la app. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const task = (id: string, title = `Tarea ${id}`): Task => ({
  id,
  title,
  category: "personal",
  priority: "media",
  dueDate: null,
  completed: false,
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
});

const habit = (id: string): Habit => ({
  id,
  name: id,
  kind: "check",
  target: 1,
  step: 1,
  frequency: { type: "daily" },
  category: "salud",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
});

const networkDown = () => new TypeError("Failed to fetch");

/** Servidor en memoria que se puede "desconectar" o hacer rechazar cambios. */
function fakeServer() {
  const state = {
    online: true,
    reject: null as null | ((method: string, arg: unknown) => Error | null),
    tasks: [] as Task[],
    habits: [] as Habit[],
    habitLogs: [] as HabitLog[],
    log: [] as string[],
  };

  const guard = (method: string, arg: unknown) => {
    if (!state.online) throw networkDown();
    const rejection = state.reject?.(method, arg);
    if (rejection) throw rejection;
  };

  const repositories: PlannerRepositories = {
    tasks: {
      list: async () => {
        guard("tasks.list", null);
        return [...state.tasks];
      },
      create: async (item) => {
        guard("tasks.create", item);
        state.log.push(`create ${item.id}`);
        state.tasks = [...state.tasks, item];
        return item;
      },
      update: async (item) => {
        guard("tasks.update", item);
        state.log.push(`update ${item.id}`);
        state.tasks = state.tasks.map((existing) => (existing.id === item.id ? item : existing));
        return item;
      },
      remove: async (id) => {
        guard("tasks.remove", id);
        state.log.push(`remove ${id}`);
        state.tasks = state.tasks.filter((existing) => existing.id !== id);
      },
    },
    notes: {
      list: async () => [],
      create: async (n) => n,
      update: async (n) => n,
      remove: async () => {},
    },
    activities: {
      list: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      remove: async () => {},
    },
    habits: {
      list: async () => {
        guard("habits.list", null);
        return [...state.habits];
      },
      create: async (item) => {
        guard("habits.create", item);
        state.habits = [...state.habits, item];
        return item;
      },
      update: async (item) => item,
      remove: async (id) => {
        guard("habits.remove", id);
        state.habits = state.habits.filter((existing) => existing.id !== id);
      },
    },
    habitLogs: {
      list: async () => {
        guard("habitLogs.list", null);
        return [...state.habitLogs];
      },
      upsert: async (log) => {
        guard("habitLogs.upsert", log);
        state.habitLogs = [...state.habitLogs.filter((item) => item.id !== log.id), log];
        return log;
      },
      remove: async () => {},
      removeForHabit: async () => {},
    },
    specialDates: {
      list: async () => [],
      create: async (d) => d,
      update: async (d) => d,
      remove: async () => {},
    },
    goals: {
      list: async () => [],
      create: async (g) => g,
      update: async (g) => g,
      remove: async () => {},
    },
  };

  return { state, repositories };
}

beforeEach(() => {
  syncStatus.reset();
});

describe("isRetryableError", () => {
  it("reconoce fallos de red y de sesión caducada", () => {
    expect(isRetryableError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableError({ message: "TypeError: Load failed" })).toBe(true);
    expect(isRetryableError({ message: "JWT expired", code: "PGRST301" })).toBe(true);
    expect(isRetryableError({ message: "x", status: 503 })).toBe(true);
  });

  it("no confunde un rechazo definitivo con un fallo de red", () => {
    expect(
      isRetryableError({
        message: 'new row violates check constraint "tasks_title_check"',
        code: "23514",
      }),
    ).toBe(false);
    expect(isRetryableError({ message: "permission denied for table tasks", code: "42501" })).toBe(
      false,
    );
    expect(isRetryableError(new Error('No existe la tarea "1"'))).toBe(false);
  });
});

describe("lectura", () => {
  it("guarda una copia y la sirve sin conexión", async () => {
    const server = fakeServer();
    server.state.tasks = [task("1")];
    const storage = memoryStorage();

    const first = createOfflinePlanner(server.repositories, USER, { storage });
    expect(await first.repositories.tasks.list()).toHaveLength(1);

    server.state.online = false;
    // Una app recién abierta (otra instancia) sin red lee la copia del dispositivo.
    const reopened = createOfflinePlanner(server.repositories, USER, { storage });
    expect((await reopened.repositories.tasks.list()).map((item) => item.id)).toEqual(["1"]);
  });

  it("sin copia y sin red falla (no inventa datos)", async () => {
    const server = fakeServer();
    server.state.online = false;
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });

    await expect(planner.repositories.tasks.list()).rejects.toThrow("Failed to fetch");
  });

  it("la copia de un usuario no la lee otro", async () => {
    const server = fakeServer();
    server.state.tasks = [task("1")];
    const storage = memoryStorage();
    await createOfflinePlanner(server.repositories, "user-a", {
      storage,
    }).repositories.tasks.list();

    server.state.online = false;
    const other = createOfflinePlanner(server.repositories, "user-b", { storage });
    await expect(other.repositories.tasks.list()).rejects.toThrow();
  });
});

describe("escritura sin conexión", () => {
  it("encola el cambio, lo muestra al momento y lo envía al volver la red", async () => {
    const server = fakeServer();
    const storage = memoryStorage();
    const planner = createOfflinePlanner(server.repositories, USER, { storage });
    await planner.repositories.tasks.list();

    server.state.online = false;
    await planner.repositories.tasks.create(task("nueva"));

    expect(server.state.tasks).toHaveLength(0);
    expect(syncStatus.get().pending).toBe(1);
    // Aunque no haya red, al releer se ve el cambio.
    expect((await planner.repositories.tasks.list()).map((item) => item.id)).toEqual(["nueva"]);

    server.state.online = true;
    await planner.flush();

    expect(server.state.tasks.map((item) => item.id)).toEqual(["nueva"]);
    expect(syncStatus.get().pending).toBe(0);
  });

  it("la cola sobrevive a cerrar y abrir la app", async () => {
    const server = fakeServer();
    const storage = memoryStorage();
    const before = createOfflinePlanner(server.repositories, USER, { storage });
    await before.repositories.tasks.list();

    server.state.online = false;
    await before.repositories.tasks.create(task("a"));
    await before.repositories.tasks.update(task("a", "Editada sin red"));
    expect(JSON.parse(storage.getItem(offlineKeys(USER).outbox)!).data).toHaveLength(2);

    // "Reinicio": instancia nueva, mismo dispositivo.
    syncStatus.reset();
    server.state.online = true;
    const after = createOfflinePlanner(server.repositories, USER, { storage });
    expect(syncStatus.get().pending).toBe(2);

    await after.flush();
    expect(server.state.tasks).toEqual([task("a", "Editada sin red")]);
    expect(server.state.log).toEqual(["create a", "update a"]);
  });

  it("respeta el orden: un cambio nuevo no adelanta a los pendientes", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.tasks.list();

    server.state.online = false;
    await planner.repositories.tasks.create(task("1"));

    server.state.online = true;
    await planner.repositories.tasks.create(task("2")); // hay cola: va detrás
    await planner.flush();

    expect(server.state.log).toEqual(["create 1", "create 2"]);
  });

  it("con cambios pendientes no pisa la copia con datos del servidor", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.tasks.list();

    server.state.online = false;
    await planner.repositories.tasks.create(task("pendiente"));

    // El navegador cree que hay red pero el envío sigue fallando: se mantiene lo local.
    server.state.online = true;
    server.state.reject = (method) => (method === "tasks.create" ? networkDown() : null);
    expect((await planner.repositories.tasks.list()).map((item) => item.id)).toEqual(["pendiente"]);
  });

  it("un rechazo definitivo no se encola: se propaga", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.tasks.list();

    server.state.reject = () =>
      Object.assign(new Error("violates check constraint"), { code: "23514" });
    await expect(planner.repositories.tasks.create(task("mala"))).rejects.toThrow(
      "check constraint",
    );
    expect(syncStatus.get().pending).toBe(0);
  });

  it("si el servidor rechaza un cambio encolado lo descarta, avisa y sigue con el resto", async () => {
    const server = fakeServer();
    const discarded: OutboxEntry[] = [];
    const planner = createOfflinePlanner(server.repositories, USER, {
      storage: memoryStorage(),
      onDiscard: (entry) => discarded.push(entry),
    });
    await planner.repositories.tasks.list();

    server.state.online = false;
    await planner.repositories.tasks.create(task("mala"));
    await planner.repositories.tasks.create(task("buena"));

    server.state.online = true;
    server.state.reject = (_method, arg) =>
      (arg as Task).id === "mala" ? Object.assign(new Error("rechazada"), { code: "23514" }) : null;
    await planner.flush();

    expect(discarded.map((entry) => (entry.arg as Task).id)).toEqual(["mala"]);
    expect(server.state.tasks.map((item) => item.id)).toEqual(["buena"]);
    expect(syncStatus.get().pending).toBe(0);
  });

  it("si vuelve la red pero el envío sigue fallando, la cola se conserva", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.tasks.list();

    server.state.online = false;
    await planner.repositories.tasks.create(task("1"));
    await planner.flush();

    expect(syncStatus.get().pending).toBe(1);
    expect(syncStatus.get().syncing).toBe(false);
  });
});

describe("hábitos", () => {
  it("borrar un hábito sin red quita también sus registros de la copia", async () => {
    const server = fakeServer();
    server.state.habits = [habit("h1"), habit("h2")];
    server.state.habitLogs = [
      { id: "h1:2026-11-25", habitId: "h1", date: "2026-11-25", value: 1 },
      { id: "h2:2026-11-25", habitId: "h2", date: "2026-11-25", value: 1 },
    ];
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.habits.list();
    await planner.repositories.habitLogs.list();

    server.state.online = false;
    await planner.repositories.habits.remove("h1");

    expect((await planner.repositories.habitLogs.list()).map((log) => log.habitId)).toEqual(["h2"]);
  });

  it("el progreso de un día se guarda sin red y reemplaza al anterior", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.habitLogs.list();

    server.state.online = false;
    const log = (value: number): HabitLog => ({
      id: "h1:2026-11-25",
      habitId: "h1",
      date: "2026-11-25",
      value,
    });
    await planner.repositories.habitLogs.upsert(log(1));
    await planner.repositories.habitLogs.upsert(log(3));

    expect(await planner.repositories.habitLogs.list()).toEqual([log(3)]);
  });
});

describe("cerrar sesión", () => {
  it("borra la copia de datos pero conserva los cambios pendientes", async () => {
    const server = fakeServer();
    const storage = memoryStorage();
    const planner = createOfflinePlanner(server.repositories, USER, { storage });
    await planner.repositories.tasks.list();
    server.state.online = false;
    await planner.repositories.tasks.create(task("sin-enviar"));

    clearOfflineCache(USER, storage);

    expect(storage.getItem(offlineKeys(USER).cache)).toBeNull();
    expect(storage.getItem(offlineKeys(USER).outbox)).not.toBeNull();
  });
});

describe("reenvío automático", () => {
  it("al volver la conexión envía la cola sin que nadie lo pida", async () => {
    const server = fakeServer();
    const planner = createOfflinePlanner(server.repositories, USER, { storage: memoryStorage() });
    await planner.repositories.tasks.list();
    const stop = planner.start();

    server.state.online = false;
    window.dispatchEvent(new Event("offline"));
    await planner.repositories.tasks.create(task("1"));
    expect(syncStatus.get()).toMatchObject({ online: false, pending: 1 });

    server.state.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(server.state.tasks).toHaveLength(1));
    expect(syncStatus.get()).toMatchObject({ online: true, pending: 0 });

    stop();
  });
});
