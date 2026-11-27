import { ChevronLeft, ChevronRight, CircleDashed } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip } from "@/components/common/chip";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/config/categories";
import { useSwipeNav } from "@/hooks/use-swipe-nav";
import { monthDatesISO, monthLabel, shiftISOMonths, shortDateLabel } from "@/lib/dates";
import {
  arcPath,
  daySlices,
  habitMonthCells,
  polar,
  ringTotals,
  type RingCellState,
} from "@/lib/habit-ring";
import { formatProgress, indexLogs, logValue } from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { CategoryId, Habit, HabitLog } from "@/types/planner";

const SIZE = 640;
const CENTER = SIZE / 2;
const OUTER = 282;
const INNER = 84;
const LABEL_RADIUS = 302;

/** Literal class names so Tailwind can detect them. */
const FILL: Record<CategoryId, string> = {
  trabajo: "fill-work",
  personal: "fill-personal",
  salud: "fill-health",
  hogar: "fill-home",
};

const EMPTY_CLASS: Record<Exclude<RingCellState, "done" | "partial">, string> = {
  missed: "fill-muted",
  off: "fill-muted/25",
  future: "fill-muted/45",
};

interface HabitRingProps {
  habits: Habit[];
  logs: HabitLog[];
  todayISO: string;
}

/** Monthly circle: one ring per habit, one segment per day of the month. */
export function HabitRing({ habits, logs, todayISO }: HabitRingProps) {
  const [monthAnchor, setMonthAnchor] = useState(todayISO);
  const swipe = useSwipeNav((direction) => setMonthAnchor((m) => shiftISOMonths(m, direction)));
  const index = useMemo(() => indexLogs(logs), [logs]);
  const dates = monthDatesISO(monthAnchor);
  const slices = daySlices(dates.length);
  const isCurrentMonth = monthAnchor.slice(0, 7) === todayISO.slice(0, 7);

  const rings = habits.map((habit) => {
    const cells = habitMonthCells(habit, index, monthAnchor, todayISO);
    return { habit, cells, totals: ringTotals(cells) };
  });
  const planned = rings.reduce((sum, ring) => sum + ring.totals.planned, 0);
  const done = rings.reduce((sum, ring) => sum + ring.totals.done, 0);
  const percent = planned > 0 ? Math.round((done / planned) * 100) : 0;

  const thickness = Math.min(30, (OUTER - INNER) / Math.max(rings.length, 1) - 5);

  return (
    <section className="surface min-w-0 select-none space-y-4 p-4 sm:p-6" {...swipe}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Mes anterior"
          onClick={() => setMonthAnchor((m) => shiftISOMonths(m, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Mes siguiente"
          onClick={() => setMonthAnchor((m) => shiftISOMonths(m, 1))}
        >
          <ChevronRight />
        </Button>
        <h2 className="min-w-0 flex-1 truncate font-display font-semibold text-xl text-foreground sm:text-2xl">
          {monthLabel(monthAnchor)}
        </h2>
        {!isCurrentMonth && <Chip onClick={() => setMonthAnchor(todayISO)}>Este mes</Chip>}
      </div>

      {rings.length === 0 ? (
        <EmptyState
          icon={<CircleDashed />}
          title="Sin hábitos que mostrar"
          description="Crea un hábito y verás aquí su círculo del mes."
        />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block h-auto w-full max-w-xl"
            role="img"
            aria-label={`Progreso de hábitos en ${monthLabel(monthAnchor)}: ${percent}% cumplido`}
          >
            {rings.map(({ habit, cells }, ringIndex) => {
              const outer = OUTER - ringIndex * (thickness + 5);
              const inner = outer - thickness;
              return (
                <g key={habit.id}>
                  {cells.map((cell, dayIndex) => {
                    const slice = slices[dayIndex];
                    if (!slice) return null;
                    const filled = cell.state === "done" || cell.state === "partial";
                    const value = logValue(index, habit.id, cell.date);
                    const detail =
                      habit.kind === "check"
                        ? value >= 1
                          ? "hecho"
                          : "sin hacer"
                        : formatProgress(habit, value);
                    return (
                      <path
                        key={cell.date}
                        d={arcPath(CENTER, CENTER, inner, outer, slice.start, slice.end)}
                        className={
                          cell.state === "done" || cell.state === "partial"
                            ? FILL[habit.category]
                            : EMPTY_CLASS[cell.state]
                        }
                        opacity={filled && cell.state === "partial" ? 0.35 + cell.ratio * 0.4 : 1}
                      >
                        <title>{`${habit.name} · ${shortDateLabel(cell.date)}: ${detail}`}</title>
                      </path>
                    );
                  })}
                </g>
              );
            })}

            <g className="max-sm:hidden">
              {slices.map((slice, i) => {
                const p = polar(CENTER, CENTER, LABEL_RADIUS, slice.mid);
                return (
                  <text
                    key={i}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-muted-foreground text-[13px]"
                  >
                    {i + 1}
                  </text>
                );
              })}
            </g>
            <g className="sm:hidden">
              {slices.map((slice, i) => {
                if (i !== 0 && (i + 1) % 5 !== 0) return null;
                const p = polar(CENTER, CENTER, LABEL_RADIUS, slice.mid);
                return (
                  <text
                    key={i}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-muted-foreground text-[20px]"
                  >
                    {i + 1}
                  </text>
                );
              })}
            </g>

            <text
              x={CENTER}
              y={CENTER - 8}
              textAnchor="middle"
              className="fill-foreground text-[44px] font-bold"
            >
              {percent}%
            </text>
            <text
              x={CENTER}
              y={CENTER + 26}
              textAnchor="middle"
              className="fill-muted-foreground text-[18px]"
            >
              cumplido
            </text>
          </svg>

          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {rings.map(({ habit, totals }) => (
              <li key={habit.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn("size-3 shrink-0 rounded-sm", CATEGORIES[habit.category].dot)}
                />
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                  {habit.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {totals.done}/{totals.planned} días
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
