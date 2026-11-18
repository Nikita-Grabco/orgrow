import { ChevronLeft, ChevronRight } from "lucide-react";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";

export type AgendaViewId = "dia" | "semana" | "mes";

const VIEWS: { id: AgendaViewId; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

interface AgendaToolbarProps {
  label: string;
  view: AgendaViewId;
  onViewChange: (view: AgendaViewId) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
}

/** Navigation and view switcher shared by the three agenda views. */
export function AgendaToolbar({
  label,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  isToday,
}: AgendaToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Anterior" onClick={onPrev}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Siguiente" onClick={onNext}>
          <ChevronRight />
        </Button>
        <p className="min-w-0 flex-1 truncate font-display font-semibold text-xl text-foreground sm:text-2xl">
          {label}
        </p>
        {!isToday && <Chip onClick={onToday}>Hoy</Chip>}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card p-1">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            aria-pressed={view === item.id}
            className={
              view === item.id
                ? "cursor-pointer rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                : "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
