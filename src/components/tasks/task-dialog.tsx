import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_IDS, PRIORITIES, PRIORITY_IDS } from "@/config/categories";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { CategoryId, NewTaskInput, Priority, Task } from "@/types/planner";
import { TaskDatePicker } from "./task-date-picker";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

interface TaskFormProps {
  mode: "create" | "edit";
  task?: Task | undefined;
  initialDueDate: string | null;
  onSubmit: (input: NewTaskInput) => void;
}

/** The single form used for both creating and editing a task. */
function TaskForm({ mode, task, initialDueDate, onSubmit }: TaskFormProps) {
  const today = useToday();
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? initialDueDate);
  const [time, setTime] = useState(task?.time ?? "");
  const [category, setCategory] = useState<CategoryId>(task?.category ?? "personal");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "media");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    onSubmit({ title: clean, dueDate, time: time || undefined, category, priority });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="¿Qué necesitas hacer?"
        aria-label="Título de la tarea"
        className="h-12 rounded-xl text-base"
      />

      <Field label="Cuándo">
        <TaskDatePicker value={dueDate} onChange={setDueDate} today={today} />
      </Field>

      <Field label="Hora (opcional)">
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Hora"
          className="h-10 w-36 rounded-xl"
        />
      </Field>

      <Field label="Categoría">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_IDS.map((id) => (
            <Chip key={id} selected={category === id} onClick={() => setCategory(id)}>
              <span className={cn("size-2 rounded-full", CATEGORIES[id].dot)} />
              {CATEGORIES[id].label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Prioridad">
        <div className="flex flex-wrap gap-2">
          {PRIORITY_IDS.map((id) => (
            <Chip key={id} selected={priority === id} onClick={() => setPriority(id)}>
              <span className={cn("size-2 rounded-full", PRIORITIES[id].dot)} />
              {PRIORITIES[id].label}
            </Chip>
          ))}
        </div>
      </Field>

      <DialogFooter className="gap-2 pt-2 sm:gap-2">
        <Button type="submit" disabled={!title.trim()}>
          {mode === "edit" ? "Guardar cambios" : "Añadir tarea"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TaskDialog() {
  const { tasks, addTask, editTask, addTaskDialog, setAddTaskOpen } = usePlanner();
  const { open, mode, taskId, dueDate } = addTaskDialog;
  const editingTask = mode === "edit" ? tasks.find((task) => task.id === taskId) : undefined;

  // Closing should always work, even for a form that failed to render.
  useEffect(() => {
    if (open && mode === "edit" && !editingTask) setAddTaskOpen(false);
  }, [open, mode, editingTask, setAddTaskOpen]);

  function handleSubmit(input: NewTaskInput) {
    if (mode === "edit" && editingTask) {
      editTask(editingTask.id, input);
      toast.success("Tarea actualizada", { description: input.title });
    } else {
      addTask(input);
      toast.success("Tarea añadida", { description: input.title });
    }
    setAddTaskOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setAddTaskOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">
            {mode === "edit" ? "Editar tarea" : "Nueva tarea"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Cambia lo que necesites y guarda los cambios."
              : "Apunta lo que quieres hacer y cuándo."}
          </DialogDescription>
        </DialogHeader>

        <TaskForm
          key={`${mode}:${taskId ?? "new"}:${dueDate ?? "none"}`}
          mode={mode}
          task={editingTask}
          initialDueDate={dueDate}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
