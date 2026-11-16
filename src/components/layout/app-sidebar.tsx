import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/config/navigation";
import { useAuth } from "@/store/auth-store";
import { usePlanner } from "@/store/planner-store";
import { Brand } from "./brand";
import { UserAvatar } from "./user-avatar";

/** Icon rail on tablet (md), full sidebar on desktop (lg+). Hidden on mobile. */
export function AppSidebar() {
  const { openAddTask } = usePlanner();
  const { displayName } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 md:flex lg:w-64 lg:px-5">
      <div className="flex justify-center lg:justify-start lg:px-2">
        <Brand className="lg:hidden" compact />
        <Brand className="hidden lg:flex" />
      </div>

      <nav className="mt-10 flex flex-col gap-1" aria-label="Principal">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            title={item.label}
            className="group flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary lg:justify-start"
          >
            <item.icon className="size-5 shrink-0" strokeWidth={1.9} />
            <span className="hidden lg:inline">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <Button onClick={() => openAddTask()} className="w-full px-0 lg:px-4" aria-label="Nueva tarea">
          <Plus />
          <span className="hidden lg:inline">Nueva tarea</span>
        </Button>
      </div>

      <div className="mt-auto flex items-center justify-center gap-3 rounded-2xl lg:justify-start lg:border lg:border-sidebar-border lg:bg-card lg:p-3">
        <UserAvatar />
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">Organización personal</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
