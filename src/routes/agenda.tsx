import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ListChecks, Plus } from "lucide-react";
import { useState } from "react";

import { ActivityList } from "@/components/agenda/activity-timeline";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { dayOffsetLabel, dayParts, isoFromOffset } from "@/lib/dates";
import { sortActivities } from "@/lib/planner";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Orgadia" },
      { name: "description", content: "Tu semana de un vistazo: actividades y tareas de cada día." },
      { property: "og:title", content: "Agenda — Orgadia" },
      { property: "og:description", content: "Tu semana de un vistazo: actividades y tareas de cada día." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

const WEEK = [0, 1, 2, 3, 4, 5, 6];

function AgendaPage() {
  const { activities, tasks, openAddTask } = usePlanner();
  const today = useToday();
  const [selected, setSelected] = useState(0);

  const dayActivities = sortActivities(activities.filter((a) => a.dayOffset === selected));
  const dayISO = isoFromOffset(selected, today);
  const dayTasks = dayISO ? tasks.filter((t) => t.dueDate === dayISO) : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader eyebrow="Próximos 7 días" title="Agenda" description="Elige un día para ver qué tienes planeado." />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:px-0">
        {WEEK.map((offset) => {
          const { weekday, day } = dayParts(offset, today);
          const count = activities.filter((a) => a.dayOffset === offset).length + tasks.filter((t) => t.dueDate === isoFromOffset(offset, today) && !t.completed).length;
          const active = selected === offset;
          return (
            <button
              key={offset}
              type="button"
              onClick={() => setSelected(offset)}
              aria-pressed={active}
              className={cn(
                "flex min-w-16 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-fab"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              <span className={cn("text-[11px] font-semibold", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {weekday}
              </span>
              <span className="text-xl font-bold tabular-nums">{day || "·"}</span>
              <span className="flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                  <span key={i} className={cn("size-1.5 rounded-full", active ? "bg-primary-foreground/70" : "bg-primary/50")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <SectionCard title={`Actividades · ${dayOffsetLabel(selected, today)}`} icon={<CalendarDays />}>
          {dayActivities.length ? (
            <ActivityList activities={dayActivities} />
          ) : (
            <EmptyState icon={<CalendarDays />} title="Día libre de actividades" description="Un buen momento para avanzar con tus notas pendientes." />
          )}
        </SectionCard>

        <SectionCard
          title="Tareas"
          icon={<ListChecks />}
          action={
            <Button variant="soft" size="sm" onClick={() => openAddTask(dayISO ?? undefined)}>
              <Plus /> Añadir
            </Button>
          }
        >
          <TaskList tasks={dayTasks} emptyTitle="Sin tareas este día" />
        </SectionCard>
      </div>
    </div>
  );
}
