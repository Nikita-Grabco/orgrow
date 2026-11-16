import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/common/chip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dueDateLabel, isoFromOffset, isValidISODate, parseISODate, toISODate } from "@/lib/dates";

interface TaskDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** `useToday()`: null while the date is unknown (server render). */
  today: Date | null;
}

/** Quick chips (Hoy / Mañana / Sin fecha) plus the existing shadcn calendar. */
export function TaskDatePicker({ value, onChange, today }: TaskDatePickerProps) {
  const [open, setOpen] = useState(false);
  const todayISO = isoFromOffset(0, today);
  const tomorrowISO = isoFromOffset(1, today);
  const isCustom = value !== null && value !== todayISO && value !== tomorrowISO;
  const selected = value && isValidISODate(value) ? parseISODate(value) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip selected={value !== null && value === todayISO} disabled={!today} onClick={() => onChange(todayISO)}>
        Hoy
      </Chip>
      <Chip
        selected={value !== null && value === tomorrowISO}
        disabled={!today}
        onClick={() => onChange(tomorrowISO)}
      >
        Mañana
      </Chip>
      <Chip selected={value === null} onClick={() => onChange(null)}>
        Sin fecha
      </Chip>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Chip selected={isCustom} aria-label="Elegir una fecha">
            <CalendarDays className="size-3" />
            {isCustom ? dueDateLabel(value, today) : "Elegir fecha"}
          </Chip>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            autoFocus
            selected={selected}
            {...(selected ? { defaultMonth: selected } : {})}
            onSelect={(date) => {
              onChange(date ? toISODate(date) : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
