import { AlertTriangle } from "lucide-react";

import { SectionCard } from "@/components/common/section-card";
import { TaskList } from "@/components/tasks/task-list";
import { useToday } from "@/hooks/use-today";
import { getOverdueTasks } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

/** Pending tasks whose date already passed. Hidden when there are none. */
export function OverdueTasks() {
  const { tasks } = usePlanner();
  const today = useToday();
  const overdue = getOverdueTasks(tasks, today);

  if (overdue.length === 0) return null;

  return (
    <SectionCard
      title={`Atrasadas · ${overdue.length}`}
      icon={<AlertTriangle />}
      className="border-priority-high/40"
    >
      <TaskList tasks={overdue} />
    </SectionCard>
  );
}
