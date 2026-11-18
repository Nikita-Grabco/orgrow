import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/common/chip";
import { DatePickerField } from "@/components/common/date-picker-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_IDS } from "@/config/categories";
import { useToday } from "@/hooks/use-today";
import { toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Activity, CategoryId, NewActivityInput } from "@/types/planner";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

interface ActivityFormProps {
  mode: "create" | "edit";
  activity?: Activity | undefined;
  initialDate: string | null;
  onSubmit: (input: NewActivityInput) => void;
}

function ActivityForm({ mode, activity, initialDate, onSubmit }: ActivityFormProps) {
  const today = useToday();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [date, setDate] = useState<string | null>(
    activity?.date ?? initialDate ?? (today ? toISODate(today) : null),
  );
  const [start, setStart] = useState(activity?.start ?? "09:00");
  const [end, setEnd] = useState(activity?.end ?? "");
  const [location, setLocation] = useState(activity?.location ?? "");
  const [category, setCategory] = useState<CategoryId>(activity?.category ?? "personal");

  const invalidRange = Boolean(end) && end <= start;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !date || !start || invalidRange) return;

    onSubmit({
      title: cleanTitle,
      category,
      date,
      start,
      ...(end ? { end } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="¿Qué has quedado?"
        aria-label="Título de la actividad"
        className="h-12 rounded-xl text-base"
      />

      <Field label="Día">
        <DatePickerField
          value={date}
          onChange={setDate}
          today={today}
          allowEmpty={false}
          {...(today ? { defaultMonth: today } : {})}
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <Field label="Empieza">
          <Input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            aria-label="Hora de inicio"
            required
            className="h-10 w-36 rounded-xl"
          />
        </Field>
        <Field label="Termina (opcional)">
          <Input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            aria-label="Hora de fin"
            className="h-10 w-36 rounded-xl"
          />
        </Field>
      </div>

      {invalidRange && (
        <p role="alert" className="text-xs font-semibold text-priority-high">
          La hora de fin debe ser posterior a la de inicio.
        </p>
      )}

      <Field label="Lugar (opcional)">
        <Input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Sala, dirección o videollamada"
          aria-label="Lugar"
          className="h-10 rounded-xl"
        />
      </Field>

      <Field label="Categoría">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_IDS.map((id) => (
            <Chip key={id} selected={category === id} onClick={() => setCategory(id)}>
              <span className={cn("size-2 rounded-full", CATEGORIES[id].dot)} />
              {CATEGORIES[id].label}
            </Chip>
          ))}
        </div>
      </Field>

      <DialogFooter className="gap-2 pt-2 sm:gap-2">
        <Button type="submit" disabled={!title.trim() || !date || invalidRange}>
          {mode === "edit" ? "Guardar cambios" : "Añadir actividad"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ActivityDialog() {
  const {
    activities,
    addActivity,
    editActivity,
    activityDialog,
    setActivityDialogOpen,
  } = usePlanner();
  const { open, mode, activityId, date } = activityDialog;
  const editing = mode === "edit" ? activities.find((item) => item.id === activityId) : undefined;

  useEffect(() => {
    if (open && mode === "edit" && !editing) setActivityDialogOpen(false);
  }, [open, mode, editing, setActivityDialogOpen]);

  function handleSubmit(input: NewActivityInput) {
    if (mode === "edit" && editing) {
      editActivity(editing.id, {
        ...input,
        // Clearing the end time or the place must reach the store, so `null`.
        end: input.end ?? null,
        location: input.location ?? null,
      });
      toast.success("Actividad actualizada", { description: input.title });
    } else {
      addActivity(input);
      toast.success("Actividad añadida", { description: input.title });
    }
    setActivityDialogOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setActivityDialogOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">
            {mode === "edit" ? "Editar actividad" : "Nueva actividad"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Cambia lo que necesites y guarda los cambios."
              : "Citas, clases, reuniones… lo que ocupa tu día."}
          </DialogDescription>
        </DialogHeader>

        <ActivityForm
          key={`${mode}:${activityId ?? "new"}:${date ?? "none"}`}
          mode={mode}
          activity={editing}
          initialDate={date}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
