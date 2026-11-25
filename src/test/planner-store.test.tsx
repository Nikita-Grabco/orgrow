import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { clearCollection, STORAGE_KEYS } from "@/services/planner-storage";
import { PlannerProvider, usePlanner } from "@/store/planner-store";

beforeEach(() => {
  window.localStorage.clear();
  clearCollection(STORAGE_KEYS.tasks);
  clearCollection(STORAGE_KEYS.notes);
});

/** Minimal consumer so the test exercises the real provider, not a mock. */
function Probe() {
  const { tasks, isReady, addTask, editTask, toggleTask } = usePlanner();
  const first = tasks[0];

  return (
    <div>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="count">{tasks.length}</span>
      <span data-testid="titles">{tasks.map((task) => task.title).join(" | ")}</span>
      <button
        type="button"
        onClick={() =>
          addTask({
            title: "Tarea persistente",
            category: "personal",
            priority: "media",
            dueDate: "2030-01-01",
          })
        }
      >
        add
      </button>
      <button
        type="button"
        disabled={!first}
        onClick={() => first && editTask(first.id, { title: "Editada" })}
      >
        edit
      </button>
      <button type="button" disabled={!first} onClick={() => first && toggleTask(first.id)}>
        toggle
      </button>
    </div>
  );
}

function renderApp() {
  return render(
    <PlannerProvider>
      <Probe />
    </PlannerProvider>,
  );
}

async function waitUntilReady() {
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
}

describe("planner store", () => {
  it("hydrates saved tasks and keeps them after remounting (reload)", async () => {
    const first = renderApp();
    await waitUntilReady();

    const seeded = Number(screen.getByTestId("count").textContent);
    expect(seeded).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("add"));
    await waitFor(() => expect(Number(screen.getByTestId("count").textContent)).toBe(seeded + 1));

    first.unmount();

    renderApp();
    await waitUntilReady();

    expect(Number(screen.getByTestId("count").textContent)).toBe(seeded + 1);
    expect(screen.getByTestId("titles").textContent).toContain("Tarea persistente");
  });

  it("persists edits and completion toggles", async () => {
    const first = renderApp();
    await waitUntilReady();

    fireEvent.click(screen.getByText("edit"));
    await waitFor(() => expect(screen.getByTestId("titles").textContent).toContain("Editada"));

    fireEvent.click(screen.getByText("toggle"));
    await waitFor(() => expect(screen.getByText("toggle")).toBeEnabled());

    first.unmount();

    renderApp();
    await waitUntilReady();
    expect(screen.getByTestId("titles").textContent).toContain("Editada");
  });
});
