import { dueDateLabel, isOverdue } from "@/lib/dates";
import type { Activity, Note, Priority, Task, TaskPatch } from "@/types/planner";

export function getProgress(tasks: Task[]) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return {
    total,
    completed,
    pending: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function getProgressMessage(percent: number, total: number): string {
  if (total === 0) return "Un día en blanco";
  if (percent === 100) return "¡Día completado!";
  if (percent >= 70) return "Ya casi lo tienes";
  if (percent >= 40) return "Vas por buen camino";
  if (percent > 0) return "Buen comienzo";
  return "Empecemos con calma";
}

const priorityRank: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
const NO_DATE = "9999-12-31";

/** Pending first, then by due date (undated last), then by time, then by priority. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.dueDate ?? NO_DATE).localeCompare(b.dueDate ?? NO_DATE) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      priorityRank[a.priority] - priorityRank[b.priority],
  );
}

export function sortActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => a.dayOffset - b.dayOffset || a.start.localeCompare(b.start));
}

/** Activities that haven't started yet, given the current "HH:mm". */
export function getUpcoming(activities: Activity[], nowTime: string | null): Activity[] {
  return sortActivities(activities).filter(
    (a) => a.dayOffset > 0 || nowTime === null || a.start >= nowTime,
  );
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

export function getTasksDueOn(tasks: Task[], dueDate: string | null): Task[] {
  if (!dueDate) return [];
  return tasks.filter((t) => t.dueDate === dueDate);
}

export function getOverdueTasks(tasks: Task[], today: Date | null): Task[] {
  return tasks.filter((t) => isOverdue(t.dueDate, t.completed, today));
}

export interface TaskGroup {
  /** Stable key: the ISO date, "overdue" or "undated". */
  key: string;
  label: string;
  tasks: Task[];
  tone?: "overdue";
}

/**
 * Groups tasks for the Tareas page: pending overdue first, then one section per
 * date (today, tomorrow, later), then undated ones. Shared by the UI so the
 * grouping rules live in one place.
 */
export function groupTasksByDate(tasks: Task[], today: Date | null): TaskGroup[] {
  const overdue: Task[] = [];
  const byDate = new Map<string, Task[]>();
  const undated: Task[] = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      undated.push(task);
      continue;
    }
    if (isOverdue(task.dueDate, task.completed, today)) {
      overdue.push(task);
      continue;
    }
    const list = byDate.get(task.dueDate);
    if (list) list.push(task);
    else byDate.set(task.dueDate, [task]);
  }

  const groups: TaskGroup[] = [];
  if (overdue.length > 0) {
    groups.push({ key: "overdue", label: "Atrasadas", tasks: sortTasks(overdue), tone: "overdue" });
  }

  for (const [dueDate, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    groups.push({ key: dueDate, label: dueDateLabel(dueDate, today), tasks: sortTasks(list) });
  }

  if (undated.length > 0) {
    groups.push({ key: "undated", label: "Sin fecha", tasks: sortTasks(undated) });
  }

  return groups;
}

/** Applies a patch without losing fields the caller didn't touch. */
export function applyTaskPatch(task: Task, patch: TaskPatch): Task {
  return {
    ...task,
    title: patch.title ?? task.title,
    category: patch.category ?? task.category,
    priority: patch.priority ?? task.priority,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : task.dueDate,
    time: patch.time !== undefined ? patch.time : task.time,
    completed: patch.completed ?? task.completed,
    completedAt: patch.completedAt !== undefined ? patch.completedAt : task.completedAt,
    updatedAt: Date.now(),
  };
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
