import { describe, expect, it } from "vitest";

import {
  activityFromRow,
  activityToInsert,
  activityToUpdate,
  habitFromRow,
  habitLogFromRow,
  habitToInsert,
  habitToUpdate,
  millisFromDb,
  noteFromRow,
  profileFromRow,
  taskFromRow,
  taskToInsert,
  taskToUpdate,
  timeFromDb,
  type HabitRow,
  type TaskRow,
} from "@/services/mappers";

const TASK_ROW: TaskRow = {
  id: "5b0c1c2e-0000-4000-8000-000000000001",
  title: "Llamar al médico",
  category: "salud",
  priority: "alta",
  due_date: "2026-11-26",
  due_time: "09:30:00",
  completed: true,
  completed_at: "2026-11-25T10:00:00.000Z",
  created_at: "2026-11-20T08:00:00.000Z",
  updated_at: "2026-11-25T10:00:00.000Z",
};

const HABIT_ROW: HabitRow = {
  id: "5b0c1c2e-0000-4000-8000-000000000002",
  name: "Beber agua",
  kind: "count",
  target: "2.00",
  step: 0.25,
  unit: "L",
  frequency_type: "weekdays",
  frequency_days: [0, 2, 4],
  frequency_times: null,
  category: "salud",
  archived: false,
  created_at: "2026-11-20T08:00:00.000Z",
  updated_at: "2026-11-20T08:00:00.000Z",
};

describe("conversiones básicas", () => {
  it("recorta la hora de HH:mm:ss a HH:mm", () => {
    expect(timeFromDb("09:30:00")).toBe("09:30");
    expect(timeFromDb("09:30")).toBe("09:30");
    expect(timeFromDb(null)).toBeUndefined();
  });

  it("convierte ISO a milisegundos y nunca devuelve NaN", () => {
    expect(millisFromDb("2026-11-25T10:00:00.000Z")).toBe(Date.parse("2026-11-25T10:00:00.000Z"));
    expect(millisFromDb(null)).toBe(0);
    expect(millisFromDb("no es una fecha")).toBe(0);
  });
});

describe("perfil", () => {
  it("pasa a camelCase", () => {
    expect(profileFromRow({ id: "u1", display_name: "Nikita", timezone: "Europe/Madrid" })).toEqual({
      id: "u1",
      displayName: "Nikita",
      timezone: "Europe/Madrid",
    });
  });
});

describe("tareas", () => {
  it("lee una fila completa", () => {
    expect(taskFromRow(TASK_ROW)).toEqual({
      id: TASK_ROW.id,
      title: "Llamar al médico",
      category: "salud",
      priority: "alta",
      dueDate: "2026-11-26",
      time: "09:30",
      completed: true,
      completedAt: Date.parse("2026-11-25T10:00:00.000Z"),
      createdAt: Date.parse("2026-11-20T08:00:00.000Z"),
      updatedAt: Date.parse("2026-11-25T10:00:00.000Z"),
    });
  });

  it("una tarea sin fecha ni hora ni completar conserva null / undefined", () => {
    const task = taskFromRow({
      ...TASK_ROW,
      due_date: null,
      due_time: null,
      completed: false,
      completed_at: null,
    });
    expect(task.dueDate).toBeNull();
    expect(task.time).toBeUndefined();
    expect(task.completedAt).toBeNull();
  });

  it("al crear no manda user_id ni timestamps, y sí el id si se da", () => {
    const row = taskToInsert(
      { title: "Comprar pan", category: "hogar", priority: "baja", dueDate: null },
      "id-1",
    );
    expect(row).toEqual({
      id: "id-1",
      title: "Comprar pan",
      category: "hogar",
      priority: "baja",
      due_date: null,
      due_time: null,
    });
    expect(row).not.toHaveProperty("user_id");
    expect(row).not.toHaveProperty("created_at");
  });

  it("al crear sin id no manda la clave id", () => {
    const row = taskToInsert({ title: "x", category: "hogar", priority: "baja", dueDate: null });
    expect(row).not.toHaveProperty("id");
  });

  it("al editar solo manda lo que cambia", () => {
    expect(taskToUpdate({ title: "Nuevo" })).toEqual({ title: "Nuevo" });
  });

  it("completar y descompletar rellenan completed_at", () => {
    const at = Date.parse("2026-11-25T10:00:00.000Z");
    expect(taskToUpdate({ completed: true, completedAt: at })).toEqual({
      completed: true,
      completed_at: "2026-11-25T10:00:00.000Z",
    });
    expect(taskToUpdate({ completed: false, completedAt: null })).toEqual({
      completed: false,
      completed_at: null,
    });
  });

  it("quitar fecha y hora se envía como null", () => {
    expect(taskToUpdate({ dueDate: null, time: undefined })).toEqual({
      due_date: null,
      due_time: null,
    });
  });
});

describe("notas", () => {
  it("lee una nota", () => {
    expect(
      noteFromRow({
        id: "n1",
        content: "Idea",
        kind: "idea",
        pinned: true,
        created_at: "2026-11-25T10:00:00.000Z",
      }),
    ).toEqual({
      id: "n1",
      content: "Idea",
      kind: "idea",
      pinned: true,
      createdAt: Date.parse("2026-11-25T10:00:00.000Z"),
    });
  });
});

describe("actividades", () => {
  it("recorta horas y convierte location null en undefined", () => {
    const activity = activityFromRow({
      id: "a1",
      title: "Gimnasio",
      category: "salud",
      date: "2026-11-26",
      start_time: "18:00:00",
      end_time: "19:30:00",
      location: null,
      created_at: "2026-11-20T08:00:00.000Z",
      updated_at: "2026-11-20T08:00:00.000Z",
    });
    expect(activity.start).toBe("18:00");
    expect(activity.end).toBe("19:30");
    expect(activity.location).toBeUndefined();
  });

  it("al crear usa start_time / end_time", () => {
    expect(
      activityToInsert({
        title: "Reunión",
        category: "trabajo",
        date: "2026-11-26",
        start: "10:00",
        end: undefined,
        location: undefined,
      }),
    ).toEqual({
      title: "Reunión",
      category: "trabajo",
      date: "2026-11-26",
      start_time: "10:00",
      end_time: null,
      location: null,
    });
  });

  it("al editar, null limpia y undefined no toca", () => {
    expect(activityToUpdate({ end: null, location: undefined, start: "11:00" })).toEqual({
      end_time: null,
      start_time: "11:00",
    });
  });
});

describe("hábitos", () => {
  it("lee numeric como número y los días de la frecuencia", () => {
    const habit = habitFromRow(HABIT_ROW);
    expect(habit.target).toBe(2);
    expect(habit.step).toBe(0.25);
    expect(habit.unit).toBe("L");
    expect(habit.frequency).toEqual({ type: "weekdays", days: [0, 2, 4] });
  });

  it("lee las frecuencias diaria y semanal", () => {
    expect(
      habitFromRow({ ...HABIT_ROW, frequency_type: "daily", frequency_days: null }).frequency,
    ).toEqual({ type: "daily" });
    expect(
      habitFromRow({
        ...HABIT_ROW,
        frequency_type: "weekly",
        frequency_days: null,
        frequency_times: 3,
      }).frequency,
    ).toEqual({ type: "weekly", times: 3 });
  });

  it("escribe columnas de frecuencia coherentes con el CHECK de la tabla", () => {
    const base = {
      name: "Leer",
      kind: "time" as const,
      target: 60,
      step: 15,
      category: "personal" as const,
    };
    expect(habitToInsert({ ...base, unit: undefined, frequency: { type: "daily" } })).toMatchObject({
      frequency_type: "daily",
      frequency_days: null,
      frequency_times: null,
    });
    expect(
      habitToInsert({ ...base, unit: undefined, frequency: { type: "weekly", times: 4 } }),
    ).toMatchObject({ frequency_type: "weekly", frequency_days: null, frequency_times: 4 });
    expect(
      habitToInsert({ ...base, unit: undefined, frequency: { type: "weekdays", days: [1, 3] } }),
    ).toMatchObject({ frequency_type: "weekdays", frequency_days: [1, 3], frequency_times: null });
  });

  it("solo los hábitos de cantidad guardan unidad (lo exige un CHECK)", () => {
    const row = habitToInsert({
      name: "Leer",
      kind: "time",
      target: 60,
      step: 15,
      unit: "min",
      frequency: { type: "daily" },
      category: "personal",
    });
    expect(row.unit).toBeNull();
  });

  it("al editar sin frecuencia no toca sus columnas", () => {
    const row = habitToUpdate({ archived: true });
    expect(row).toEqual({ archived: true });
  });

  it("al cambiar la frecuencia reescribe las tres columnas", () => {
    expect(habitToUpdate({ frequency: { type: "daily" } })).toEqual({
      frequency_type: "daily",
      frequency_days: null,
      frequency_times: null,
    });
  });
});

describe("registros de hábito", () => {
  it("lee un registro con value numérico y lo identifica por hábito y día", () => {
    expect(habitLogFromRow({ id: "l1", habit_id: "h1", log_date: "2026-11-25", value: "0.50" })).toEqual({
      id: "h1:2026-11-25",
      habitId: "h1",
      date: "2026-11-25",
      value: 0.5,
    });
  });
});
