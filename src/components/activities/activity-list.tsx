import { MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/categories";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Activity } from "@/types/planner";
import { CategoryBadge } from "@/components/tasks/category-badge";

/** One activity, same interaction model as `TaskItem`: click or pencil to edit. */
export function ActivityItem({ activity, showDate = false }: { activity: Activity; showDate?: boolean }) {
  const { openEditActivity, deleteActivity } = usePlanner();
  const category = CATEGORIES[activity.category];

  return (
    <li className="group flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-secondary/60 sm:px-3">
      <div className="w-12 shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-foreground">{activity.start}</p>
        {activity.end && (
          <p className="text-[11px] tabular-nums text-muted-foreground">{activity.end}</p>
        )}
      </div>

      <div className={cn("min-w-0 flex-1 rounded-xl border-l-[3px] px-3.5 py-2.5", category.bar, category.soft)}>
        <button
          type="button"
          onClick={() => openEditActivity(activity.id)}
          aria-label={`Editar "${activity.title}"`}
          className="block w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="line-clamp-2 text-sm font-semibold text-foreground">{activity.title}</span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {activity.location && (
            <span className={cn("inline-flex items-center gap-1 truncate font-medium", category.ink)}>
              <MapPin className="size-3 shrink-0" />
              {activity.location}
            </span>
          )}
          <CategoryBadge category={activity.category} />
          {showDate && <span className="text-muted-foreground">{activity.date}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Editar "${activity.title}"`}
          onClick={() => openEditActivity(activity.id)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar "${activity.title}"`}
          onClick={() => {
            deleteActivity(activity.id);
            toast("Actividad eliminada", { description: activity.title });
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function ActivityList({
  activities,
  showDate = false,
}: {
  activities: Activity[];
  showDate?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} showDate={showDate} />
      ))}
    </ul>
  );
}
