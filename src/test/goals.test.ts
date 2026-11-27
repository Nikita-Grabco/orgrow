import { describe, expect, it } from "vitest";

import {
  applyGoalPatch,
  daysLeftLabel,
  goalDaysLeft,
  goalProgress,
  habitDaysDone,
  milestoneState,
  normalizeMilestones,
  splitGoals,
  type GoalContext,
} from "@/lib/goals";
import { indexLogs } from "@/lib/habits";
import { createLocalGoalsRepository } from "@/services/goals-repository";
import type { Goal, Habit, HabitLog, Task } from "@/types/planner";

const habit: Habit = {
  id: "h1",
  name: "Leer",
  kind: "check",
  target: 1,
  step: 1,
  frequency: { type: "daily" },
  category: "personal",
  archived: false,
  createdAt: 0,
  updatedAt: 0,
};

const log = (date: string): HabitLog => ({ id: `h1:${date}`, habitId: "h1", date, value: 1 });

const task = (id: string, completed: boolean): Task =>
  ({ id, title: id, completed, category: "personal", priority: "media", dueDate: null }) as Task;

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: "g1",
  title: "Meta",
  category: "personal",
  dueDate: null,
  startDate: "2026-11-01",
  achievedAt: null,
  milestones: [],
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const context = (over: Partial<GoalContext> = {}): GoalContext => ({
  tasks: [],
  habits: [habit],
  index: indexLogs([log("2026-11-01"), log("2026-11-02"), log("2026-10-30")]),
  todayISO: "2026-11-05",
  ...over,
});

describe("normalizeMilestones", () => {
  it("descarta inválidos y enlaces rotos", () => {
    const result = normalizeMilestones([
      { id: "a", title: "  Uno ", done: true },
      { title: "" },
      "basura",
      { id: "b", title: "Dos", link: { type: "habit", habitId: "h1", days: 0 } },
      { id: "c", title: "Tres", link: { type: "task", taskId: "t1" } },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ id: "a", title: "Uno", done: true });
    expect(result[1]?.link).toBeUndefined();
    expect(result[2]?.link).toEqual({ type: "task", taskId: "t1" });
  });

  it("devuelve vacío si no es una lista", () => {
    expect(normalizeMilestones(null)).toEqual([]);
  });
});

describe("habitDaysDone / milestoneState", () => {
  it("cuenta solo desde la fecha de inicio", () => {
    expect(habitDaysDone(habit, context().index, "2026-11-01", "2026-11-05")).toBe(2);
  });

  it("hito de hábito: progreso y cumplimiento", () => {
    const g = goal();
    const m = {
      id: "m",
      title: "x",
      done: false,
      link: { type: "habit", habitId: "h1", days: 2 },
    } as const;
    expect(milestoneState(m, g, context())).toEqual({
      done: true,
      detail: "2/2 días",
      broken: false,
    });
    const m5 = { ...m, link: { ...m.link, days: 5 } };
    expect(milestoneState(m5, g, context()).detail).toBe("2/5 días");
    expect(milestoneState(m5, g, context()).done).toBe(false);
  });

  it("hito de tarea sigue a la tarea; si no existe usa el estado manual", () => {
    const g = goal();
    const m = { id: "m", title: "x", done: true, link: { type: "task", taskId: "t1" } } as const;
    expect(milestoneState(m, g, context({ tasks: [task("t1", false)] })).done).toBe(false);
    expect(milestoneState(m, g, context({ tasks: [task("t1", true)] })).done).toBe(true);
    expect(milestoneState(m, g, context())).toMatchObject({ done: true, broken: true });
  });
});

describe("goalProgress", () => {
  it("calcula el porcentaje", () => {
    const g = goal({
      milestones: [
        { id: "1", title: "a", done: true },
        { id: "2", title: "b", done: false },
        { id: "3", title: "c", done: true },
        { id: "4", title: "d", done: false },
      ],
    });
    expect(goalProgress(g, context())).toEqual({ done: 2, total: 4, percent: 50 });
  });

  it("sin hitos: 0 % (100 % si está logrado)", () => {
    expect(goalProgress(goal(), context()).percent).toBe(0);
    expect(goalProgress(goal({ achievedAt: 5 }), context()).percent).toBe(100);
  });
});

describe("fechas y orden", () => {
  it("días restantes y etiquetas", () => {
    expect(goalDaysLeft(goal({ dueDate: "2026-11-10" }), "2026-11-05")).toBe(5);
    expect(goalDaysLeft(goal(), "2026-11-05")).toBeNull();
    expect(daysLeftLabel(0)).toBe("vence hoy");
    expect(daysLeftLabel(1)).toBe("vence mañana");
    expect(daysLeftLabel(5)).toBe("quedan 5 días");
    expect(daysLeftLabel(-1)).toBe("venció ayer");
    expect(daysLeftLabel(-3)).toBe("venció hace 3 días");
  });

  it("separa activos (por fecha) y logrados", () => {
    const { active, achieved } = splitGoals([
      goal({ id: "sin", createdAt: 1 }),
      goal({ id: "tarde", dueDate: "2026-12-01" }),
      goal({ id: "pronto", dueDate: "2026-11-10" }),
      goal({ id: "hecho", achievedAt: 9 }),
    ]);
    expect(active.map((g) => g.id)).toEqual(["pronto", "tarde", "sin"]);
    expect(achieved.map((g) => g.id)).toEqual(["hecho"]);
  });

  it("applyGoalPatch ignora undefined", () => {
    const next = applyGoalPatch(goal(), { title: "Nueva" });
    expect(next.title).toBe("Nueva");
    expect(next.dueDate).toBeNull();
    expect(next.updatedAt).toBeGreaterThan(1);
  });
});

describe("repositorio local de objetivos", () => {
  it("crea, actualiza y elimina", async () => {
    window.localStorage.clear();
    const repo = createLocalGoalsRepository();
    await repo.create(goal());
    expect(await repo.list()).toHaveLength(1);
    await repo.update(goal({ title: "Otra" }));
    expect((await repo.list())[0]?.title).toBe("Otra");
    await repo.remove("g1");
    expect(await repo.list()).toEqual([]);
  });
});
