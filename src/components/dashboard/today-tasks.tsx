import { ListChecks, Plus } from "lucide-react";

import { SectionCard } from "@/components/common/section-card";
import { TaskList } from "@/components/tasks/task-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { getProgress, getProgressMessage, getTasksDueOn } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";
import { ProgressRing } from "./progress-ring";

/** Today's tasks with the completed percentage. */
export function TodayTasks() {
  const { tasks, openAddTask, isReady } = usePlanner();
  const today = useToday();

  const todaysTasks = getTasksDueOn(tasks, today ? toISODate(today) : null);
  const { total, completed, pending, percent } = getProgress(todaysTasks);

  return (
    <SectionCard title="Tareas de hoy" icon={<ListChecks />}>
      {!isReady ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4">
            <ProgressRing value={percent} size={88} stroke={9}>
              <p className="text-xl font-bold tabular-nums text-foreground">{percent}%</p>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {getProgressMessage(percent, total)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {completed} de {total} hechas
                {pending > 0 && ` · quedan ${pending}`}
              </p>
            </div>
          </div>

          <TaskList
            tasks={todaysTasks}
            emptyTitle="Sin tareas para hoy"
            emptyDescription="Añade una o disfruta del día."
          />

          <button
            type="button"
            onClick={() => openAddTask()}
            className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
          >
            <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-primary">
              <Plus className="size-3.5" />
            </span>
            Añadir tarea para hoy
          </button>
        </>
      )}
    </SectionCard>
  );
}
