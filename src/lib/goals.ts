import { parseISODate, shiftISODate } from "@/lib/dates";
import { createId } from "@/lib/planner";
import { isDone, logValue, type HabitLogIndex } from "@/lib/habits";
import type { Goal, GoalPatch, Habit, Milestone, MilestoneLink, Task } from "@/types/planner";

export const MAX_MILESTONES = 50;
export const MAX_MILESTONE_DAYS = 3650;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readLink(raw: unknown): MilestoneLink | undefined {
  if (!isObject(raw)) return undefined;
  if (raw["type"] === "task" && typeof raw["taskId"] === "string" && raw["taskId"]) {
    return { type: "task", taskId: raw["taskId"] };
  }
  const days = raw["days"];
  if (
    raw["type"] === "habit" &&
    typeof raw["habitId"] === "string" &&
    raw["habitId"] &&
    typeof days === "number" &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= MAX_MILESTONE_DAYS
  ) {
    return { type: "habit", habitId: raw["habitId"], days };
  }
  return undefined;
}

/** Lee hitos de cualquier origen (base de datos, almacenamiento local, copia); descarta los inválidos. */
export function normalizeMilestones(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];
  const result: Milestone[] = [];
  for (const item of raw.slice(0, MAX_MILESTONES)) {
    if (!isObject(item)) continue;
    const title = typeof item["title"] === "string" ? item["title"].trim().slice(0, 120) : "";
    if (!title) continue;
    const link = readLink(item["link"]);
    result.push({
      id: typeof item["id"] === "string" && item["id"] ? item["id"] : createId("m"),
      title,
      done: item["done"] === true,
      ...(link ? { link } : {}),
    });
  }
  return result;
}

export function newMilestone(title = ""): Milestone {
  return { id: createId("m"), title, done: false };
}

/** Días (desde `startISO` hasta hoy, ambos incluidos) en que el hábito se cumplió. */
export function habitDaysDone(
  habit: Habit,
  index: HabitLogIndex,
  startISO: string,
  todayISO: string,
): number {
  let count = 0;
  let day = startISO;
  for (let i = 0; i <= MAX_MILESTONE_DAYS && day <= todayISO; i += 1) {
    if (isDone(habit, logValue(index, habit.id, day))) count += 1;
    day = shiftISODate(day, 1);
  }
  return count;
}

export interface GoalContext {
  tasks: Task[];
  habits: Habit[];
  index: HabitLogIndex;
  todayISO: string;
}

export interface MilestoneState {
  done: boolean;
  /** "18/30 días" para hitos de hábito. */
  detail: string | null;
  /** El enlace apunta a algo que ya no existe: se usa el estado manual. */
  broken: boolean;
}

export function milestoneState(
  milestone: Milestone,
  goal: Pick<Goal, "startDate">,
  context: GoalContext,
): MilestoneState {
  const { link } = milestone;
  if (link?.type === "task") {
    const task = context.tasks.find((item) => item.id === link.taskId);
    if (task) return { done: task.completed, detail: null, broken: false };
    return { done: milestone.done, detail: null, broken: true };
  }
  if (link?.type === "habit") {
    const habit = context.habits.find((item) => item.id === link.habitId);
    if (habit) {
      const days = habitDaysDone(habit, context.index, goal.startDate, context.todayISO);
      return {
        done: days >= link.days,
        detail: `${Math.min(days, link.days)}/${link.days} días`,
        broken: false,
      };
    }
    return { done: milestone.done, detail: null, broken: true };
  }
  return { done: milestone.done, detail: null, broken: false };
}

export function goalProgress(
  goal: Goal,
  context: GoalContext,
): { done: number; total: number; percent: number } {
  const total = goal.milestones.length;
  if (total === 0) return { done: 0, total: 0, percent: goal.achievedAt ? 100 : 0 };
  const done = goal.milestones.filter((m) => milestoneState(m, goal, context).done).length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

/** Días hasta la fecha límite: negativo si ya pasó, `null` si no tiene. */
export function goalDaysLeft(goal: Pick<Goal, "dueDate">, todayISO: string): number | null {
  if (!goal.dueDate) return null;
  return Math.round(
    (parseISODate(goal.dueDate).getTime() - parseISODate(todayISO).getTime()) / 86_400_000,
  );
}

/** "quedan 34 días", "vence mañana", "venció hace 3 días". */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return "vence hoy";
  if (daysLeft === 1) return "vence mañana";
  if (daysLeft > 1) return `quedan ${daysLeft} días`;
  return daysLeft === -1 ? "venció ayer" : `venció hace ${-daysLeft} días`;
}

/** Activos primero, por fecha límite (los que no tienen, al final); logrados aparte. */
export function splitGoals(goals: Goal[]): { active: Goal[]; achieved: Goal[] } {
  const active = goals
    .filter((goal) => goal.achievedAt === null)
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.createdAt - b.createdAt;
    });
  const achieved = goals
    .filter((goal) => goal.achievedAt !== null)
    .sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0));
  return { active, achieved };
}

export function applyGoalPatch(goal: Goal, patch: GoalPatch): Goal {
  return {
    ...goal,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    updatedAt: Date.now(),
  };
}
