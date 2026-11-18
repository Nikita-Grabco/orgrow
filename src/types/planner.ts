/** Domain types. Keep these stable: a future backend should map its rows to these shapes. */

export type CategoryId = "trabajo" | "personal" | "salud" | "hogar";
export type Priority = "alta" | "media" | "baja";
export type NoteKind = "idea" | "por-hacer" | "recordatorio";

export interface Task {
  id: string;
  title: string;
  category: CategoryId;
  priority: Priority;
  /**
   * Local calendar date "YYYY-MM-DD". `null` means the task has no date.
   * Never store UTC timestamps here: a task due "today" must stay today in
   * every time zone, and it must age correctly once the day passes.
   */
  dueDate: string | null;
  /** Optional "HH:mm" time. */
  time?: string | undefined;
  completed: boolean;
  /** Epoch millis of the completion, used for daily metrics. */
  completedAt?: number | null | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface Activity {
  id: string;
  title: string;
  category: CategoryId;
  /**
   * Local calendar date "YYYY-MM-DD", same rule as `Task.dueDate`: a meeting on
   * the 16th is on the 16th in every time zone and ages with the calendar.
   */
  date: string;
  /** "HH:mm" start time. */
  start: string;
  /** "HH:mm" end time, optional. */
  end?: string | undefined;
  location?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  content: string;
  kind: NoteKind;
  pinned: boolean;
  /** Epoch millis, used for ordering. */
  createdAt: number;
}

export interface UserProfile {
  name: string;
  initials: string;
}

export type NewTaskInput = Pick<Task, "title" | "category" | "priority" | "dueDate" | "time">;

/** Fields the UI may change on an existing task. */
export type TaskPatch = Partial<
  Pick<Task, "title" | "category" | "priority" | "dueDate" | "time" | "completed" | "completedAt">
>;

export type NewNoteInput = Pick<Note, "content" | "kind">;

export type NotePatch = Partial<Pick<Note, "content" | "kind" | "pinned">>;

export type NewActivityInput = Pick<
  Activity,
  "title" | "category" | "date" | "start" | "end" | "location"
>;

/** Fields the UI may change on an existing activity. */
export type ActivityPatch = Partial<
  Pick<Activity, "title" | "category" | "date" | "start">
> & {
  /** `null` clears the optional value; `undefined` leaves it untouched. */
  end?: string | null | undefined;
  location?: string | null | undefined;
};
