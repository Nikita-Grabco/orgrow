import { beforeEach, describe, expect, it } from "vitest";

import { REMINDER_OPTIONS, reminderLabel } from "@/config/reminders";
import { applyActivityPatch, applyTaskPatch } from "@/lib/planner";
import { readRemindBefore } from "@/lib/reminders";
import { createLocalActivitiesRepository } from "@/services/activities-repository";
import { createLocalTasksRepository } from "@/services/tasks-repository";
import type { Activity, Task } from "@/types/planner";

const task: Task = {
  id: "t-1",
  title: "Llamar",
  category: "personal",
  priority: "media",
  dueDate: "2026-11-26",
  completed: false,
  completedAt: null,
  remindBefore: 10,
  createdAt: 1,
  updatedAt: 1,
};

const activity: Activity = {
  id: "a-1",
  title: "Dentista",
  category: "salud",
  date: "2026-11-26",
  start: "10:00",
  remindBefore: 60,
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => window.localStorage.clear());

describe("etiquetas", () => {
  it("las opciones empiezan por 'sin aviso' y los valores son minutos únicos", () => {
    expect(REMINDER_OPTIONS[0]).toEqual({ value: null, label: "Sin aviso" });
    const values = REMINDER_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("describe avisos guardados, incluso los que no están en la lista", () => {
    expect(reminderLabel(null)).toBeNull();
    expect(reminderLabel(undefined)).toBeNull();
    expect(reminderLabel(0)).toBe("A la hora");
    expect(reminderLabel(60)).toBe("1 hora antes");
    expect(reminderLabel(2880)).toBe("2 días antes");
    expect(reminderLabel(180)).toBe("3 horas antes");
    expect(reminderLabel(25)).toBe("25 min antes");
  });
});

describe("readRemindBefore", () => {
  it("solo acepta minutos enteros no negativos", () => {
    expect(readRemindBefore(0)).toBe(0);
    expect(readRemindBefore(90)).toBe(90);
    expect(readRemindBefore(null)).toBeNull();
    expect(readRemindBefore(-5)).toBeUndefined();
    expect(readRemindBefore(1.5)).toBeUndefined();
    expect(readRemindBefore("10")).toBeUndefined();
    expect(readRemindBefore(undefined)).toBeUndefined();
  });
});

describe("cambios", () => {
  it("se puede poner, cambiar y quitar el aviso de una tarea", () => {
    expect(applyTaskPatch(task, { remindBefore: 60 }).remindBefore).toBe(60);
    expect(applyTaskPatch(task, { remindBefore: null }).remindBefore).toBeNull();
    expect(applyTaskPatch(task, { title: "Otro" }).remindBefore).toBe(10);
  });

  it("y lo mismo en una actividad", () => {
    expect(applyActivityPatch(activity, { remindBefore: 0 }).remindBefore).toBe(0);
    expect(applyActivityPatch(activity, { remindBefore: null }).remindBefore).toBeNull();
    expect(applyActivityPatch(activity, { location: "Calle 1" }).remindBefore).toBe(60);
  });
});

describe("almacenamiento local", () => {
  it("conserva el aviso al guardar y volver a leer", async () => {
    const tasks = createLocalTasksRepository();
    await tasks.create(task);
    expect(
      (await createLocalTasksRepository().list()).find((item) => item.id === "t-1")?.remindBefore,
    ).toBe(10);

    const activities = createLocalActivitiesRepository();
    await activities.create(activity);
    expect(
      (await createLocalActivitiesRepository().list()).find((item) => item.id === "a-1")
        ?.remindBefore,
    ).toBe(60);
  });
});
