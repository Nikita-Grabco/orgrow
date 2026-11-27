import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { NoteCard } from "@/components/notes/note-card";
import type { PlannerRepositories } from "@/services/supabase-repositories";
import { PlannerProvider, usePlanner } from "@/store/planner-store";
import type { Note } from "@/types/planner";

function repositoriesWith(initial: Note[]) {
  let notes = [...initial];
  const saved: Note[] = [];

  const repositories: PlannerRepositories = {
    tasks: {
      list: async () => [],
      create: async (t) => t,
      update: async (t) => t,
      remove: async () => {},
    },
    notes: {
      list: async () => [...notes],
      create: async (note) => note,
      update: async (note) => {
        saved.push(note);
        notes = notes.map((item) => (item.id === note.id ? note : item));
        return note;
      },
      remove: async () => {},
    },
    activities: {
      list: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      remove: async () => {},
    },
    habits: {
      list: async () => [],
      create: async (h) => h,
      update: async (h) => h,
      remove: async () => {},
    },
    habitLogs: {
      list: async () => [],
      upsert: async (l) => l,
      remove: async () => {},
      removeForHabit: async () => {},
    },
    specialDates: {
      list: async () => [],
      create: async (d) => d,
      update: async (d) => d,
      remove: async () => {},
    },
    goals: {
      list: async () => [],
      create: async (g) => g,
      update: async (g) => g,
      remove: async () => {},
    },
  };
  return { repositories, saved };
}

function Cards() {
  const { notes, isReady } = usePlanner();
  if (!isReady) return null;
  return (
    <>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </>
  );
}

const NOTE: Note = { id: "n-1", content: "Comprar pan", kind: "idea", pinned: false, createdAt: 1 };

beforeEach(() => {
  window.localStorage.clear();
});

async function renderCard() {
  const { repositories, saved } = repositoriesWith([NOTE]);
  render(
    <PlannerProvider repositories={repositories}>
      <Cards />
    </PlannerProvider>,
  );
  await screen.findByText("Comprar pan");
  return { saved };
}

describe("editar una nota", () => {
  it("cambia el texto y el tipo y lo guarda", async () => {
    const { saved } = await renderCard();

    fireEvent.click(screen.getByLabelText("Editar nota"));
    const box = screen.getByLabelText("Editar nota", { selector: "textarea" });
    expect(box).toHaveValue("Comprar pan");

    fireEvent.change(box, { target: { value: "  Comprar pan y leche  " } });
    fireEvent.click(screen.getByRole("button", { name: /Recordatorio/ }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ content: "Comprar pan y leche", kind: "recordatorio" });
    expect(await screen.findByText("Comprar pan y leche")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Editar nota", { selector: "textarea" }),
    ).not.toBeInTheDocument();
  });

  it("Enter guarda y Escape cancela sin guardar", async () => {
    const { saved } = await renderCard();

    fireEvent.click(screen.getByLabelText("Editar nota"));
    let box = screen.getByLabelText("Editar nota", { selector: "textarea" });
    fireEvent.change(box, { target: { value: "Cambio descartado" } });
    fireEvent.keyDown(box, { key: "Escape" });

    expect(screen.getByText("Comprar pan")).toBeInTheDocument();
    expect(saved).toHaveLength(0);

    // Al reabrir parte de lo guardado, no del borrador descartado.
    fireEvent.click(screen.getByLabelText("Editar nota"));
    box = screen.getByLabelText("Editar nota", { selector: "textarea" });
    expect(box).toHaveValue("Comprar pan");

    fireEvent.change(box, { target: { value: "Con Enter" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.content).toBe("Con Enter");
  });

  it("no permite dejar la nota vacía y no guarda si no hay cambios", async () => {
    const { saved } = await renderCard();

    fireEvent.click(screen.getByLabelText("Editar nota"));
    const box = screen.getByLabelText("Editar nota", { selector: "textarea" });

    fireEvent.change(box, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(saved).toHaveLength(0);

    fireEvent.change(box, { target: { value: "Comprar pan" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(saved).toHaveLength(0);
    expect(
      screen.queryByLabelText("Editar nota", { selector: "textarea" }),
    ).not.toBeInTheDocument();
  });
});
