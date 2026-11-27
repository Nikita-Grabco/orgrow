import { Target } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { GoalCard } from "@/components/goals/goal-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { splitGoals, type GoalContext } from "@/lib/goals";
import { indexLogs } from "@/lib/habits";
import { usePlanner } from "@/store/planner-store";

export function GoalsView() {
  const { goals, tasks, habits, habitLogs, isReady } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;

  const index = useMemo(() => indexLogs(habitLogs), [habitLogs]);
  const { active, achieved } = useMemo(() => splitGoals([...goals]), [goals]);

  if (!isReady || !todayISO) {
    return (
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  const context: GoalContext = { tasks, habits, index, todayISO };

  if (goals.length === 0) {
    return (
      <EmptyState
        icon={<Target />}
        title="Todavía no tienes objetivos"
        description="Crea uno grande (aprender inglés, correr 10 km…) y divídelo en hitos."
      />
    );
  }

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
          {active.map((goal) => (
            <GoalCard key={goal.id} goal={goal} context={context} />
          ))}
        </div>
      )}
      {achieved.length > 0 && (
        <section className="space-y-4">
          <p className="eyebrow">Logrados</p>
          <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
            {achieved.map((goal) => (
              <GoalCard key={goal.id} goal={goal} context={context} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
