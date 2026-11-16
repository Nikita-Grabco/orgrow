import { beforeEach, describe, expect, it } from "vitest";

import { createLocalNotesRepository } from "@/services/notes-repository";
import { clearCollection, STORAGE_KEYS } from "@/services/planner-storage";
import { createLocalTasksRepository } from "@/services/tasks-repository";
import type { Task } from "@/types/planner";

beforeEach(() => {
  clearCollection(STORAGE_KEYS.tasks);
  clearCollection(STORAGE_KEYS.notes);
  window.localStorage.clear();
});

function makeTask(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    category: "trabajo",
    priority: "alta",
    dueDate: "2030-01-15",
    completed: false,
    completedAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("tasks repository", () => {
  it("seeds demo tasks on the first run only", async () => {
    const repo = createLocalTasksRepository();

    const first = await repo.list();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((task) => /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate ?? ""))).toBe(true);

    const second = await createLocalTasksRepository().list();
    expect(second.map((task) => task.id)).toEqual(first.map((task) => task.id));
  });

  it("persists create, update and remove across repository instances", async () => {
    const repo = createLocalTasksRepository();
    await repo.list();

    await repo.create(makeTask("t-custom", "Escribir tests"));
    expect((await createLocalTasksRepository().list()).some((t) => t.id === "t-custom")).toBe(true);

    await repo.update(makeTask("t-custom", "Tests escritos", { completed: true, completedAt: 5 }));
    const saved = (await createLocalTasksRepository().list()).find((t) => t.id === "t-custom");
    expect(saved?.title).toBe("Tests escritos");
    expect(saved?.completed).toBe(true);
    expect(saved?.completedAt).toBe(5);

    await repo.remove("t-custom");
    expect((await createLocalTasksRepository().list()).some((t) => t.id === "t-custom")).toBe(false);
  });

  it("keeps an empty list instead of reseeding after deleting everything", async () => {
    const repo = createLocalTasksRepository();
    for (const task of await repo.list()) {
      await repo.remove(task.id);
    }

    expect(await repo.list()).toEqual([]);
    expect(await createLocalTasksRepository().list()).toEqual([]);
  });

  it("migrates legacy dayOffset rows instead of dropping them", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.tasks,
      JSON.stringify({
        schemaVersion: 0,
        seeded: true,
        items: [
          {
            id: "legacy",
            title: "Tarea antigua",
            category: "hogar",
            priority: "baja",
            dayOffset: 2,
            completed: false,
          },
        ],
      }),
    );

    const tasks = await createLocalTasksRepository().list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tasks[0]?.completedAt).toBeNull();
  });

  it("falls back to demo data when the stored JSON is corrupted", async () => {
    window.localStorage.setItem(STORAGE_KEYS.tasks, "{ this is not json");

    const tasks = await createLocalTasksRepository().list();
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("throws when updating a task that does not exist", async () => {
    const repo = createLocalTasksRepository();
    await repo.list();
    await expect(repo.update(makeTask("missing", "No existe"))).rejects.toThrow();
  });
});

describe("notes repository", () => {
  it("seeds, creates and pins notes with persistence", async () => {
    const repo = createLocalNotesRepository();
    const seeded = await repo.list();
    expect(seeded.length).toBeGreaterThan(0);

    await repo.create({
      id: "n-custom",
      content: "Nota de prueba",
      kind: "idea",
      pinned: false,
      createdAt: 1,
    });

    const note = (await createLocalNotesRepository().list()).find((n) => n.id === "n-custom");
    expect(note?.content).toBe("Nota de prueba");

    await repo.update({ ...note!, pinned: true });
    const pinned = (await createLocalNotesRepository().list()).find((n) => n.id === "n-custom");
    expect(pinned?.pinned).toBe(true);
  });
});
