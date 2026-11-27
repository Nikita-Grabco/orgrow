import { Check, CircleCheck, Pencil, RotateCcw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/categories";
import {
  daysLeftLabel,
  goalDaysLeft,
  goalProgress,
  milestoneState,
  type GoalContext,
} from "@/lib/goals";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Goal } from "@/types/planner";

interface GoalCardProps {
  goal: Goal;
  context: GoalContext;
}

export function GoalCard({ goal, context }: GoalCardProps) {
  const { editGoal, openEditGoal } = usePlanner();
  const category = CATEGORIES[goal.category];
  const progress = goalProgress(goal, context);
  const achieved = goal.achievedAt !== null;
  const daysLeft = goalDaysLeft(goal, context.todayISO);
  const overdue = !achieved && daysLeft !== null && daysLeft < 0;

  function toggleManual(id: string) {
    editGoal(goal.id, {
      milestones: goal.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
    });
  }

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className={cn("size-2 rounded-full", category.dot)} />
            {category.label}
            {achieved && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Trophy className="size-3" /> Logrado
              </span>
            )}
          </div>
          <h3 className="break-words font-display text-lg font-semibold leading-snug text-foreground">
            {goal.title}
          </h3>
          {!achieved && daysLeft !== null && (
            <p
              className={cn(
                "text-xs font-semibold",
                overdue ? "text-priority-high" : "text-muted-foreground",
              )}
            >
              {daysLeftLabel(daysLeft)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openEditGoal(goal.id)}
          aria-label={`Editar ${goal.title}`}
          className="size-9 shrink-0"
        >
          <Pencil />
        </Button>
      </header>

      {progress.total > 0 && (
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso de ${goal.title}`}
            className="h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-xs font-semibold tabular-nums text-muted-foreground">
            {progress.done} de {progress.total} hitos · {progress.percent}%
          </p>
        </div>
      )}

      {goal.milestones.length > 0 && (
        <ul className="space-y-1.5">
          {goal.milestones.map((milestone) => {
            const state = milestoneState(milestone, goal, context);
            const manual = !milestone.link || state.broken;
            return (
              <li key={milestone.id} className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!manual || achieved}
                  onClick={() => toggleManual(milestone.id)}
                  aria-label={`${state.done ? "Desmarcar" : "Marcar"} ${milestone.title}`}
                  aria-pressed={state.done}
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                    manual && !achieved ? "cursor-pointer hover:border-primary" : "cursor-default",
                  )}
                >
                  {state.done && <Check className="size-3" />}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words text-sm",
                    state.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {milestone.title}
                </span>
                {state.detail && (
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {state.detail}
                  </span>
                )}
                {state.broken && (
                  <span className="shrink-0 text-xs text-muted-foreground">enlace perdido</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        {achieved ? (
          <Button variant="ghost" size="sm" onClick={() => editGoal(goal.id, { achievedAt: null })}>
            <RotateCcw /> Reabrir
          </Button>
        ) : (
          <Button
            variant={progress.total > 0 && progress.percent === 100 ? "default" : "outline"}
            size="sm"
            onClick={() => editGoal(goal.id, { achievedAt: Date.now() })}
          >
            <CircleCheck /> Marcar como logrado
          </Button>
        )}
      </div>
    </article>
  );
}
