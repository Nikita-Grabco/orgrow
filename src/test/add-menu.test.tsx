import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddMenu } from "@/components/layout/add-menu";

const openAddTask = vi.fn();
const openAddActivity = vi.fn();

vi.mock("@/store/planner-store", () => ({
  usePlanner: () => ({ openAddTask, openAddActivity }),
}));

function setup() {
  render(
    <AddMenu>
      <button type="button">Añadir</button>
    </AddMenu>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
}

describe("AddMenu", () => {
  beforeEach(() => {
    openAddTask.mockClear();
    openAddActivity.mockClear();
  });

  it("pregunta si es tarea o actividad antes de abrir nada", async () => {
    setup();
    expect(await screen.findByText("¿Qué quieres añadir?")).toBeTruthy();
    expect(openAddTask).not.toHaveBeenCalled();
    expect(openAddActivity).not.toHaveBeenCalled();
  });

  it("Tarea abre el formulario de tarea y cierra la hoja", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Tarea/ }));
    expect(openAddTask).toHaveBeenCalledTimes(1);
    expect(openAddActivity).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("¿Qué quieres añadir?")).toBeNull());
  });

  it("Actividad abre el formulario de actividad", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Actividad/ }));
    expect(openAddActivity).toHaveBeenCalledTimes(1);
    expect(openAddTask).not.toHaveBeenCalled();
  });
});
