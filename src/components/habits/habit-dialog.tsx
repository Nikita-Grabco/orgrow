import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/common/chip";
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
import { WEEKDAY_INITIALS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { CategoryId, Habit, HabitKind, NewHabitInput } from "@/types/planner";

type FrequencyMode = "daily" | "weekdays" | "weekly";

const KIND_OPTIONS: { id: HabitKind; label: string; hint: string }[] = [
  { id: "check", label: "Sí / no", hint: "Lo haces o no lo haces (ir al gimnasio)." },
  { id: "count", label: "Cantidad", hint: "Sumas hasta una meta (1 L de agua)." },
  { id: "time", label: "Tiempo", hint: "Sumas minutos hasta una meta (leer 1 h)." },
];

const FREQUENCY_OPTIONS: { id: FrequencyMode; label: string }[] = [
  { id: "daily", label: "Cada día" },
  { id: "weekdays", label: "Días concretos" },
  { id: "weekly", label: "Veces por semana" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

/** Accepts "0,25" and "0.25"; returns NaN when it is not a number. */
function parseAmount(value: string): number {
  return Number(value.trim().replace(",", "."));
}

interface HabitFormProps {
  mode: "create" | "edit";
  habit?: Habit | undefined;
  onSubmit: (input: NewHabitInput) => void;
  onDelete?: (() => void) | undefined;
}

function HabitForm({ mode, habit, onSubmit, onDelete }: HabitFormProps) {
  const [name, setName] = useState(habit?.name ?? "");
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? "check");
  const [target, setTarget] = useState(String(habit?.target ?? (habit?.kind === "time" ? 60 : 1)));
  const [step, setStep] = useState(String(habit?.step ?? 1));
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>(
    habit?.frequency.type ?? "daily",
  );
  const [days, setDays] = useState<number[]>(
    habit?.frequency.type === "weekdays" ? habit.frequency.days : [0, 2, 4],
  );
  const [times, setTimes] = useState(
    habit?.frequency.type === "weekly" ? habit.frequency.times : 3,
  );
  const [category, setCategory] = useState<CategoryId>(habit?.category ?? "salud");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function changeKind(next: HabitKind) {
    if (next === kind) return;
    setKind(next);
    // Sensible defaults when switching, unless the user is editing an existing habit.
    if (next === "time") {
      setTarget("60");
      setStep("15");
    } else if (next === "count") {
      setTarget("1");
      setStep("0.25");
      setUnit((current) => current || "L");
    }
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  const targetValue = kind === "check" ? 1 : parseAmount(target);
  const stepValue = kind === "check" ? 1 : parseAmount(step);
  const invalidAmount =
    kind !== "check" &&
    (!Number.isFinite(targetValue) ||
      targetValue <= 0 ||
      !Number.isFinite(stepValue) ||
      stepValue <= 0);
  const invalidDays = frequencyMode === "weekdays" && days.length === 0;
  const canSubmit = name.trim().length > 0 && !invalidAmount && !invalidDays;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      name: name.trim(),
      kind,
      target: targetValue,
      step: stepValue,
      unit: kind === "count" && unit.trim() ? unit.trim() : undefined,
      frequency:
        frequencyMode === "daily"
          ? { type: "daily" }
          : frequencyMode === "weekdays"
            ? { type: "weekdays", days: [...days].sort((a, b) => a - b) }
            : { type: "weekly", times },
      category,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ej.: Beber agua, leer, ir al gimnasio"
        aria-label="Nombre del hábito"
        className="h-12 rounded-xl text-base"
      />

      <Field label="¿Cómo lo mides?">
        <div className="flex flex-wrap gap-2">
          {KIND_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              selected={kind === option.id}
              onClick={() => changeKind(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {KIND_OPTIONS.find((option) => option.id === kind)?.hint}
        </p>
      </Field>

      {kind !== "check" && (
        <div className="flex flex-wrap gap-4">
          <Field label={kind === "time" ? "Meta diaria (min)" : "Meta diaria"}>
            <Input
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              aria-label="Meta diaria"
              className="h-10 w-28 rounded-xl"
            />
          </Field>
          {kind === "count" && (
            <Field label="Unidad">
              <Input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="L, vasos…"
                aria-label="Unidad"
                className="h-10 w-28 rounded-xl"
              />
            </Field>
          )}
          <Field label={kind === "time" ? "Suma por toque (min)" : "Suma por toque"}>
            <Input
              inputMode="decimal"
              value={step}
              onChange={(event) => setStep(event.target.value)}
              aria-label="Cantidad que suma cada toque"
              className="h-10 w-28 rounded-xl"
            />
          </Field>
        </div>
      )}

      {invalidAmount && (
        <p role="alert" className="text-xs font-semibold text-priority-high">
          La meta y lo que suma cada toque deben ser números mayores que 0.
        </p>
      )}

      <Field label="Frecuencia">
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              selected={frequencyMode === option.id}
              onClick={() => setFrequencyMode(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        {frequencyMode === "weekdays" && (
          <div className="flex gap-1.5 pt-1" role="group" aria-label="Días de la semana">
            {WEEKDAY_INITIALS.map((initial, day) => (
              <Chip
                key={initial + day}
                selected={days.includes(day)}
                onClick={() => toggleDay(day)}
                aria-label={
                  ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][day] ??
                  initial
                }
                className="size-9 justify-center px-0"
              >
                {initial}
              </Chip>
            ))}
          </div>
        )}

        {frequencyMode === "weekly" && (
          <div
            className="flex items-center gap-1.5 pt-1"
            role="group"
            aria-label="Veces por semana"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <Chip
                key={count}
                selected={times === count}
                onClick={() => setTimes(count)}
                className="size-9 justify-center px-0"
              >
                {count}
              </Chip>
            ))}
            <span className="pl-1 text-xs text-muted-foreground">por semana</span>
          </div>
        )}

        {invalidDays && (
          <p role="alert" className="text-xs font-semibold text-priority-high">
            Elige al menos un día.
          </p>
        )}
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

      <DialogFooter className="gap-2 pt-2 sm:justify-between sm:gap-2">
        {mode === "edit" && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-priority-high hover:text-priority-high"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          >
            {confirmDelete ? "Confirmar: se borra también su progreso" : "Eliminar"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!canSubmit}>
          {mode === "edit" ? "Guardar cambios" : "Añadir hábito"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function HabitDialog() {
  const { habits, addHabit, editHabit, deleteHabit, habitDialog, setHabitDialogOpen } =
    usePlanner();
  const { open, mode, habitId } = habitDialog;
  const editing = mode === "edit" ? habits.find((item) => item.id === habitId) : undefined;

  useEffect(() => {
    if (open && mode === "edit" && !editing) setHabitDialogOpen(false);
  }, [open, mode, editing, setHabitDialogOpen]);

  function handleSubmit(input: NewHabitInput) {
    if (mode === "edit" && editing) {
      editHabit(editing.id, { ...input, unit: input.unit ?? null });
      toast.success("Hábito actualizado", { description: input.name });
    } else {
      addHabit(input);
      toast.success("Hábito añadido", { description: input.name });
    }
    setHabitDialogOpen(false);
  }

  function handleDelete() {
    if (!editing) return;
    deleteHabit(editing.id);
    toast.success("Hábito eliminado", { description: editing.name });
    setHabitDialogOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setHabitDialogOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">
            {mode === "edit" ? "Editar hábito" : "Nuevo hábito"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Cambia lo que necesites. Tu progreso anterior se conserva."
              : "Algo que quieres repetir y ver cómo avanza."}
          </DialogDescription>
        </DialogHeader>

        <HabitForm
          key={`${mode}:${habitId ?? "new"}`}
          mode={mode}
          habit={editing}
          onSubmit={handleSubmit}
          onDelete={editing ? handleDelete : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
