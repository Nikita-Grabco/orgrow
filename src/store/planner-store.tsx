import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { toISODate } from "@/lib/dates";
import { applyActivityPatch, applyTaskPatch, createId } from "@/lib/planner";
import { createLocalActivitiesRepository } from "@/services/activities-repository";
import { createLocalNotesRepository } from "@/services/notes-repository";
import { createLocalTasksRepository } from "@/services/tasks-repository";
import type {
  Activity,
  ActivityPatch,
  NewActivityInput,
  NewNoteInput,
  NewTaskInput,
  Note,
  Task,
  TaskPatch,
} from "@/types/planner";

/**
 * App state on top of the repositories. Components only talk to this hook, so
 * the storage (localStorage today, Supabase later) never leaks into the UI.
 */
interface TaskDialogState {
  open: boolean;
  mode: "create" | "edit";
  taskId: string | null;
  dueDate: string | null;
}

interface ActivityDialogState {
  open: boolean;
  mode: "create" | "edit";
  activityId: string | null;
  /** Date pre-selected when creating from a specific day. */
  date: string | null;
}

interface PlannerContextValue {
  tasks: Task[];
  activities: Activity[];
  notes: Note[];
  /** False until saved data has been hydrated from the browser. */
  isReady: boolean;

  toggleTask: (id: string) => void;
  addTask: (input: NewTaskInput) => void;
  editTask: (id: string, patch: TaskPatch) => void;
  deleteTask: (id: string) => void;

  addActivity: (input: NewActivityInput) => void;
  editActivity: (id: string, patch: ActivityPatch) => void;
  deleteActivity: (id: string) => void;

  addNote: (input: NewNoteInput) => void;
  togglePinNote: (id: string) => void;
  deleteNote: (id: string) => void;
  convertNoteToTask: (id: string) => void;

  taskDialog: TaskDialogState;
  /** Omit for today; pass `null` to open the dialog without a date. */
  openAddTask: (dueDate?: string | null) => void;
  openEditTask: (id: string) => void;
  setTaskDialogOpen: (open: boolean) => void;

  activityDialog: ActivityDialogState;
  /** Omit for today; pass `null` to open without a date. */
  openAddActivity: (date?: string | null) => void;
  openEditActivity: (id: string) => void;
  setActivityDialogOpen: (open: boolean) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

const CLOSED_TASK_DIALOG: TaskDialogState = {
  open: false,
  mode: "create",
  taskId: null,
  dueDate: null,
};

const CLOSED_ACTIVITY_DIALOG: ActivityDialogState = {
  open: false,
  mode: "create",
  activityId: null,
  date: null,
};

export function PlannerProvider({ children }: { children: ReactNode }) {
  const tasksRepo = useMemo(createLocalTasksRepository, []);
  const notesRepo = useMemo(createLocalNotesRepository, []);
  const activitiesRepo = useMemo(createLocalActivitiesRepository, []);

  // Empty until hydrated: the server never reads localStorage, so the first
  // client render matches the server HTML and avoids hydration mismatches.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>(CLOSED_TASK_DIALOG);
  const [activityDialog, setActivityDialog] =
    useState<ActivityDialogState>(CLOSED_ACTIVITY_DIALOG);

  const loadAll = useCallback(
    () => Promise.all([tasksRepo.list(), notesRepo.list(), activitiesRepo.list()]),
    [tasksRepo, notesRepo, activitiesRepo],
  );

  const reload = useCallback(async () => {
    const [nextTasks, nextNotes, nextActivities] = await loadAll();
    setTasks(nextTasks);
    setNotes(nextNotes);
    setActivities(nextActivities);
  }, [loadAll]);

  useEffect(() => {
    let active = true;

    loadAll()
      .then(([nextTasks, nextNotes, nextActivities]) => {
        if (!active) return;
        setTasks(nextTasks);
        setNotes(nextNotes);
        setActivities(nextActivities);
      })
      .catch((error: unknown) => {
        console.error("[orgadia] No se pudieron cargar los datos", error);
        toast.error("No se pudieron cargar tus datos guardados");
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [loadAll]);

  /** Optimistic updates roll back to the saved truth when persistence fails. */
  const reportPersistError = useCallback(
    async (message: string, error: unknown) => {
      console.error(`[orgadia] ${message}`, error);
      toast.error(message);
      try {
        await reload();
      } catch (reloadError) {
        console.error("[orgadia] No se pudo recargar el estado", reloadError);
      }
    },
    [reload],
  );

  const commitTask = useCallback(
    (task: Task, patch: TaskPatch) => {
      const updated = applyTaskPatch(task, patch);
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      void tasksRepo
        .update(updated)
        .catch((error: unknown) => reportPersistError("No se pudo guardar el cambio", error));
    },
    [tasksRepo, reportPersistError],
  );

  const toggleTask = useCallback(
    (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      commitTask(task, {
        completed: !task.completed,
        completedAt: task.completed ? null : Date.now(),
      });
    },
    [tasks, commitTask],
  );

  const editTask = useCallback(
    (id: string, patch: TaskPatch) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      commitTask(task, patch);
    },
    [tasks, commitTask],
  );

  const addTask = useCallback(
    (input: NewTaskInput) => {
      const now = Date.now();
      const task: Task = {
        ...input,
        id: createId("t"),
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [...prev, task]);
      void tasksRepo
        .create(task)
        .catch((error: unknown) => reportPersistError("No se pudo guardar la tarea", error));
    },
    [tasksRepo, reportPersistError],
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((task) => task.id !== id));
      void tasksRepo
        .remove(id)
        .catch((error: unknown) => reportPersistError("No se pudo eliminar la tarea", error));
    },
    [tasksRepo, reportPersistError],
  );

  const commitActivity = useCallback(
    (activity: Activity, patch: ActivityPatch) => {
      const updated = applyActivityPatch(activity, patch);
      setActivities((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      void activitiesRepo
        .update(updated)
        .catch((error: unknown) => reportPersistError("No se pudo guardar la actividad", error));
    },
    [activitiesRepo, reportPersistError],
  );

  const addActivity = useCallback(
    (input: NewActivityInput) => {
      const now = Date.now();
      const activity: Activity = { ...input, id: createId("a"), createdAt: now, updatedAt: now };
      setActivities((prev) => [...prev, activity]);
      void activitiesRepo
        .create(activity)
        .catch((error: unknown) => reportPersistError("No se pudo guardar la actividad", error));
    },
    [activitiesRepo, reportPersistError],
  );

  const editActivity = useCallback(
    (id: string, patch: ActivityPatch) => {
      const activity = activities.find((item) => item.id === id);
      if (!activity) return;
      commitActivity(activity, patch);
    },
    [activities, commitActivity],
  );

  const deleteActivity = useCallback(
    (id: string) => {
      setActivities((prev) => prev.filter((activity) => activity.id !== id));
      void activitiesRepo
        .remove(id)
        .catch((error) => reportPersistError("No se pudo eliminar la actividad", error));
    },
    [activitiesRepo, reportPersistError],
  );

  const addNote = useCallback(
    (input: NewNoteInput) => {
      const note: Note = { ...input, id: createId("n"), pinned: false, createdAt: Date.now() };
      setNotes((prev) => [note, ...prev]);
      void notesRepo
        .create(note)
        .catch((error: unknown) => reportPersistError("No se pudo guardar la nota", error));
    },
    [notesRepo, reportPersistError],
  );

  const togglePinNote = useCallback(
    (id: string) => {
      const note = notes.find((item) => item.id === id);
      if (!note) return;

      const updated: Note = { ...note, pinned: !note.pinned };
      setNotes((prev) => prev.map((item) => (item.id === id ? updated : item)));
      void notesRepo
        .update(updated)
        .catch((error: unknown) => reportPersistError("No se pudo actualizar la nota", error));
    },
    [notes, notesRepo, reportPersistError],
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((note) => note.id !== id));
      void notesRepo
        .remove(id)
        .catch((error: unknown) => reportPersistError("No se pudo eliminar la nota", error));
    },
    [notesRepo, reportPersistError],
  );

  const convertNoteToTask = useCallback(
    (id: string) => {
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      addTask({
        title: note.content,
        category: "personal",
        priority: "media",
        dueDate: toISODate(new Date()),
      });
      deleteNote(id);
    },
    [notes, addTask, deleteNote],
  );

  const openAddTask = useCallback((dueDate?: string | null) => {
    setTaskDialog({
      open: true,
      mode: "create",
      taskId: null,
      dueDate: dueDate === undefined ? toISODate(new Date()) : dueDate,
    });
  }, []);

  const openEditTask = useCallback((id: string) => {
    setTaskDialog({ open: true, mode: "edit", taskId: id, dueDate: null });
  }, []);

  const setTaskDialogOpen = useCallback((open: boolean) => {
    setTaskDialog((prev) => ({ ...prev, open }));
  }, []);

  const openAddActivity = useCallback((date?: string | null) => {
    setActivityDialog({
      open: true,
      mode: "create",
      activityId: null,
      date: date === undefined ? toISODate(new Date()) : date,
    });
  }, []);

  const openEditActivity = useCallback((id: string) => {
    setActivityDialog({ open: true, mode: "edit", activityId: id, date: null });
  }, []);

  const setActivityDialogOpen = useCallback((open: boolean) => {
    setActivityDialog((prev) => ({ ...prev, open }));
  }, []);

  const value = useMemo<PlannerContextValue>(
    () => ({
      tasks,
      activities,
      notes,
      isReady,
      toggleTask,
      addTask,
      editTask,
      deleteTask,
      addActivity,
      editActivity,
      deleteActivity,
      addNote,
      togglePinNote,
      deleteNote,
      convertNoteToTask,
      taskDialog,
      openAddTask,
      openEditTask,
      setTaskDialogOpen,
      activityDialog,
      openAddActivity,
      openEditActivity,
      setActivityDialogOpen,
    }),
    [
      tasks,
      activities,
      notes,
      isReady,
      toggleTask,
      addTask,
      editTask,
      deleteTask,
      addActivity,
      editActivity,
      deleteActivity,
      addNote,
      togglePinNote,
      deleteNote,
      convertNoteToTask,
      taskDialog,
      openAddTask,
      openEditTask,
      setTaskDialogOpen,
      activityDialog,
      openAddActivity,
      openEditActivity,
      setActivityDialogOpen,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}
