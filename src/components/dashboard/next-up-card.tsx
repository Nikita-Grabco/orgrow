import { Clock, MapPin, Sparkles } from "lucide-react";

import { CategoryBadge } from "@/components/tasks/category-badge";
import { useToday } from "@/hooks/use-today";
import {
  currentTimeString,
  dueDateLabel,
  formatCountdown,
  minutesUntil,
  toISODate,
} from "@/lib/dates";
import { getUpcomingActivities } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

/** Highlights the very next activity, with a countdown. */
export function NextUpCard() {
  const { activities } = usePlanner();
  const today = useToday();
  const next = getUpcomingActivities(
    activities,
    today ? toISODate(today) : null,
    today ? currentTimeString(today) : null,
  )[0];
  const countdown =
    next && today ? formatCountdown(minutesUntil(next.date, next.start, today)) : null;

  return (
    <section className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-hero p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Siguiente evento</p>
        <Sparkles className="size-4 text-primary" />
      </div>
      {next ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-primary">
            {dueDateLabel(next.date, today)} · {next.start}
            {countdown && <span className="text-muted-foreground"> · {countdown}</span>}
          </p>
          <h3 className="mt-1 font-display font-semibold text-2xl leading-tight text-foreground">
            {next.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
            {next.end && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {next.start} – {next.end}
              </span>
            )}
            {next.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {next.location}
              </span>
            )}
            <CategoryBadge category={next.category} />
          </div>
        </div>
      ) : (
        <p className="mt-4 font-display font-semibold text-xl text-foreground">
          Sin más actividades. Disfruta.
        </p>
      )}
    </section>
  );
}
