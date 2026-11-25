import { CalendarClock, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PRIORITIES } from "@/config/categories";
import { useToday } from "@/hooks/use-today";
import { dueDateLabel, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Task } from "@/types/planner";
import { CategoryBadge } from "./category-badge";
import { TaskCheck } from "./task-check";

export function TaskItem({ task }: { task: Task }) {
  const { toggleTask, deleteTask, openEditTask } = usePlanner();
  const today = useToday();
  const priority = PRIORITIES[task.priority];
  const overdue = isOverdue(task.dueDate, task.completed, today);
  const dueLabel = task.dueDate ? dueDateLabel(task.dueDate, today) : null;

  return (
    <li
      className={cn(
        "group flex items-center gap-3.5 rounded-2xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-secondary/60 sm:px-4",
        task.completed && "opacity-70",
      )}
    >
      <TaskCheck
        checked={task.completed}
        onToggle={() => toggleTask(task.id)}
        label={
          task.completed ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`
        }
      />

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openEditTask(task.id)}
          aria-label={`Editar "${task.title}"`}
          className="block w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            className={cn(
              "line-clamp-2 text-sm font-semibold text-foreground transition-colors",
              task.completed && "text-muted-foreground line-through decoration-muted-foreground/50",
            )}
          >
            {task.title}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {task.time}
            </span>
          )}
          {dueLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-semibold text-priority-high",
              )}
            >
              <CalendarClock className="size-3" />
              {overdue ? `Atrasada · ${dueLabel}` : dueLabel}
            </span>
          )}
          <CategoryBadge category={task.category} />
          <span
            className="inline-flex items-center gap-1"
            title={`Prioridad ${priority.label.toLowerCase()}`}
          >
            <span className={cn("size-1.5 rounded-full", priority.dot)} />
            <span className="hidden sm:inline">{priority.label}</span>
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Editar "${task.title}"`}
          onClick={() => openEditTask(task.id)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar "${task.title}"`}
          onClick={() => {
            deleteTask(task.id);
            toast("Tarea eliminada", { description: task.title });
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
