import { Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/use-today";
import { formatLongDate, getGreeting } from "@/lib/dates";
import { useAuth } from "@/store/auth-store";
import { usePlanner } from "@/store/planner-store";

export function GreetingHeader() {
  const { openAddTask } = usePlanner();
  const { displayName } = useAuth();
  const today = useToday();

  return (
    <PageHeader
      eyebrow={
        <span className="inline-block min-h-[1em]">{today ? formatLongDate(today) : "\u00a0"}</span>
      }
      title={
        <>
          {today ? getGreeting(today.getHours()) : "Hola"},{" "}
          <em className="not-italic text-primary">{displayName}</em>
        </>
      }
      description="Esto es lo que tienes por delante hoy."
      actions={
        <Button onClick={() => openAddTask()} size="lg" className="hidden md:inline-flex">
          <Plus />
          Nueva tarea
        </Button>
      }
    />
  );
}
