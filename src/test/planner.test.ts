import { beforeEach, describe, expect, it } from "vitest";

import {
  applyActivityPatch,
  applyNotePatch,
  applyTaskPatch,
  filterNotes,
  getActivitiesOn,
  getUpcomingActivities,
  groupActivitiesByDate,
  groupTasksByDate,
  sortActivities,
} from "@/lib/planner";
import type { Activity, Note, Task } from "@/types/planner";

const today = new Date(2026, 10, 16);

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    category: "personal",
    priority: "media",
    dueDate: "2026-11-16",
    completed: false,
    completedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("groupTasksByDate", () => {
  it("orders overdue, dated groups and undated tasks", () => {
    const groups = groupTasksByDate(
      [
        makeTask({ id: "a", title: "Atrasada", dueDate: "2026-11-14" }),
        makeTask({ id: "b", title: "Hoy", dueDate: "2026-11-16" }),
        makeTask({ id: "c", title: "Sin fecha", dueDate: null }),
        makeTask({
          id: "d",
          title: "Hecha ayer",
          dueDate: "2026-11-15",
          completed: true,
          completedAt: 1,
        }),
      ],
      today,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "2026-11-15",
      "2026-11-16",
      "undated",
    ]);
    expect(groups[0]?.label).toBe("Atrasadas");
    expect(groups[0]?.tone).toBe("overdue");
    expect(groups.at(-1)?.label).toBe("Sin fecha");
  });

  it("keeps completed past tasks out of the overdue group", () => {
    const groups = groupTasksByDate(
      [makeTask({ id: "a", title: "Hecha", dueDate: "2026-11-10", completed: true })],
      today,
    );

    expect(groups.some((group) => group.tone === "overdue")).toBe(false);
    expect(groups).toHaveLength(1);
  });

  it("groups every task by date when today is unknown (server render)", () => {
    const groups = groupTasksByDate(
      [
        makeTask({ id: "a", title: "Una", dueDate: "2026-11-14" }),
        makeTask({ id: "b", title: "Otra", dueDate: "2026-11-16" }),
      ],
      null,
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-11-14", "2026-11-16"]);
  });
});

describe("applyTaskPatch", () => {
  it("keeps untouched fields and bumps updatedAt", () => {
    const task = makeTask({ id: "a", title: "Original", time: "09:00", updatedAt: 1 });

    const updated = applyTaskPatch(task, { completed: true, completedAt: 99 });

    expect(updated.completed).toBe(true);
    expect(updated.completedAt).toBe(99);
    expect(updated.title).toBe("Original");
    expect(updated.time).toBe("09:00");
    expect(updated.dueDate).toBe("2026-11-16");
    expect(updated.updatedAt).toBeGreaterThan(1);
  });

  it("can clear the due date explicitly", () => {
    const task = makeTask({ id: "a", title: "Con fecha" });
    expect(applyTaskPatch(task, { dueDate: null }).dueDate).toBeNull();
  });
});

function makeActivity(
  overrides: Partial<Activity> & Pick<Activity, "id" | "title" | "date" | "start">,
): Activity {
  return {
    category: "personal",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("activity helpers", () => {
  const activities: Activity[] = [
    makeActivity({ id: "a1", title: "Yoga", date: "2026-11-16", start: "19:00", end: "20:00" }),
    makeActivity({ id: "a2", title: "Reunión", date: "2026-11-16", start: "10:00" }),
    makeActivity({ id: "a3", title: "Dentista", date: "2026-11-17", start: "09:30" }),
    makeActivity({ id: "a4", title: "Cena", date: "2026-11-15", start: "21:00" }),
  ];

  it("sorts by date and then by start time", () => {
    expect(sortActivities(activities).map((a) => a.id)).toEqual(["a4", "a2", "a1", "a3"]);
  });

  it("filters the activities of one day, ordered by time", () => {
    expect(getActivitiesOn(activities, "2026-11-16").map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(getActivitiesOn(activities, "2026-11-20")).toEqual([]);
    expect(getActivitiesOn(activities, null)).toEqual([]);
  });

  it("groups activities by day in chronological order", () => {
    const groups = groupActivitiesByDate(activities);
    expect(groups.map((group) => group.date)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(groups[1]?.activities.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("keeps future days and only today's unfinished activities", () => {
    const upcoming = getUpcomingActivities(activities, "2026-11-16", "12:00");
    // a2 at 10:00 has no end time, so it is considered finished.
    expect(upcoming.map((a) => a.id)).toEqual(["a1", "a3"]);

    // An activity still running counts as upcoming.
    expect(getUpcomingActivities(activities, "2026-11-16", "19:30").map((a) => a.id)).toEqual([
      "a1",
      "a3",
    ]);

    // Before the server clock is known, everything is listed.
    expect(getUpcomingActivities(activities, null, null)).toHaveLength(4);
  });

  it("applies activity patches without losing untouched fields", () => {
    const activity = makeActivity({
      id: "a1",
      title: "Reunión",
      date: "2026-11-16",
      start: "10:00",
      location: "Sala Norte",
      updatedAt: 1,
    });

    const moved = applyActivityPatch(activity, { date: "2026-11-18", start: "11:00" });

    expect(moved.date).toBe("2026-11-18");
    expect(moved.start).toBe("11:00");
    expect(moved.title).toBe("Reunión");
    expect(moved.location).toBe("Sala Norte");
    expect(moved.updatedAt).toBeGreaterThan(1);

    // Optional fields are sent as `null` so clearing them in the form sticks.
    expect(applyActivityPatch(activity, { location: null }).location).toBeUndefined();
    expect(applyActivityPatch(activity, { end: null }).end).toBeUndefined();
    // `undefined` means "do not touch".
    expect(applyActivityPatch(activity, { start: "11:00" }).location).toBe("Sala Norte");
  });
});

describe("notas: búsqueda y edición", () => {
  const note = (
    id: string,
    content: string,
    kind: Note["kind"] = "idea",
    pinned = false,
  ): Note => ({
    id,
    content,
    kind,
    pinned,
    createdAt: 1,
  });

  const notes = [
    note("1", "Planificar un viaje a Lisboa en primavera"),
    note("2", "Llamar al teléfono del fontanero", "por-hacer"),
    note("3", "Renovar el pasaporte", "recordatorio", true),
  ];

  it("busca sin distinguir mayúsculas ni acentos", () => {
    expect(filterNotes(notes, { query: "TELEFONO" }).map((n) => n.id)).toEqual(["2"]);
    expect(filterNotes(notes, { query: "teléfono" }).map((n) => n.id)).toEqual(["2"]);
  });

  it("exige todas las palabras, en cualquier orden", () => {
    expect(filterNotes(notes, { query: "lisboa viaje" }).map((n) => n.id)).toEqual(["1"]);
    expect(filterNotes(notes, { query: "lisboa pasaporte" })).toEqual([]);
  });

  it("combina el tipo con el texto", () => {
    expect(filterNotes(notes, { kind: "por-hacer", query: "llamar" }).map((n) => n.id)).toEqual([
      "2",
    ]);
    expect(filterNotes(notes, { kind: "idea", query: "llamar" })).toEqual([]);
  });

  it("sin filtros devuelve todo, y espacios solos no filtran", () => {
    expect(filterNotes(notes, {})).toHaveLength(3);
    expect(filterNotes(notes, { query: "   " })).toHaveLength(3);
  });

  it("applyNotePatch recorta el texto y conserva lo que no cambia", () => {
    const updated = applyNotePatch(notes[0]!, { content: "  Nuevo texto  ", kind: "recordatorio" });
    expect(updated).toMatchObject({
      id: "1",
      content: "Nuevo texto",
      kind: "recordatorio",
      pinned: false,
    });
  });

  it("applyNotePatch rechaza dejar la nota vacía", () => {
    expect(applyNotePatch(notes[0]!, { content: "   " })).toBeNull();
    expect(applyNotePatch(notes[0]!, { pinned: true })).toMatchObject({ pinned: true });
  });
});
