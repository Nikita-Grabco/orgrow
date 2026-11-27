import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { SpecialDateDialog } from "@/components/special-dates/special-date-dialog";
import { HabitDialog } from "@/components/habits/habit-dialog";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { AppSidebar } from "./app-sidebar";
import { Brand } from "./brand";
import { ConnectionBanner } from "./connection-banner";
import { MobileNav } from "./mobile-nav";
import { UserAvatar } from "./user-avatar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <div className="md:pl-20 lg:pl-64">
        <ConnectionBanner />
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
          <div className="flex items-center gap-0.5">
            <Link
              to="/ajustes"
              aria-label="Ajustes"
              title="Ajustes"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserAvatar />
            </Link>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-6 sm:px-8 md:pb-12 md:pt-10 lg:px-12">
          {children}
        </main>
      </div>

      <MobileNav />
      <TaskDialog />
      <ActivityDialog />
      <SpecialDateDialog />
      <GoalDialog />
      <HabitDialog />
    </div>
  );
}
