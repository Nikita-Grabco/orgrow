import { Cake, Heart, Star, type LucideIcon } from "lucide-react";

import type { SpecialDateKind } from "@/types/planner";

export const SPECIAL_DATE_KINDS: Record<
  SpecialDateKind,
  { label: string; icon: LucideIcon; yearLabel: string }
> = {
  cumpleanos: { label: "Cumpleaños", icon: Cake, yearLabel: "Año de nacimiento (opcional)" },
  aniversario: { label: "Aniversario", icon: Heart, yearLabel: "Año en que empezó (opcional)" },
  otra: { label: "Otra fecha", icon: Star, yearLabel: "Año (opcional)" },
};

export const SPECIAL_DATE_KIND_IDS = Object.keys(SPECIAL_DATE_KINDS) as SpecialDateKind[];

/** Opciones de aviso, en días antes. */
export const SPECIAL_DATE_REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: "Sin aviso" },
  { value: 0, label: "El mismo día" },
  { value: 1, label: "1 día antes" },
  { value: 7, label: "1 semana antes" },
];
