import type { ReactNode } from "react";

import { TaskDialog } from "@/components/tasks/task-dialog";
import { AppSidebar } from "./app-sidebar";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { UserAvatar } from "./user-avatar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <div className="md:pl-20 lg:pl-64">
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
          <UserAvatar />
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-6 sm:px-8 md:pb-12 md:pt-10 lg:px-12">
          {children}
        </main>
      </div>

      <MobileNav />
      <TaskDialog />
    </div>
  );
}
