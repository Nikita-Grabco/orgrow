import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { getOverdueTasks, getProgress, getProgressMessage, getTasksDueOn } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";
import { ProgressRing } from "./progress-ring";

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="truncate text-[11px] font-semibold sm:text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Daily summary: progress ring + counters. */
export function DayOverview() {
  const { tasks, isReady } = usePlanner();
  const today = useToday();

  const todayISO = today ? toISODate(today) : null;
  const todaysTasks = getTasksDueOn(tasks, todayISO);
  const { total, completed, pending, percent } = getProgress(todaysTasks);
  const overdue = getOverdueTasks(tasks, today).length;

  if (!isReady) {
    return <Skeleton className="h-56 rounded-2xl" />;
  }

  return (
    <section className="surface flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
      <ProgressRing value={percent}>
        <div>
          <p className="text-3xl font-bold tabular-nums text-foreground">{percent}%</p>
          <p className="text-[11px] font-semibold text-muted-foreground">completado</p>
        </div>
      </ProgressRing>
      <div className="w-full min-w-0 flex-1">
        <p className="eyebrow">Resumen del día</p>
        <h2 className="mt-1 font-display font-semibold text-3xl leading-tight text-foreground">
          {getProgressMessage(percent, total)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Has completado {completed} de {total} tareas de hoy.
          {overdue > 0 && (
            <span className="font-semibold text-priority-high">
              {" "}
              {overdue} atrasada{overdue === 1 ? "" : "s"}.
            </span>
          )}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Stat icon={<ListChecks />} label="Total" value={total} />
          <Stat icon={<CheckCircle2 />} label="Hechas" value={completed} />
          <Stat icon={<Circle />} label="Quedan" value={pending} />
        </div>
      </div>
    </section>
  );
}
