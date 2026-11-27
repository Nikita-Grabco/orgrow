import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/common/chip";
import { EmptyState } from "@/components/common/empty-state";
import { HabitCard } from "@/components/habits/habit-card";
import { HabitRing } from "@/components/habits/habit-ring";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { longDateLabel, shiftISODate, toISODate } from "@/lib/dates";
import { indexLogs } from "@/lib/habits";
import { usePlanner } from "@/store/planner-store";

export function HabitsView() {
  const { habits, habitLogs, isReady } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;

  // null means "today"; the user can step back to log a day they forgot.
  const [selected, setSelected] = useState<string | null>(null);
  const dateISO = selected ?? todayISO;
  const isToday = dateISO !== null && dateISO === todayISO;

  const [view, setView] = useState<"hoy" | "progreso">("hoy");

  const index = useMemo(() => indexLogs(habitLogs), [habitLogs]);
  const visible = habits
    .filter((habit) => !habit.archived)
    .sort((a, b) => a.createdAt - b.createdAt);

  function goTo(next: string) {
    if (!todayISO) return;
    setSelected(next >= todayISO ? null : next);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex gap-2">
        <Chip selected={view === "hoy"} onClick={() => setView("hoy")}>
          Hoy
        </Chip>
        <Chip selected={view === "progreso"} onClick={() => setView("progreso")}>
          Progreso del mes
        </Chip>
      </div>

      {view === "hoy" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => dateISO && goTo(shiftISODate(dateISO, -1))}
            disabled={!dateISO}
            aria-label="Día anterior"
            className="size-9 rounded-full"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => dateISO && goTo(shiftISODate(dateISO, 1))}
            disabled={!dateISO || isToday}
            aria-label="Día siguiente"
            className="size-9 rounded-full"
          >
            <ChevronRight />
          </Button>
          <p className="px-1 text-sm font-bold text-foreground">
            {dateISO ? (isToday ? `Hoy · ${longDateLabel(dateISO)}` : longDateLabel(dateISO)) : " "}
          </p>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Volver a hoy
            </Button>
          )}
        </div>
      )}

      {!isReady || !dateISO || !todayISO ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : view === "progreso" ? (
        <HabitRing habits={visible} logs={habitLogs} todayISO={todayISO} />
      ) : visible.length ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
          {visible.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              index={index}
              dateISO={dateISO}
              todayISO={todayISO}
              onSelectDay={goTo}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Repeat />}
          title="Todavía no tienes hábitos"
          description="Crea el primero: ir al gimnasio, leer, beber agua…"
        />
      )}
    </div>
  );
}
