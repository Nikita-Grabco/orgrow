import { CalendarClock, ListChecks } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePlanner } from "@/store/planner-store";

interface AddMenuProps {
  /** El botón que abre la hoja (se usa tal cual, con `asChild`). */
  children: ReactNode;
}

/** "¿Qué quieres añadir?": pregunta si es una tarea o una actividad antes de abrir su formulario. */
export function AddMenu({ children }: AddMenuProps) {
  const { openAddTask, openAddActivity } = usePlanner();
  const [open, setOpen] = useState(false);

  const choose = (open: () => void) => {
    setOpen(false);
    open();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe md:mx-auto md:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>¿Qué quieres añadir?</SheetTitle>
          <SheetDescription className="sr-only">
            Elige si es una tarea o una actividad.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-2">
          <ChoiceButton
            icon={<ListChecks className="size-5" />}
            title="Tarea"
            hint="Algo por hacer, con fecha límite y prioridad"
            onClick={() => choose(() => openAddTask())}
          />
          <ChoiceButton
            icon={<CalendarClock className="size-5" />}
            title="Actividad"
            hint="Un evento con hora de inicio y fin, o lugar"
            onClick={() => choose(() => openAddActivity())}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ChoiceButton({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl bg-secondary p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
