import { createFileRoute } from "@tanstack/react-router";

import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { NextUpCard } from "@/components/dashboard/next-up-card";
import { OverdueTasks } from "@/components/dashboard/overdue-tasks";
import { TodayHabits } from "@/components/dashboard/today-habits";
import { TodayTasks } from "@/components/dashboard/today-tasks";
import { InstallCard } from "@/components/pwa/install-card";
import { NotificationsCard } from "@/components/pwa/notifications-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orgrow — Tu día, organizado" },
      {
        name: "description",
        content:
          "Organiza tu día: tareas, progreso diario, próximas actividades y notas en un solo lugar.",
      },
      { property: "og:title", content: "Orgrow — Tu día, organizado" },
      {
        property: "og:description",
        content: "Tareas, progreso diario, próximas actividades y notas en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <GreetingHeader />

      <InstallCard />

      <NotificationsCard />

      <CalendarPanel />

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayTasks />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <NextUpCard />
          <TodayHabits />
          <OverdueTasks />
        </div>
      </div>
    </div>
  );
}
