import { CalendarDays, Home, ListChecks, NotebookPen, Repeat, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: "/" | "/tareas" | "/agenda" | "/habitos" | "/notas";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/** Single source for the sidebar (desktop/tablet) and the bottom bar (mobile). */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/habitos", label: "Hábitos", icon: Repeat },
  { to: "/notas", label: "Notas", icon: NotebookPen },
];
