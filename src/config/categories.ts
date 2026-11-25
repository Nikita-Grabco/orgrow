import { Bell, Lightbulb, ListTodo, type LucideIcon } from "lucide-react";

import type { CategoryId, NoteKind, Priority } from "@/types/planner";

/** Visual config per category. Class names are literal so Tailwind can detect them. */
export const CATEGORIES: Record<
  CategoryId,
  { label: string; dot: string; soft: string; ink: string; bar: string }
> = {
  trabajo: {
    label: "Trabajo",
    dot: "bg-work",
    soft: "bg-work-soft",
    ink: "text-work-ink",
    bar: "border-work",
  },
  personal: {
    label: "Personal",
    dot: "bg-personal",
    soft: "bg-personal-soft",
    ink: "text-personal-ink",
    bar: "border-personal",
  },
  salud: {
    label: "Salud",
    dot: "bg-health",
    soft: "bg-health-soft",
    ink: "text-health-ink",
    bar: "border-health",
  },
  hogar: {
    label: "Hogar",
    dot: "bg-home",
    soft: "bg-home-soft",
    ink: "text-home-ink",
    bar: "border-home",
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export const PRIORITIES: Record<Priority, { label: string; dot: string }> = {
  alta: { label: "Alta", dot: "bg-priority-high" },
  media: { label: "Media", dot: "bg-priority-medium" },
  baja: { label: "Baja", dot: "bg-priority-low" },
};

export const PRIORITY_IDS = Object.keys(PRIORITIES) as Priority[];

export const NOTE_KINDS: Record<
  NoteKind,
  { label: string; icon: LucideIcon; soft: string; ink: string }
> = {
  idea: { label: "Idea", icon: Lightbulb, soft: "bg-home-soft", ink: "text-home-ink" },
  "por-hacer": { label: "Por hacer", icon: ListTodo, soft: "bg-work-soft", ink: "text-work-ink" },
  recordatorio: {
    label: "Recordatorio",
    icon: Bell,
    soft: "bg-personal-soft",
    ink: "text-personal-ink",
  },
};

export const NOTE_KIND_IDS = Object.keys(NOTE_KINDS) as NoteKind[];
