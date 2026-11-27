import { Trash2 } from "lucide-react";
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
import {
  SPECIAL_DATE_KIND_IDS,
  SPECIAL_DATE_KINDS,
  SPECIAL_DATE_REMINDERS,
} from "@/config/special-dates";
import { isPushConfigured } from "@/services/push-service";
import { maxDayOfMonth } from "@/lib/special-dates";
import { usePlanner } from "@/store/planner-store";
import type { NewSpecialDateInput, SpecialDate, SpecialDateKind } from "@/types/planner";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

interface FormProps {
  mode: "create" | "edit";
  date?: SpecialDate | undefined;
  onSubmit: (input: NewSpecialDateInput) => void;
  onDelete?: (() => void) | undefined;
}

function SpecialDateForm({ mode, date, onSubmit, onDelete }: FormProps) {
  const [title, setTitle] = useState(date?.title ?? "");
  const [kind, setKind] = useState<SpecialDateKind>(date?.kind ?? "cumpleanos");
  const [month, setMonth] = useState(date?.month ?? new Date().getMonth() + 1);
  const [day, setDay] = useState(String(date?.day ?? new Date().getDate()));
  const [year, setYear] = useState(date?.year ? String(date.year) : "");
  const [remind, setRemind] = useState<number | null>(date ? (date.remindBeforeDays ?? null) : 1);

  const dayNumber = Number(day);
  const maxDay = maxDayOfMonth(month);
  const dayInvalid = !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > maxDay;
  const yearNumber = year.trim() === "" ? undefined : Number(year);
  const yearInvalid =
    yearNumber !== undefined &&
    (!Number.isInteger(yearNumber) || yearNumber < 1900 || yearNumber > new Date().getFullYear());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || dayInvalid || yearInvalid) return;
    onSubmit({
      title: cleanTitle,
      kind,
      month,
      day: dayNumber,
      year: yearNumber,
      // Sin avisos configurados no se toca el valor que ya tuviera.
      ...(isPushConfigured() ? { remindBeforeDays: remind } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={kind === "cumpleanos" ? "¿De quién es el cumpleaños?" : "¿Qué fecha es?"}
        aria-label="Nombre"
        maxLength={100}
        className="h-12 rounded-xl text-base"
      />

      <Field label="Tipo">
        <div className="flex flex-wrap gap-2">
          {SPECIAL_DATE_KIND_IDS.map((id) => {
            const Icon = SPECIAL_DATE_KINDS[id].icon;
            return (
              <Chip key={id} selected={kind === id} onClick={() => setKind(id)}>
                <Icon className="size-3.5" />
                {SPECIAL_DATE_KINDS[id].label}
              </Chip>
            );
          })}
        </div>
      </Field>

      <div className="flex flex-wrap gap-4">
        <Field label="Día">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxDay}
            value={day}
            onChange={(event) => setDay(event.target.value)}
            aria-label="Día del mes"
            className="h-10 w-24 rounded-xl"
          />
        </Field>
        <Field label="Mes">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            aria-label="Mes"
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={SPECIAL_DATE_KINDS[kind].yearLabel}>
          <Input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder="1990"
            aria-label="Año"
            className="h-10 w-32 rounded-xl"
          />
        </Field>
      </div>

      {(dayInvalid || yearInvalid) && (
        <p role="alert" className="text-xs font-semibold text-priority-high">
          {dayInvalid
            ? `${MONTHS[month - 1]} tiene como mucho ${maxDay} días.`
            : "Escribe un año válido (por ejemplo 1990) o déjalo vacío."}
        </p>
      )}

      {isPushConfigured() && (
        <Field label="Aviso">
          <div className="flex flex-wrap gap-2">
            {SPECIAL_DATE_REMINDERS.map((option) => (
              <Chip
                key={option.label}
                selected={remind === option.value}
                onClick={() => setRemind(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <DialogFooter className="gap-2 pt-2 sm:gap-2">
        {mode === "edit" && onDelete && (
          <Button type="button" variant="ghost" onClick={onDelete} className="sm:mr-auto">
            <Trash2 /> Eliminar
          </Button>
        )}
        <Button type="submit" disabled={!title.trim() || dayInvalid || yearInvalid}>
          {mode === "edit" ? "Guardar cambios" : "Añadir fecha"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SpecialDateDialog() {
  const {
    specialDates,
    addSpecialDate,
    editSpecialDate,
    deleteSpecialDate,
    specialDateDialog,
    setSpecialDateDialogOpen,
  } = usePlanner();
  const { open, mode, specialDateId } = specialDateDialog;
  const editing =
    mode === "edit" ? specialDates.find((item) => item.id === specialDateId) : undefined;

  useEffect(() => {
    if (open && mode === "edit" && !editing) setSpecialDateDialogOpen(false);
  }, [open, mode, editing, setSpecialDateDialogOpen]);

  function handleSubmit(input: NewSpecialDateInput) {
    if (mode === "edit" && editing) {
      editSpecialDate(editing.id, { ...input, year: input.year ?? null });
      toast.success("Fecha actualizada", { description: input.title });
    } else {
      addSpecialDate(input);
      toast.success("Fecha añadida", { description: input.title });
    }
    setSpecialDateDialogOpen(false);
  }

  function handleDelete() {
    if (!editing) return;
    deleteSpecialDate(editing.id);
    toast.success("Fecha eliminada", { description: editing.title });
    setSpecialDateDialogOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setSpecialDateDialogOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-semibold">
            {mode === "edit" ? "Editar fecha" : "Nueva fecha importante"}
          </DialogTitle>
          <DialogDescription>
            Cumpleaños, aniversarios… Se repite cada año y sale en el calendario.
          </DialogDescription>
        </DialogHeader>

        <SpecialDateForm
          key={`${mode}:${specialDateId ?? "new"}`}
          mode={mode}
          date={editing}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
