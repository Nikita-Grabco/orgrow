import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { toISODate } from "@/lib/dates";
import { roundValue } from "@/lib/habits";
import { applyActivityPatch, applyNotePatch, applyTaskPatch, createId } from "@/lib/planner";
import { habitLogId } from "@/services/habits-repository";
import {
  createLocalPlannerRepositories,
  type PlannerRepositories,
} from "@/services/supabase-repositories";
import type {
  Activity,
  ActivityPatch,
  Habit,
  HabitLog,
  HabitPatch,
  NewActivityInput,
  NewHabitInput,
  NewNoteInput,
  NewTaskInput,
  Note,
  NotePatch,
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

interface HabitDialogState {
  open: boolean;
  mode: "create" | "edit";
  habitId: string | null;
}

interface PlannerContextValue {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  activities: Activity[];
  notes: Note[];
  /** False until saved data has been hydrated from the browser. */
  isReady: boolean;
  /** Vuelve a leer todos los datos (p. ej. tras importar una copia de seguridad). */
  reloadData: () => Promise<void>;

  toggleTask: (id: string) => void;
  addTask: (input: NewTaskInput) => void;
  editTask: (id: string, patch: TaskPatch) => void;
  deleteTask: (id: string) => void;

  addActivity: (input: NewActivityInput) => void;
  editActivity: (id: string, patch: ActivityPatch) => void;
  deleteActivity: (id: string) => void;

  addHabit: (input: NewHabitInput) => void;
  editHabit: (id: string, patch: HabitPatch) => void;
  deleteHabit: (id: string) => void;
  /** Sets the progress of a habit on a day; 0 or less clears it. */
  setHabitValue: (habitId: string, date: string, value: number) => void;

  addNote: (input: NewNoteInput) => void;
  /** Cambia texto o tipo. Un texto vacío se ignora y devuelve `false`. */
  editNote: (id: string, patch: NotePatch) => boolean;
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

  habitDialog: HabitDialogState;
  openAddHabit: () => void;
  openEditHabit: (id: string) => void;
  setHabitDialogOpen: (open: boolean) => void;
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

const CLOSED_HABIT_DIALOG: HabitDialogState = { open: false, mode: "create", habitId: null };

/** Un dispositivo que vuelve a primer plano tras este tiempo comprueba si hay cambios. */
const RESYNC_AFTER_HIDDEN_MS = 5_000;

interface PlannerProviderProps {
  children: ReactNode;
  /** Dónde se guardan los datos. Sin esto, en el navegador (`localStorage`). */
  repositories?: PlannerRepositories;
  /** Se espera antes de la primera carga (p. ej. importar datos antiguos). Si falla, se avisa y se sigue. */
  beforeLoad?: () => Promise<void>;
  /** Recarga los datos al volver a la app, para ver lo que se cambió en otro dispositivo. */
  syncOnFocus?: boolean;
}

export function PlannerProvider({
  children,
  repositories,
  beforeLoad,
  syncOnFocus = false,
}: PlannerProviderProps) {
  const repos = useMemo(() => repositories ?? createLocalPlannerRepositories(), [repositories]);
  const {
    tasks: tasksRepo,
    notes: notesRepo,
    activities: activitiesRepo,
    habits: habitsRepo,
    habitLogs: habitLogsRepo,
  } = repos;

  // La función cambia en cada render del padre; la última es la que vale al cargar.
  const beforeLoadRef = useRef(beforeLoad);
  beforeLoadRef.current = beforeLoad;

  // Empty until hydrated: the server never reads localStorage, so the first
  // client render matches the server HTML and avoids hydration mismatches.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>(CLOSED_TASK_DIALOG);
  const [activityDialog, setActivityDialog] = useState<ActivityDialogState>(CLOSED_ACTIVITY_DIALOG);
  const [habitDialog, setHabitDialog] = useState<HabitDialogState>(CLOSED_HABIT_DIALOG);

  const loadAll = useCallback(
    () =>
      Promise.all([
        tasksRepo.list(),
        notesRepo.list(),
        activitiesRepo.list(),
        habitsRepo.list(),
        habitLogsRepo.list(),
      ]),
    [tasksRepo, notesRepo, activitiesRepo, habitsRepo, habitLogsRepo],
  );

  const reload = useCallback(async () => {
    const [nextTasks, nextNotes, nextActivities, nextHabits, nextLogs] = await loadAll();
    setTasks(nextTasks);
    setNotes(nextNotes);
    setActivities(nextActivities);
    setHabits(nextHabits);
    setHabitLogs(nextLogs);
  }, [loadAll]);

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      try {
        await beforeLoadRef.current?.();
      } catch (error) {
        // Importar es un extra: sin él la app debe seguir cargando lo que hay.
        console.error("[orgrow] Falló la preparación previa a la carga", error);
      }
    };

    prepare()
      .then(loadAll)
      .then(([nextTasks, nextNotes, nextActivities, nextHabits, nextLogs]) => {
        if (!active) return;
        setTasks(nextTasks);
        setNotes(nextNotes);
        setActivities(nextActivities);
        setHabits(nextHabits);
        setHabitLogs(nextLogs);
      })
      .catch((error: unknown) => {
        console.error("[orgrow] No se pudieron cargar los datos", error);
        toast.error("No se pudieron cargar tus datos guardados");
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [loadAll]);

  useEffect(() => {
    if (!syncOnFocus || typeof document === "undefined") return;

    let hiddenAt: number | null = null;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // Solo tras una ausencia real: así no se pisa un guardado que acaba de empezar.
      if (hiddenAt !== null && Date.now() - hiddenAt >= RESYNC_AFTER_HIDDEN_MS) {
        void reload().catch((error: unknown) =>
          console.error("[orgrow] No se pudo sincronizar al volver a la app", error),
        );
      }
      hiddenAt = null;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [syncOnFocus, reload]);

  /** Optimistic updates roll back to the saved truth when persistence fails. */
  const reportPersistError = useCallback(
    async (message: string, error: unknown) => {
      console.error(`[orgrow] ${message}`, error);
      toast.error(message);
      try {
        await reload();
      } catch (reloadError) {
        console.error("[orgrow] No se pudo recargar el estado", reloadError);
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

  const addHabit = useCallback(
    (input: NewHabitInput) => {
      const now = Date.now();
      const habit: Habit = {
        ...input,
        id: createId("h"),
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      setHabits((prev) => [...prev, habit]);
      void habitsRepo
        .create(habit)
        .catch((error: unknown) => reportPersistError("No se pudo guardar el hábito", error));
    },
    [habitsRepo, reportPersistError],
  );

  const editHabit = useCallback(
    (id: string, patch: HabitPatch) => {
      const habit = habits.find((item) => item.id === id);
      if (!habit) return;

      const { unit, ...rest } = patch;
      const updated: Habit = { ...habit, ...rest, updatedAt: Date.now() };
      if (unit !== undefined) updated.unit = unit ?? undefined;
      if (updated.kind !== "count") updated.unit = undefined;
      if (updated.kind === "check") {
        updated.target = 1;
        updated.step = 1;
      }

      setHabits((prev) => prev.map((item) => (item.id === id ? updated : item)));
      void habitsRepo
        .update(updated)
        .catch((error: unknown) => reportPersistError("No se pudo guardar el hábito", error));
    },
    [habits, habitsRepo, reportPersistError],
  );

  const deleteHabit = useCallback(
    (id: string) => {
      setHabits((prev) => prev.filter((habit) => habit.id !== id));
      setHabitLogs((prev) => prev.filter((log) => log.habitId !== id));
      void Promise.all([habitsRepo.remove(id), habitLogsRepo.removeForHabit(id)]).catch(
        (error: unknown) => reportPersistError("No se pudo eliminar el hábito", error),
      );
    },
    [habitsRepo, habitLogsRepo, reportPersistError],
  );

  const setHabitValue = useCallback(
    (habitId: string, date: string, value: number) => {
      const id = habitLogId(habitId, date);
      const amount = roundValue(value);

      if (amount <= 0) {
        setHabitLogs((prev) => prev.filter((log) => log.id !== id));
        void habitLogsRepo
          .remove(id)
          .catch((error: unknown) => reportPersistError("No se pudo guardar el progreso", error));
        return;
      }

      const log: HabitLog = { id, habitId, date, value: amount };
      setHabitLogs((prev) => [...prev.filter((item) => item.id !== id), log]);
      void habitLogsRepo
        .upsert(log)
        .catch((error: unknown) => reportPersistError("No se pudo guardar el progreso", error));
    },
    [habitLogsRepo, reportPersistError],
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

  const editNote = useCallback(
    (id: string, patch: NotePatch): boolean => {
      const note = notes.find((item) => item.id === id);
      if (!note) return false;

      const updated = applyNotePatch(note, patch);
      if (!updated) return false;

      setNotes((prev) => prev.map((item) => (item.id === id ? updated : item)));
      void notesRepo
        .update(updated)
        .catch((error: unknown) => reportPersistError("No se pudo guardar la nota", error));
      return true;
    },
    [notes, notesRepo, reportPersistError],
  );

  const togglePinNote = useCallback(
    (id: string) => {
      const note = notes.find((item) => item.id === id);
      if (note) editNote(id, { pinned: !note.pinned });
    },
    [notes, editNote],
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

  const openAddHabit = useCallback(() => {
    setHabitDialog({ open: true, mode: "create", habitId: null });
  }, []);

  const openEditHabit = useCallback((id: string) => {
    setHabitDialog({ open: true, mode: "edit", habitId: id });
  }, []);

  const setHabitDialogOpen = useCallback((open: boolean) => {
    setHabitDialog((prev) => ({ ...prev, open }));
  }, []);

  const value = useMemo<PlannerContextValue>(
    () => ({
      tasks,
      activities,
      notes,
      habits,
      habitLogs,
      isReady,
      reloadData: reload,
      toggleTask,
      addTask,
      editTask,
      deleteTask,
      addActivity,
      editActivity,
      deleteActivity,
      addHabit,
      editHabit,
      deleteHabit,
      setHabitValue,
      addNote,
      editNote,
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
      habitDialog,
      openAddHabit,
      openEditHabit,
      setHabitDialogOpen,
    }),
    [
      tasks,
      activities,
      notes,
      habits,
      habitLogs,
      isReady,
      reload,
      toggleTask,
      addTask,
      editTask,
      deleteTask,
      addActivity,
      editActivity,
      deleteActivity,
      addHabit,
      editHabit,
      deleteHabit,
      setHabitValue,
      addNote,
      editNote,
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
      habitDialog,
      openAddHabit,
      openEditHabit,
      setHabitDialogOpen,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}
