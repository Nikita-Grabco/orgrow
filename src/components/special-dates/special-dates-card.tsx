import { Gift, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { SPECIAL_DATE_KINDS } from "@/config/special-dates";
import { useToday } from "@/hooks/use-today";
import { shortDateLabel, toISODate } from "@/lib/dates";
import {
  inDaysLabel,
  sortByNextOccurrence,
  upcomingSpecialDates,
  yearsLabel,
} from "@/lib/special-dates";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";

/** Días hacia delante que cubre el bloque del Inicio. */
const DASHBOARD_WINDOW_DAYS = 30;

interface SpecialDatesCardProps {
  /** `dashboard`: solo las de los próximos 30 días. `agenda`: todas. */
  variant: "dashboard" | "agenda";
}

export function SpecialDatesCard({ variant }: SpecialDatesCardProps) {
  const { specialDates, openAddSpecialDate, openEditSpecialDate } = usePlanner();
  const today = useToday();
  const todayISO = today ? toISODate(today) : null;

  const items = !todayISO
    ? []
    : variant === "dashboard"
      ? upcomingSpecialDates(specialDates, todayISO, DASHBOARD_WINDOW_DAYS)
      : sortByNextOccurrence(specialDates, todayISO);

  return (
    <SectionCard
      title={variant === "dashboard" ? "Próximas fechas" : "Fechas importantes"}
      icon={<Gift />}
      action={
        <Button variant="ghost" size="sm" onClick={openAddSpecialDate}>
          <Plus /> Añadir
        </Button>
      }
    >
      {items.length === 0 ? (
        specialDates.length === 0 ? (
          <EmptyState
            icon={<Gift />}
            title="Todavía no hay fechas"
            description="Añade cumpleaños y aniversarios: se repiten cada año y salen en el calendario."
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nada en los próximos {DASHBOARD_WINDOW_DAYS} días.
          </p>
        )
      ) : (
        <ul className="-mx-2 flex flex-col gap-0.5">
          {items.map(({ date, on, inDays, years }) => {
            const Icon = SPECIAL_DATE_KINDS[date.kind].icon;
            const extra = yearsLabel(date.kind, years);
            return (
              <li key={date.id}>
                <button
                  type="button"
                  onClick={() => openEditSpecialDate(date.id)}
                  aria-label={`Editar "${date.title}"`}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {date.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {shortDateLabel(on)}
                      {extra && ` · ${extra}`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold",
                      inDays <= 1 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {inDaysLabel(inDays)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
