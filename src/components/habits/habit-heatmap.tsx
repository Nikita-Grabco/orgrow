import {
  heatLevel,
  formatAmount,
  logValue,
  heatmapWeeks,
  type HabitLogIndex,
  type HeatLevel,
} from "@/lib/habits";
import { shortDateLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Habit } from "@/types/planner";

/** Literal class names so Tailwind can detect them. Only theme tokens, no raw colors. */
const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
};

export const HEATMAP_WEEKS = 20;

interface HabitHeatmapProps {
  habit: Habit;
  index: HabitLogIndex;
  todayISO: string;
  selectedISO: string;
  onSelectDay: (dateISO: string) => void;
}

/** GitHub-style grid: one column per week (Mon–Sun), most recent week on the right. */
export function HabitHeatmap({
  habit,
  index,
  todayISO,
  selectedISO,
  onSelectDay,
}: HabitHeatmapProps) {
  const weeks = heatmapWeeks(todayISO, HEATMAP_WEEKS);

  return (
    <div className="space-y-2">
      <div
        className="grid max-w-[28rem] grid-flow-col gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
        }}
        role="group"
        aria-label={`Progreso de las últimas ${HEATMAP_WEEKS} semanas`}
      >
        {weeks.flatMap((week) =>
          week.map((date) => {
            const future = date > todayISO;
            const value = logValue(index, habit.id, date);
            return (
              <button
                key={date}
                type="button"
                disabled={future}
                onClick={() => onSelectDay(date)}
                title={`${shortDateLabel(date)}: ${formatAmount(habit, value)}`}
                aria-label={`${shortDateLabel(date)}: ${formatAmount(habit, value)}`}
                aria-pressed={date === selectedISO}
                className={cn(
                  "aspect-square w-full cursor-pointer rounded-[3px] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-20 disabled:hover:scale-100",
                  LEVEL_CLASS[heatLevel(habit, value)],
                  date === todayISO && "ring-1 ring-foreground/60",
                  date === selectedISO && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                )}
              />
            );
          }),
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span>Menos</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn("size-2.5 rounded-[3px]", LEVEL_CLASS[level])} />
        ))}
        <span>Más</span>
        <span className="ml-auto">Últimas {HEATMAP_WEEKS} semanas</span>
      </div>
    </div>
  );
}
