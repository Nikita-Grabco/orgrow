import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannerRepositories } from "@/services/supabase-repositories";
import { PlannerProvider, usePlanner } from "@/store/planner-store";
import type { Task } from "@/types/planner";

/** Repositorios en memoria: el store no sabe si detrás hay localStorage o un servidor. */
function memoryRepositories(initialTasks: Task[] = []) {
  let tasks = [...initialTasks];
  const calls = { list: 0, create: 0, remove: 0 };

  const repositories: PlannerRepositories = {
    tasks: {
      list: async () => {
        calls.list += 1;
        return [...tasks];
      },
      create: async (task) => {
        calls.create += 1;
        tasks = [...tasks, task];
        return task;
      },
      update: async (task) => {
        tasks = tasks.map((item) => (item.id === task.id ? task : item));
        return task;
      },
      remove: async (id) => {
        calls.remove += 1;
        tasks = tasks.filter((item) => item.id !== id);
      },
    },
    notes: { list: async () => [], create: async (n) => n, update: async (n) => n, remove: async () => {} },
    activities: { list: async () => [], create: async (a) => a, update: async (a) => a, remove: async () => {} },
    habits: { list: async () => [], create: async (h) => h, update: async (h) => h, remove: async () => {} },
    habitLogs: { list: async () => [], upsert: async (l) => l, remove: async () => {}, removeForHabit: async () => {} },
  };

  return {
    repositories,
    calls,
    /** Simula un cambio hecho desde otro dispositivo. */
    setRemote(next: Task[]) {
      tasks = next;
    },
  };
}

const remoteTask = (id: string, title: string): Task => ({
  id,
  title,
  category: "personal",
  priority: "media",
  dueDate: null,
  completed: false,
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
});

function Probe() {
  const { tasks, isReady, addTask, deleteTask } = usePlanner();
  return (
    <div>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="titles">{tasks.map((task) => task.title).join(" | ")}</span>
      <button
        type="button"
        onClick={() =>
          addTask({ title: "Nueva", category: "hogar", priority: "baja", dueDate: null })
        }
      >
        add
      </button>
      <button type="button" onClick={() => tasks[0] && deleteTask(tasks[0].id)}>
        delete
      </button>
    </div>
  );
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  setVisibility("visible");
});

describe("PlannerProvider con repositorios inyectados", () => {
  it("carga desde los repositorios dados y no toca localStorage", async () => {
    const { repositories } = memoryRepositories([remoteTask("1", "Del servidor")]);

    render(
      <PlannerProvider repositories={repositories}>
        <Probe />
      </PlannerProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(screen.getByTestId("titles")).toHaveTextContent("Del servidor");
    expect(window.localStorage.length).toBe(0);
  });

  it("crea y borra a través del repositorio", async () => {
    const { repositories, calls } = memoryRepositories([remoteTask("1", "Existente")]);

    render(
      <PlannerProvider repositories={repositories}>
        <Probe />
      </PlannerProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));

    fireEvent.click(screen.getByText("add"));
    await waitFor(() => expect(calls.create).toBe(1));
    expect(screen.getByTestId("titles")).toHaveTextContent("Existente | Nueva");

    fireEvent.click(screen.getByText("delete"));
    await waitFor(() => expect(calls.remove).toBe(1));
  });

  it("espera a beforeLoad antes de leer y sigue cargando si falla", async () => {
    const memory = memoryRepositories([remoteTask("1", "Antiguo")]);
    const beforeLoad = vi.fn(async () => {
      memory.setRemote([remoteTask("1", "Antiguo"), remoteTask("2", "Importada")]);
    });

    const { unmount } = render(
      <PlannerProvider repositories={memory.repositories} beforeLoad={beforeLoad}>
        <Probe />
      </PlannerProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(beforeLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("titles")).toHaveTextContent("Antiguo | Importada");
    unmount();

    const failing = vi.fn(async () => {
      throw new Error("sin red");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PlannerProvider repositories={memory.repositories} beforeLoad={failing}>
        <Probe />
      </PlannerProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(screen.getByTestId("titles")).toHaveTextContent("Antiguo");
  });
});

describe("sincronización al volver a la app", () => {
  it("recarga los datos tras estar oculta más de 5 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const memory = memoryRepositories([remoteTask("1", "Uno")]);

    render(
      <PlannerProvider repositories={memory.repositories} syncOnFocus>
        <Probe />
      </PlannerProvider>,
    );
    await vi.waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    const loadsBefore = memory.calls.list;

    act(() => setVisibility("hidden"));
    memory.setRemote([remoteTask("1", "Uno"), remoteTask("2", "Hecha en otro dispositivo")]);
    vi.setSystemTime(Date.now() + 6_000);
    act(() => setVisibility("visible"));

    await vi.waitFor(() =>
      expect(screen.getByTestId("titles")).toHaveTextContent("Hecha en otro dispositivo"),
    );
    expect(memory.calls.list).toBeGreaterThan(loadsBefore);
  });

  it("no recarga si la ausencia fue corta", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const memory = memoryRepositories([remoteTask("1", "Uno")]);

    render(
      <PlannerProvider repositories={memory.repositories} syncOnFocus>
        <Probe />
      </PlannerProvider>,
    );
    await vi.waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    const loadsBefore = memory.calls.list;

    act(() => setVisibility("hidden"));
    vi.setSystemTime(Date.now() + 1_000);
    act(() => setVisibility("visible"));

    expect(memory.calls.list).toBe(loadsBefore);
  });

  it("sin syncOnFocus no hace nada", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const memory = memoryRepositories([remoteTask("1", "Uno")]);

    render(
      <PlannerProvider repositories={memory.repositories}>
        <Probe />
      </PlannerProvider>,
    );
    await vi.waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    const loadsBefore = memory.calls.list;

    act(() => setVisibility("hidden"));
    vi.setSystemTime(Date.now() + 60_000);
    act(() => setVisibility("visible"));

    expect(memory.calls.list).toBe(loadsBefore);
  });
});
