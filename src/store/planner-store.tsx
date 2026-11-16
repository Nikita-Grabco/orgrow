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

import { sampleActivities } from "@/data/sample-data";
import { toISODate } from "@/lib/dates";
import { applyTaskPatch, createId } from "@/lib/planner";
import { createLocalNotesRepository } from "@/services/notes-repository";
import { createLocalTasksRepository } from "@/services/tasks-repository";
import type {
  Activity,
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
interface AddTaskDialogState {
  open: boolean;
  mode: "create" | "edit";
  taskId: string | null;
  dueDate: string | null;
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
  addNote: (input: NewNoteInput) => void;
  togglePinNote: (id: string) => void;
  deleteNote: (id: string) => void;
  convertNoteToTask: (id: string) => void;
  addTaskDialog: AddTaskDialogState;
  /** Omit for today; pass `null` to open the dialog without a date. */
  openAddTask: (dueDate?: string | null) => void;
  openEditTask: (id: string) => void;
  setAddTaskOpen: (open: boolean) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

const CLOSED_DIALOG: AddTaskDialogState = {
  open: false,
  mode: "create",
  taskId: null,
  dueDate: null,
};

export function PlannerProvider({ children }: { children: ReactNode }) {
  const tasksRepo = useMemo(createLocalTasksRepository, []);
  const notesRepo = useMemo(createLocalNotesRepository, []);

  // Empty until hydrated: the server never reads localStorage, so the first
  // client render matches the server HTML and avoids hydration mismatches.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities] = useState<Activity[]>(sampleActivities);
  const [isReady, setIsReady] = useState(false);
  const [addTaskDialog, setAddTaskDialog] = useState<AddTaskDialogState>(CLOSED_DIALOG);

  const reload = useCallback(async () => {
    const [nextTasks, nextNotes] = await Promise.all([tasksRepo.list(), notesRepo.list()]);
    setTasks(nextTasks);
    setNotes(nextNotes);
  }, [tasksRepo, notesRepo]);

  useEffect(() => {
    let active = true;

    Promise.all([tasksRepo.list(), notesRepo.list()])
      .then(([nextTasks, nextNotes]) => {
        if (!active) return;
        setTasks(nextTasks);
        setNotes(nextNotes);
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
  }, [tasksRepo, notesRepo]);

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
    setAddTaskDialog({
      open: true,
      mode: "create",
      taskId: null,
      dueDate: dueDate === undefined ? toISODate(new Date()) : dueDate,
    });
  }, []);

  const openEditTask = useCallback((id: string) => {
    setAddTaskDialog({ open: true, mode: "edit", taskId: id, dueDate: null });
  }, []);

  const setAddTaskOpen = useCallback((open: boolean) => {
    setAddTaskDialog((prev) => ({ ...prev, open }));
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
      addNote,
      togglePinNote,
      deleteNote,
      convertNoteToTask,
      addTaskDialog,
      openAddTask,
      openEditTask,
      setAddTaskOpen,
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
      addNote,
      togglePinNote,
      deleteNote,
      convertNoteToTask,
      addTaskDialog,
      openAddTask,
      openEditTask,
      setAddTaskOpen,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}
