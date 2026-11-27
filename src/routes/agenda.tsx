import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AgendaToolbar, type AgendaViewId } from "@/components/agenda/agenda-toolbar";
import { DayView } from "@/components/agenda/day-view";
import { MonthView } from "@/components/agenda/month-view";
import { WeekView } from "@/components/agenda/week-view";
import { PageHeader } from "@/components/common/page-header";
import { SpecialDatesCard } from "@/components/special-dates/special-dates-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSwipeNav } from "@/hooks/use-swipe-nav";
import { useToday } from "@/hooks/use-today";
import {
  longDateLabel,
  monthLabel,
  shiftISODate,
  shiftISOMonths,
  toISODate,
  weekDatesISO,
  weekLabel,
} from "@/lib/dates";
import { getActivitiesOn } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Orgrow" },
      { name: "description", content: "Tus actividades y tareas por día, semana o mes." },
      { property: "og:title", content: "Agenda — Orgrow" },
      { property: "og:description", content: "Tus actividades y tareas por día, semana o mes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { activities, tasks, specialDates, isReady, openAddActivity, openAddTask } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;

  const [view, setView] = useState<AgendaViewId>("mes");
  // Anchor is any date inside the visible day/week/month; null means "today".
  const [anchor, setAnchorState] = useState<string | null>(null);
  const anchorISO = anchor ?? todayISO;

  function goTo(dateISO: string) {
    setAnchorState(dateISO);
  }

  function selectDay(dateISO: string) {
    setAnchorState(dateISO);
    setView("dia");
  }

  function step(direction: 1 | -1) {
    if (!anchorISO) return;
    if (view === "dia") setAnchorState(shiftISODate(anchorISO, direction));
    else if (view === "semana") setAnchorState(shiftISODate(anchorISO, direction * 7));
    else setAnchorState(shiftISOMonths(anchorISO, direction));
  }

  const swipe = useSwipeNav(step);

  const weekDates = anchorISO ? weekDatesISO(anchorISO) : [];
  const isToday =
    view === "dia"
      ? anchorISO !== null && anchorISO === todayISO
      : view === "semana"
        ? todayISO !== null && weekDates.includes(todayISO)
        : anchorISO !== null && todayISO !== null && anchorISO.slice(0, 7) === todayISO.slice(0, 7);

  const label =
    view === "dia"
      ? anchorISO
        ? longDateLabel(anchorISO)
        : "Agenda"
      : view === "semana"
        ? anchorISO
          ? weekLabel(anchorISO)
          : "Esta semana"
        : anchorISO
          ? monthLabel(anchorISO)
          : "Este mes";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Planificación"
        title="Agenda"
        description="Tus actividades y tus tareas, por día, semana o mes."
        actions={
          <Button onClick={() => openAddActivity(anchorISO ?? undefined)}>
            <Plus /> Nueva actividad
          </Button>
        }
      />

      <AgendaToolbar
        label={label}
        view={view}
        onViewChange={setView}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => todayISO && goTo(todayISO)}
        isToday={isToday}
      />

      <div className="select-none space-y-6 sm:space-y-8" {...swipe}>
        {!isReady || !anchorISO ? (
          <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : view === "dia" ? (
          <DayView
            dateISO={anchorISO}
            label={longDateLabel(anchorISO)}
            activities={getActivitiesOn(activities, anchorISO)}
            tasks={tasks.filter((task) => task.dueDate === anchorISO)}
            onAddActivity={() => openAddActivity(anchorISO)}
            onAddTask={() => openAddTask(anchorISO)}
          />
        ) : view === "semana" ? (
          <WeekView
            dates={weekDates}
            activities={activities}
            tasks={tasks}
            todayISO={todayISO}
            onSelectDay={selectDay}
          />
        ) : (
          <MonthView
            anchorISO={anchorISO}
            activities={activities}
            specialDates={specialDates}
            tasks={tasks}
            todayISO={todayISO}
            onSelectDay={selectDay}
          />
        )}
      </div>

      <SpecialDatesCard variant="agenda" />
    </div>
  );
}
