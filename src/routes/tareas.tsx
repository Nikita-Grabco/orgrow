import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/common/chip";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, CATEGORY_IDS } from "@/config/categories";
import { useToday } from "@/hooks/use-today";
import { getProgress, groupTasksByDate } from "@/lib/planner";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { CategoryId } from "@/types/planner";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — Calma" },
      { name: "description", content: "Todas tus tareas por día y categoría, con su progreso." },
      { property: "og:title", content: "Tareas — Calma" },
      { property: "og:description", content: "Todas tus tareas por día y categoría, con su progreso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { tasks, openAddTask, isReady } = usePlanner();
  const today = useToday();
  const [category, setCategory] = useState<CategoryId | "todas">("todas");
  const [showDone, setShowDone] = useState(true);

  const filtered = tasks.filter(
    (t) => (category === "todas" || t.category === category) && (showDone || !t.completed),
  );
  const groups = groupTasksByDate(filtered, today);
  const { pending } = getProgress(tasks);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Gestión"
        title="Tareas"
        description={isReady ? `Tienes ${pending} tareas pendientes en total.` : "Cargando tus tareas…"}
        actions={
          <Button onClick={() => openAddTask()} className="hidden md:inline-flex">
            <Plus /> Nueva tarea
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          <Chip selected={category === "todas"} onClick={() => setCategory("todas")}>
            Todas
          </Chip>
          {CATEGORY_IDS.map((id) => (
            <Chip key={id} selected={category === id} onClick={() => setCategory(id)}>
              <span className={cn("size-2 rounded-full", CATEGORIES[id].dot)} />
              {CATEGORIES[id].label}
            </Chip>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <Switch checked={showDone} onCheckedChange={setShowDone} />
          Mostrar completadas
        </label>
      </div>

      {!isReady ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Sin tareas con este filtro"
          description="Prueba con otra categoría o añade una tarea nueva."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
          {groups.map((group) => {
            const progress = getProgress(group.tasks);
            const overdue = group.tone === "overdue";
            return (
              <section key={group.key} className="surface p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2
                      className={cn(
                        "font-display font-semibold text-2xl leading-none",
                        overdue ? "text-priority-high" : "text-foreground",
                      )}
                    >
                      {group.label}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {progress.completed} de {progress.total} completadas
                    </p>
                  </div>
                  {!overdue && (
                    <Button
                      variant="soft"
                      size="icon-sm"
                      aria-label={`Añadir tarea a ${group.label}`}
                      onClick={() => openAddTask(group.key === "undated" ? null : group.key)}
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      overdue ? "bg-priority-high" : "bg-primary",
                    )}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <TaskList tasks={group.tasks} emptyTitle="Sin tareas con este filtro" />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
