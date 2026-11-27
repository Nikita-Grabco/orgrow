import { Link } from "@tanstack/react-router";
import { ArrowRight, Target } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { daysLeftLabel, goalDaysLeft, goalProgress, splitGoals } from "@/lib/goals";
import { indexLogs } from "@/lib/habits";
import { usePlanner } from "@/store/planner-store";

const MAX_SHOWN = 3;

/** Los objetivos activos más cercanos, con su progreso. */
export function GoalsCard() {
  const { goals, tasks, habits, habitLogs } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;
  const index = useMemo(() => indexLogs(habitLogs), [habitLogs]);
  const { active } = useMemo(() => splitGoals([...goals]), [goals]);

  if (!todayISO) return null;
  const shown = active.slice(0, MAX_SHOWN);

  return (
    <SectionCard
      title="Objetivos"
      icon={<Target />}
      action={
        <Link
          to="/productividad"
          search={{ vista: "objetivos" }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver todos <ArrowRight className="size-3" />
        </Link>
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title="Sin objetivos activos"
          description="Crea uno desde el + o en Productividad."
        />
      ) : (
        <ul className="space-y-4">
          {shown.map((goal) => {
            const progress = goalProgress(goal, { tasks, habits, index, todayISO });
            const daysLeft = goalDaysLeft(goal, todayISO);
            return (
              <li key={goal.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold text-foreground">{goal.title}</p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {progress.percent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso de ${goal.title}`}
                  className="h-1.5 overflow-hidden rounded-full bg-secondary"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                {daysLeft !== null && (
                  <p className="text-xs text-muted-foreground">{daysLeftLabel(daysLeft)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
