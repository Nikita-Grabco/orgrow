import { beforeEach, describe, expect, it } from "vitest";

import { createLocalActivitiesRepository } from "@/services/activities-repository";
import { createLocalNotesRepository } from "@/services/notes-repository";
import { clearCollection, STORAGE_KEYS } from "@/services/planner-storage";
import { createLocalTasksRepository } from "@/services/tasks-repository";
import type { Activity, Task } from "@/types/planner";

beforeEach(() => {
  clearCollection(STORAGE_KEYS.tasks);
  clearCollection(STORAGE_KEYS.notes);
  clearCollection(STORAGE_KEYS.activities);
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
    expect((await createLocalTasksRepository().list()).some((t) => t.id === "t-custom")).toBe(
      false,
    );
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

describe("activities repository", () => {
  function makeActivity(id: string, title: string, overrides: Partial<Activity> = {}): Activity {
    return {
      id,
      title,
      category: "trabajo",
      date: "2030-01-15",
      start: "10:00",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("seeds demo activities with real dates on the first run only", async () => {
    const first = await createLocalActivitiesRepository().list();

    expect(first.length).toBeGreaterThan(0);
    expect(first.every((activity) => /^\d{4}-\d{2}-\d{2}$/.test(activity.date))).toBe(true);
    expect(first.every((activity) => /^\d{2}:\d{2}$/.test(activity.start))).toBe(true);

    const second = await createLocalActivitiesRepository().list();
    expect(second.map((activity) => activity.id)).toEqual(first.map((activity) => activity.id));
  });

  it("persists create, update and remove across repository instances", async () => {
    const repo = createLocalActivitiesRepository();
    await repo.list();

    await repo.create(makeActivity("a-custom", "Fisio"));
    expect((await createLocalActivitiesRepository().list()).some((a) => a.id === "a-custom")).toBe(
      true,
    );

    await repo.update(makeActivity("a-custom", "Fisio", { date: "2030-02-01", start: "18:30" }));
    const saved = (await createLocalActivitiesRepository().list()).find((a) => a.id === "a-custom");
    expect(saved?.date).toBe("2030-02-01");
    expect(saved?.start).toBe("18:30");

    await repo.remove("a-custom");
    expect((await createLocalActivitiesRepository().list()).some((a) => a.id === "a-custom")).toBe(
      false,
    );
  });

  it("keeps an empty list instead of reseeding after deleting everything", async () => {
    const repo = createLocalActivitiesRepository();
    for (const activity of await repo.list()) {
      await repo.remove(activity.id);
    }

    expect(await createLocalActivitiesRepository().list()).toEqual([]);
  });

  it("migrates legacy dayOffset rows and ignores invalid entries", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.activities,
      JSON.stringify({
        schemaVersion: 0,
        seeded: true,
        items: [
          {
            id: "legacy",
            title: "Clase antigua",
            category: "salud",
            dayOffset: 2,
            start: "08:00",
          },
          { id: "broken", title: "Sin hora", category: "salud", dayOffset: 1 },
          {
            id: "unknown-category",
            title: "X",
            category: "otra",
            date: "2030-01-01",
            start: "10:00",
          },
        ],
      }),
    );

    const activities = await createLocalActivitiesRepository().list();
    expect(activities).toHaveLength(1);
    expect(activities[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(activities[0]?.start).toBe("08:00");
  });

  it("throws when updating an activity that does not exist", async () => {
    const repo = createLocalActivitiesRepository();
    await repo.list();
    await expect(repo.update(makeActivity("missing", "No existe"))).rejects.toThrow();
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
