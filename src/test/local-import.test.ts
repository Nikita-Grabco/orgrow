import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildImportPayload,
  deterministicUuid,
  importedFlagKey,
  importLocalDataOnce,
} from "@/services/local-import";
import { saveCollection, STORAGE_KEYS } from "@/services/planner-storage";
import type { ImportPayload } from "@/services/supabase-repositories";
import type { Habit, Task } from "@/types/planner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `Tarea ${id}`,
  category: "personal",
  priority: "media",
  dueDate: null,
  completed: false,
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

const habit = (id: string): Habit => ({
  id,
  name: `Hábito ${id}`,
  kind: "check",
  target: 1,
  step: 1,
  frequency: { type: "daily" },
  category: "salud",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
});

const EMPTY: ImportPayload = { tasks: [], notes: [], activities: [], habits: [], habitLogs: [] };

beforeEach(() => {
  window.localStorage.clear();
});

describe("deterministicUuid", () => {
  it("devuelve un uuid válido y siempre el mismo para la misma semilla", () => {
    const first = deterministicUuid("u1:task:t-abc");
    expect(first).toMatch(UUID);
    expect(deterministicUuid("u1:task:t-abc")).toBe(first);
  });

  it("cambia con la cuenta y con el id", () => {
    const ids = new Set([
      deterministicUuid("u1:task:t-abc"),
      deterministicUuid("u2:task:t-abc"),
      deterministicUuid("u1:task:t-abd"),
      deterministicUuid("u1:note:t-abc"),
    ]);
    expect(ids.size).toBe(4);
  });
});

describe("buildImportPayload", () => {
  it("descarta los datos de demo y conserva los del usuario con ids nuevos", () => {
    const payload = buildImportPayload(
      {
        ...EMPTY,
        tasks: [task("t1"), task("t12"), task("t-k3j9-ab12c", { title: "Mía" })],
      },
      "user-1",
    );

    expect(payload.tasks.map((item) => item.title)).toEqual(["Mía"]);
    expect(payload.tasks[0]?.id).toMatch(UUID);
  });

  it("descarta notas y actividades de demo", () => {
    const payload = buildImportPayload(
      {
        ...EMPTY,
        notes: [
          { id: "n3", content: "demo", kind: "idea", pinned: false, createdAt: 1 },
          { id: "n-x-1", content: "mía", kind: "idea", pinned: false, createdAt: 1 },
        ],
        activities: [
          {
            id: "a2",
            title: "demo",
            category: "trabajo",
            date: "2026-11-25",
            start: "09:00",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      "user-1",
    );

    expect(payload.notes.map((item) => item.content)).toEqual(["mía"]);
    expect(payload.activities).toEqual([]);
  });

  it("reasigna el hábito en sus registros y descarta los de hábitos de demo o huérfanos", () => {
    const payload = buildImportPayload(
      {
        ...EMPTY,
        habits: [habit("h-gym"), habit("h-mio")],
        habitLogs: [
          { id: "h-gym:2026-11-25", habitId: "h-gym", date: "2026-11-25", value: 1 },
          { id: "h-mio:2026-11-25", habitId: "h-mio", date: "2026-11-25", value: 1 },
          { id: "h-borrado:2026-11-25", habitId: "h-borrado", date: "2026-11-25", value: 1 },
        ],
      },
      "user-1",
    );

    expect(payload.habits).toHaveLength(1);
    const newHabitId = payload.habits[0]!.id;
    expect(payload.habitLogs).toEqual([
      { id: `${newHabitId}:2026-11-25`, habitId: newHabitId, date: "2026-11-25", value: 1 },
    ]);
  });

  it("es determinista: dos importaciones generan los mismos ids", () => {
    const local = { ...EMPTY, tasks: [task("t-a-1")] };
    expect(buildImportPayload(local, "user-1").tasks[0]?.id).toBe(
      buildImportPayload(local, "user-1").tasks[0]?.id,
    );
    expect(buildImportPayload(local, "user-1").tasks[0]?.id).not.toBe(
      buildImportPayload(local, "user-2").tasks[0]?.id,
    );
  });
});

describe("importLocalDataOnce", () => {
  it("sube los datos propios una sola vez por cuenta", async () => {
    saveCollection(STORAGE_KEYS.tasks, [task("t-mia-1", { title: "Mi tarea" })]);
    const upload = vi.fn().mockResolvedValue(undefined);

    expect(await importLocalDataOnce("user-1", upload)).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]![0].tasks[0].title).toBe("Mi tarea");

    expect(await importLocalDataOnce("user-1", upload)).toBe(0);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("no sube nada si solo hay datos de demo, pero lo recuerda", async () => {
    const upload = vi.fn().mockResolvedValue(undefined);

    expect(await importLocalDataOnce("user-1", upload)).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(importedFlagKey("user-1"))).not.toBeNull();
  });

  it("si la subida falla no marca como hecho, para reintentar", async () => {
    saveCollection(STORAGE_KEYS.tasks, [task("t-mia-1")]);
    const upload = vi.fn().mockRejectedValue(new Error("sin red"));

    await expect(importLocalDataOnce("user-1", upload)).rejects.toThrow("sin red");
    expect(window.localStorage.getItem(importedFlagKey("user-1"))).toBeNull();

    upload.mockResolvedValue(undefined);
    expect(await importLocalDataOnce("user-1", upload)).toBe(1);
  });

  it("otra cuenta en el mismo navegador también importa", async () => {
    saveCollection(STORAGE_KEYS.tasks, [task("t-mia-1")]);
    const upload = vi.fn().mockResolvedValue(undefined);

    await importLocalDataOnce("user-1", upload);
    expect(await importLocalDataOnce("user-2", upload)).toBe(1);
  });
});
