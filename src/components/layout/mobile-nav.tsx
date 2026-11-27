import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { AddMenu } from "@/components/layout/add-menu";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, type NavItem } from "@/config/navigation";

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

/** Barra inferior del móvil: las cinco secciones a partes iguales y el botón + flotando encima. */
export function MobileNav() {
  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-safe backdrop-blur-xl md:hidden"
        aria-label="Principal"
      >
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-2">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom)+16px)] right-5 z-40 md:hidden">
        <AddMenu>
          <Button variant="fab" className="size-14 [&_svg]:size-6" aria-label="Añadir">
            <Plus />
          </Button>
        </AddMenu>
      </div>
    </>
  );
}
