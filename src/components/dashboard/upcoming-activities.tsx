import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";

import { ActivityList } from "@/components/activities/activity-list";
import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { useToday } from "@/hooks/use-today";
import { currentTimeString, dueDateLabel, toISODate } from "@/lib/dates";
import { getUpcomingActivities, groupActivitiesByDate } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

export function UpcomingActivities({ limit = 5 }: { limit?: number }) {
  const { activities } = usePlanner();
  const today = useToday();
  const upcoming = getUpcomingActivities(
    activities,
    today ? toISODate(today) : null,
    today ? currentTimeString(today) : null,
  ).slice(0, limit);
  const groups = groupActivitiesByDate(upcoming);

  return (
    <SectionCard
      title="Próximas actividades"
      icon={<CalendarDays />}
      action={
        <Link
          to="/agenda"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Agenda <ArrowRight className="size-3" />
        </Link>
      }
    >
      {groups.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="Sin actividades próximas" />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.date}>
              <p className="eyebrow mb-2.5">{dueDateLabel(group.date, today)}</p>
              <ActivityList activities={group.activities} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
