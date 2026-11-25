import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_ITEMS, type NavItem } from "@/config/navigation";
import { usePlanner } from "@/store/planner-store";

function MobileNavLink({ item }: { item: NavItem }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      className="group flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
    >
      <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[status=active]:bg-primary-soft">
        <item.icon className="size-5" strokeWidth={1.9} />
      </span>
      {item.label}
    </Link>
  );
}

/** Bottom bar for phones with a central add button. */
export function MobileNav() {
  const { openAddTask } = usePlanner();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-safe backdrop-blur-xl md:hidden"
      aria-label="Principal"
    >
      <div className="mx-auto grid h-[68px] max-w-md grid-cols-6 items-center px-2">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <MobileNavLink key={item.to} item={item} />
        ))}
        <div className="flex justify-center">
          <Button
            variant="fab"
            onClick={() => openAddTask()}
            className="-mt-7 size-14 [&_svg]:size-6"
            aria-label="Nueva tarea"
          >
            <Plus />
          </Button>
        </div>
        {NAV_ITEMS.slice(2).map((item) => (
          <MobileNavLink key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}
