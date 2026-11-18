import { CalendarDays, ListChecks, Plus } from "lucide-react";

import { ActivityList } from "@/components/activities/activity-list";
import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import type { Activity, Task } from "@/types/planner";

interface DayViewProps {
  dateISO: string | null;
  label: string;
  activities: Activity[];
  tasks: Task[];
  onAddActivity: () => void;
  onAddTask: () => void;
}

/** A single day: activities on one side, tasks on the other. */
export function DayView({ dateISO, label, activities, tasks, onAddActivity, onAddTask }: DayViewProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
      <SectionCard
        title={`Actividades · ${label}`}
        icon={<CalendarDays />}
        action={
          <Button variant="soft" size="sm" disabled={!dateISO} onClick={onAddActivity}>
            <Plus /> Añadir
          </Button>
        }
      >
        {activities.length > 0 ? (
          <ActivityList activities={activities} />
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title="Día libre de actividades"
            description="Añade una cita o aprovecha para avanzar con tus tareas."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Tareas"
        icon={<ListChecks />}
        action={
          <Button variant="soft" size="sm" disabled={!dateISO} onClick={onAddTask}>
            <Plus /> Añadir
          </Button>
        }
      >
        <TaskList tasks={tasks} emptyTitle="Sin tareas este día" />
      </SectionCard>
    </div>
  );
}
