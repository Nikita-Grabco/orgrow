import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/common/chip";
import { SectionCard } from "@/components/common/section-card";
import { TaskList } from "@/components/tasks/task-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { getOverdueTasks, getTasksDueOn } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

type Filter = "pendientes" | "hechas" | "todas";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pendientes", label: "Pendientes" },
  { id: "hechas", label: "Hechas" },
  { id: "todas", label: "Todas" },
];

export function TodayTasks() {
  const { tasks, openAddTask, isReady } = usePlanner();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("pendientes");

  const todayISO = today ? toISODate(today) : null;
  // Pending overdue tasks stay visible on the dashboard so they don't get lost.
  const todaysTasks = [...getOverdueTasks(tasks, today), ...getTasksDueOn(tasks, todayISO)];
  const visible = todaysTasks.filter((t) =>
    filter === "todas" ? true : filter === "hechas" ? t.completed : !t.completed,
  );

  return (
    <SectionCard title="Tareas de hoy" icon={<ListChecks />}>
      {!isReady ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : (
        <>
          <div className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
                <span className="tabular-nums opacity-70">
                  {f.id === "todas"
                    ? todaysTasks.length
                    : todaysTasks.filter((t) => (f.id === "hechas" ? t.completed : !t.completed))
                        .length}
                </span>
              </Chip>
            ))}
          </div>

          <TaskList
            tasks={visible}
            emptyTitle={filter === "pendientes" ? "¡Todo hecho por hoy!" : "Aún no has completado nada"}
            emptyDescription={
              filter === "pendientes"
                ? "Tómate un respiro, te lo has ganado."
                : "Marca una tarea para verla aquí."
            }
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
