import { dueDateLabel, isOverdue } from "@/lib/dates";
import { compareTime } from "@/lib/time";
import type {
  Activity,
  ActivityPatch,
  Note,
  Priority,
  Task,
  TaskPatch,
} from "@/types/planner";

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
  return [...activities].sort(
    (a, b) => a.date.localeCompare(b.date) || compareTime(a.start, b.start),
  );
}

/** Activities of one calendar day, already ordered by time. */
export function getActivitiesOn(activities: Activity[], date: string | null): Activity[] {
  if (!date) return [];
  return sortActivities(activities.filter((activity) => activity.date === date));
}

export interface ActivityGroup {
  date: string;
  activities: Activity[];
}

/** Groups by day, chronological. Used by the dashboard list. */
export function groupActivitiesByDate(activities: Activity[]): ActivityGroup[] {
  const byDate = new Map<string, Activity[]>();
  for (const activity of sortActivities(activities)) {
    const list = byDate.get(activity.date);
    if (list) list.push(activity);
    else byDate.set(activity.date, [activity]);
  }
  return [...byDate.entries()].map(([date, list]) => ({ date, activities: list }));
}

/**
 * Activities that have not finished yet: everything from tomorrow on, plus
 * today's ones that still have time left. `nowTime` is "HH:mm" or null while
 * the client clock is unknown.
 */
export function getUpcomingActivities(
  activities: Activity[],
  todayISO: string | null,
  nowTime: string | null,
): Activity[] {
  const sorted = sortActivities(activities);
  if (!todayISO) return sorted;

  return sorted.filter((activity) => {
    if (activity.date !== todayISO) return activity.date > todayISO;
    if (nowTime === null) return true;
    return (activity.end ?? activity.start) >= nowTime;
  });
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

/** Same contract as `applyTaskPatch`, for activities. */
export function applyActivityPatch(activity: Activity, patch: ActivityPatch): Activity {
  return {
    ...activity,
    title: patch.title ?? activity.title,
    category: patch.category ?? activity.category,
    date: patch.date ?? activity.date,
    start: patch.start ?? activity.start,
    end: patch.end === undefined ? activity.end : (patch.end ?? undefined),
    location: patch.location === undefined ? activity.location : (patch.location ?? undefined),
    updatedAt: Date.now(),
  };
}

/**
 * Id nuevo para cualquier entidad. Es un `uuid` porque las columnas `id` de la
 * base de datos lo son y el cliente genera el id antes de guardar (la UI
 * optimista necesita conocerlo). El prefijo solo se usa en el respaldo para
 * entornos sin `crypto.randomUUID`.
 */
export function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
