import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HabitDialog } from "@/components/habits/habit-dialog";
import type { Habit } from "@/types/planner";

const editHabit = vi.fn();
const addHabit = vi.fn();
let state: { mode: "create" | "edit"; habitId: string | null; habits: Habit[] };

vi.mock("@/store/planner-store", () => ({
  usePlanner: () => ({
    habits: state.habits,
    addHabit,
    editHabit,
    deleteHabit: vi.fn(),
    habitDialog: { open: true, mode: state.mode, habitId: state.habitId },
    setHabitDialogOpen: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const timeHabit: Habit = {
  id: "h1",
  name: "Leer",
  kind: "time",
  target: 60,
  step: 15,
  frequency: { type: "daily" },
  category: "personal",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
};

describe("formulario de hábitos", () => {
  it("ya no ofrece 'Tiempo': solo Sí / no y Cantidad", () => {
    state = { mode: "create", habitId: null, habits: [] };
    render(<HabitDialog />);
    expect(screen.queryByRole("button", { name: "Tiempo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sí / no" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cantidad" })).toBeTruthy();
  });

  it("en Cantidad hay unidades sugeridas y se puede elegir una", () => {
    state = { mode: "create", habitId: null, habits: [] };
    render(<HabitDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Cantidad" }));
    const group = screen.getByRole("group", { name: "Unidades sugeridas" });
    expect(group.textContent).toContain("min");
    expect(group.textContent).toContain("páginas");
    fireEvent.click(screen.getByRole("button", { name: "h" }));
    expect((screen.getByLabelText("Unidad") as HTMLInputElement).value).toBe("h");
  });

  it("un hábito de tiempo antiguo se edita como cantidad en minutos y se guarda así", () => {
    state = { mode: "edit", habitId: "h1", habits: [timeHabit] };
    render(<HabitDialog />);
    expect((screen.getByLabelText("Unidad") as HTMLInputElement).value).toBe("min");
    expect((screen.getByLabelText("Meta diaria") as HTMLInputElement).value).toBe("60");

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(editHabit).toHaveBeenCalledWith(
      "h1",
      expect.objectContaining({ kind: "count", target: 60, step: 15, unit: "min" }),
    );
  });
});
