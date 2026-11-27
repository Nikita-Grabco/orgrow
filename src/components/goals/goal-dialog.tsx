import { Plus, Trash2, X } from "lucide-react";
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
import { CATEGORIES, CATEGORY_IDS } from "@/config/categories";
import { MAX_MILESTONE_DAYS, MAX_MILESTONES, newMilestone } from "@/lib/goals";
import { usePlanner } from "@/store/planner-store";
import type {
  CategoryId,
  Goal,
  Habit,
  Milestone,
  MilestoneLink,
  NewGoalInput,
  Task,
} from "@/types/planner";

type LinkKind = "none" | "task" | "habit";

const SELECT_CLASS =
  "h-9 min-w-0 rounded-xl border border-input bg-card px-2 text-sm text-foreground";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

function linkKind(link: MilestoneLink | undefined): LinkKind {
  return link ? link.type : "none";
}

interface RowProps {
  milestone: Milestone;
  tasks: Task[];
  habits: Habit[];
  onChange: (next: Milestone) => void;
  onRemove: () => void;
}

function MilestoneRow({ milestone, tasks, habits, onChange, onRemove }: RowProps) {
  const kind = linkKind(milestone.link);
  const taskLink = milestone.link?.type === "task" ? milestone.link.taskId : "";
  const habitLink = milestone.link?.type === "habit" ? milestone.link.habitId : "";

  function setKind(next: LinkKind) {
    const { link: _old, ...rest } = milestone;
    if (next === "task") {
      const first = tasks[0];
      onChange(first ? { ...rest, link: { type: "task", taskId: first.id } } : rest);
    } else if (next === "habit") {
      const first = habits[0];
      onChange(first ? { ...rest, link: { type: "habit", habitId: first.id, days: 30 } } : rest);
    } else {
      onChange(rest);
    }
  }

  return (
    <li className="space-y-2 rounded-2xl bg-secondary p-3">
      <div className="flex items-center gap-2">
        <Input
          value={milestone.title}
          onChange={(event) => onChange({ ...milestone, title: event.target.value })}
          placeholder="Hito (p. ej. Ahorrar 500 €)"
          aria-label="Título del hito"
          maxLength={120}
          className="h-9 rounded-xl"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Quitar hito"
          className="size-9 shrink-0"
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as LinkKind)}
          aria-label="Cómo se completa"
          className={SELECT_CLASS}
        >
          <option value="none">Lo marco yo</option>
          <option value="task" disabled={tasks.length === 0}>
            Al completar una tarea
          </option>
          <option value="habit" disabled={habits.length === 0}>
            Al cumplir un hábito N días
          </option>
        </select>

        {milestone.link?.type === "task" && (
          <select
            value={milestone.link.taskId}
            onChange={(event) =>
              onChange({ ...milestone, link: { type: "task", taskId: event.target.value } })
            }
            aria-label="Tarea"
            className={`${SELECT_CLASS} max-w-full flex-1`}
          >
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
            {!tasks.some((task) => task.id === taskLink) && (
              <option value={taskLink}>(tarea eliminada)</option>
            )}
          </select>
        )}

        {milestone.link?.type === "habit" && (
          <>
            <select
              value={milestone.link.habitId}
              onChange={(event) =>
                milestone.link?.type === "habit" &&
                onChange({
                  ...milestone,
                  link: { ...milestone.link, habitId: event.target.value },
                })
              }
              aria-label="Hábito"
              className={`${SELECT_CLASS} max-w-full flex-1`}
            >
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.name}
                </option>
              ))}
              {!habits.some((habit) => habit.id === habitLink) && (
                <option value={habitLink}>(hábito eliminado)</option>
              )}
            </select>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_MILESTONE_DAYS}
              value={milestone.link.days}
              onChange={(event) => {
                const days = Math.min(
                  MAX_MILESTONE_DAYS,
                  Math.max(1, Math.round(Number(event.target.value)) || 1),
                );
                if (milestone.link?.type === "habit") {
                  onChange({ ...milestone, link: { ...milestone.link, days } });
                }
              }}
              aria-label="Días"
              className="h-9 w-20 rounded-xl"
            />
            <span className="text-xs text-muted-foreground">días</span>
          </>
        )}
      </div>
    </li>
  );
}

interface FormProps {
  mode: "create" | "edit";
  goal?: Goal | undefined;
  onSubmit: (input: NewGoalInput) => void;
  onDelete?: (() => void) | undefined;
}

function GoalForm({ mode, goal, onSubmit, onDelete }: FormProps) {
  const { tasks, habits } = usePlanner();
  const activeHabits = habits.filter((habit) => !habit.archived);

  const [title, setTitle] = useState(goal?.title ?? "");
  const [category, setCategory] = useState<CategoryId>(goal?.category ?? "personal");
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? "");
  const [milestones, setMilestones] = useState<Milestone[]>(goal?.milestones ?? []);

  // Los hitos ya enlazados siguen eligiendo su tarea aunque esté completada.
  const linkedTaskIds = new Set(
    milestones.flatMap((m) => (m.link?.type === "task" ? [m.link.taskId] : [])),
  );
  const taskOptions = tasks.filter((task) => !task.completed || linkedTaskIds.has(task.id));

  function update(index: number, next: Milestone) {
    setMilestones((prev) => prev.map((item, i) => (i === index ? next : item)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onSubmit({
      title: cleanTitle,
      category,
      dueDate: dueDate || null,
      milestones: milestones
        .map((m) => ({ ...m, title: m.title.trim() }))
        .filter((m) => m.title.length > 0),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="¿Qué quieres conseguir?"
        aria-label="Objetivo"
        maxLength={120}
        className="h-12 rounded-xl text-base"
      />

      <Field label="Categoría">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_IDS.map((id) => (
            <Chip key={id} selected={category === id} onClick={() => setCategory(id)}>
              <span className={`size-2 rounded-full ${CATEGORIES[id].dot}`} />
              {CATEGORIES[id].label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Fecha límite (opcional)">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="Fecha límite"
            className="h-10 w-44 rounded-xl"
          />
          {dueDate && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDueDate("")}>
              Quitar
            </Button>
          )}
        </div>
      </Field>

      <Field label="Hitos">
        {milestones.length > 0 && (
          <ul className="space-y-2">
            {milestones.map((milestone, index) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                tasks={taskOptions}
                habits={activeHabits}
                onChange={(next) => update(index, next)}
                onRemove={() => setMilestones((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        )}
        {milestones.length < MAX_MILESTONES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMilestones((prev) => [...prev, newMilestone()])}
          >
            <Plus /> Añadir hito
          </Button>
        )}
      </Field>

      <DialogFooter className="gap-2 pt-2 sm:gap-2">
        {mode === "edit" && onDelete && (
          <Button type="button" variant="ghost" onClick={onDelete} className="sm:mr-auto">
            <Trash2 /> Eliminar
          </Button>
        )}
        <Button type="submit" disabled={!title.trim()}>
          {mode === "edit" ? "Guardar cambios" : "Crear objetivo"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GoalDialog() {
  const { goals, addGoal, editGoal, deleteGoal, goalDialog, setGoalDialogOpen } = usePlanner();
  const { open, mode, goalId } = goalDialog;
  const editing = mode === "edit" ? goals.find((item) => item.id === goalId) : undefined;

  useEffect(() => {
    if (open && mode === "edit" && !editing) setGoalDialogOpen(false);
  }, [open, mode, editing, setGoalDialogOpen]);

  function handleSubmit(input: NewGoalInput) {
    if (mode === "edit" && editing) {
      editGoal(editing.id, input);
      toast.success("Objetivo actualizado", { description: input.title });
    } else {
      addGoal(input);
      toast.success("Objetivo creado", { description: input.title });
    }
    setGoalDialogOpen(false);
  }

  function handleDelete() {
    if (!editing) return;
    deleteGoal(editing.id);
    toast.success("Objetivo eliminado", { description: editing.title });
    setGoalDialogOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setGoalDialogOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">
            {mode === "edit" ? "Editar objetivo" : "Nuevo objetivo"}
          </DialogTitle>
          <DialogDescription>
            Divídelo en hitos; pueden completarse solos con una tarea o un hábito.
          </DialogDescription>
        </DialogHeader>

        <GoalForm
          key={`${mode}:${goalId ?? "new"}`}
          mode={mode}
          goal={editing}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
