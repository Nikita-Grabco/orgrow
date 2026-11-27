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
  /**
   * Minutes before the due moment to send a push reminder (0 = at the time).
   * `null` = no reminder; `undefined` = the backend has no reminder column yet.
   * The server computes the exact instant from the date, time and profile time zone.
   */
  remindBefore?: number | null | undefined;
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
  /** Minutes before `start` to send a push reminder. Same meaning as `Task.remindBefore`. */
  remindBefore?: number | null | undefined;
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

export type NewTaskInput = Pick<
  Task,
  "title" | "category" | "priority" | "dueDate" | "time" | "remindBefore"
>;

/** Fields the UI may change on an existing task. */
export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "category"
    | "priority"
    | "dueDate"
    | "time"
    | "completed"
    | "completedAt"
    | "remindBefore"
  >
>;

export type NewNoteInput = Pick<Note, "content" | "kind">;

export type NotePatch = Partial<Pick<Note, "content" | "kind" | "pinned">>;

export type NewActivityInput = Pick<
  Activity,
  "title" | "category" | "date" | "start" | "end" | "location" | "remindBefore"
>;

/** Fields the UI may change on an existing activity. */
export type ActivityPatch = Partial<Pick<Activity, "title" | "category" | "date" | "start">> & {
  /** `null` clears the optional value; `undefined` leaves it untouched. */
  end?: string | null | undefined;
  location?: string | null | undefined;
  /** `null` removes the reminder; `undefined` leaves it untouched. */
  remindBefore?: number | null | undefined;
};

/* -------------------------------------------------------------------------- */
/* Habits                                                                     */
/* -------------------------------------------------------------------------- */

/** `check` = yes/no, `count` = amount with a goal (1 L), `time` = minutes with a goal. */
export type HabitKind = "check" | "count" | "time";

/** Weekdays are indexed 0 = Monday … 6 = Sunday, same order as `WEEKDAY_INITIALS`. */
export type HabitFrequency =
  { type: "daily" } | { type: "weekdays"; days: number[] } | { type: "weekly"; times: number };

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  /** Daily goal: 1 for `check`, an amount for `count`, minutes for `time`. */
  target: number;
  /** How much one tap on "+" adds (ignored for `check`). */
  step: number;
  /** Unit shown for `count` habits ("L", "vasos"…). `time` always uses minutes. */
  unit?: string | undefined;
  frequency: HabitFrequency;
  category: CategoryId;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Progress of one habit on one calendar day. There is at most one log per
 * habit and day; a value of 0 means "no log" and the row is deleted.
 */
export interface HabitLog {
  id: string;
  habitId: string;
  /** Local calendar date "YYYY-MM-DD". */
  date: string;
  value: number;
}

export type NewHabitInput = Pick<
  Habit,
  "name" | "kind" | "target" | "step" | "unit" | "frequency" | "category"
>;

export type HabitPatch = Partial<
  Pick<Habit, "name" | "kind" | "target" | "step" | "frequency" | "category" | "archived">
> & {
  /** `null` clears the unit; `undefined` leaves it untouched. */
  unit?: string | null | undefined;
};

/* -------------------------------------------------------------------------- */
/* Special dates (birthdays, anniversaries…)                                  */
/* -------------------------------------------------------------------------- */

export type SpecialDateKind = "cumpleanos" | "aniversario" | "otra";

/** A date that repeats every year. */
export interface SpecialDate {
  id: string;
  title: string;
  kind: SpecialDateKind;
  /** 1–12. */
  month: number;
  /** 1–31, valid for the month (29 allowed in February). */
  day: number;
  /** Optional year of origin, to show an age or the years completed. */
  year?: number | undefined;
  /**
   * Days before to send a push reminder (0 = the same day). `null` = no reminder;
   * `undefined` = the backend has no such column yet.
   */
  remindBeforeDays?: number | null | undefined;
  createdAt: number;
  updatedAt: number;
}

export type NewSpecialDateInput = Pick<
  SpecialDate,
  "title" | "kind" | "month" | "day" | "year" | "remindBeforeDays"
>;

export type SpecialDatePatch = Partial<Pick<SpecialDate, "title" | "kind" | "month" | "day">> & {
  /** `null` clears the year; `undefined` leaves it untouched. */
  year?: number | null | undefined;
  remindBeforeDays?: number | null | undefined;
};

/* -------------------------------------------------------------------------- */
/* Goals (long-term objectives with milestones)                               */
/* -------------------------------------------------------------------------- */

/** What completes a milestone on its own. */
export type MilestoneLink =
  | { type: "task"; taskId: string }
  /** Done once the habit was completed on `days` days since the goal started. */
  | { type: "habit"; habitId: string; days: number };

export interface Milestone {
  id: string;
  title: string;
  /** Manual state. Ignored while the milestone has a valid `link`. */
  done: boolean;
  link?: MilestoneLink | undefined;
}

export interface Goal {
  id: string;
  title: string;
  category: CategoryId;
  /** Local calendar date "YYYY-MM-DD", or `null` for no deadline. */
  dueDate: string | null;
  /** Local calendar date the goal started; habit milestones count days from here. */
  startDate: string;
  /** Epoch millis when it was marked as achieved; `null` while active. */
  achievedAt: number | null;
  milestones: Milestone[];
  createdAt: number;
  updatedAt: number;
}

export type NewGoalInput = Pick<Goal, "title" | "category" | "dueDate" | "milestones">;

export type GoalPatch = Partial<
  Pick<Goal, "title" | "category" | "dueDate" | "milestones" | "achievedAt">
>;
