import { beforeEach, describe, expect, it } from "vitest";

import { applyTaskPatch, groupTasksByDate } from "@/lib/planner";
import type { Task } from "@/types/planner";

const today = new Date(2026, 10, 16);

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    category: "personal",
    priority: "media",
    dueDate: "2026-11-16",
    completed: false,
    completedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("groupTasksByDate", () => {
  it("orders overdue, dated groups and undated tasks", () => {
    const groups = groupTasksByDate(
      [
        makeTask({ id: "a", title: "Atrasada", dueDate: "2026-11-14" }),
        makeTask({ id: "b", title: "Hoy", dueDate: "2026-11-16" }),
        makeTask({ id: "c", title: "Sin fecha", dueDate: null }),
        makeTask({
          id: "d",
          title: "Hecha ayer",
          dueDate: "2026-11-15",
          completed: true,
          completedAt: 1,
        }),
      ],
      today,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "2026-11-15",
      "2026-11-16",
      "undated",
    ]);
    expect(groups[0]?.label).toBe("Atrasadas");
    expect(groups[0]?.tone).toBe("overdue");
    expect(groups.at(-1)?.label).toBe("Sin fecha");
  });

  it("keeps completed past tasks out of the overdue group", () => {
    const groups = groupTasksByDate(
      [makeTask({ id: "a", title: "Hecha", dueDate: "2026-11-10", completed: true })],
      today,
    );

    expect(groups.some((group) => group.tone === "overdue")).toBe(false);
    expect(groups).toHaveLength(1);
  });

  it("groups every task by date when today is unknown (server render)", () => {
    const groups = groupTasksByDate(
      [
        makeTask({ id: "a", title: "Una", dueDate: "2026-11-14" }),
        makeTask({ id: "b", title: "Otra", dueDate: "2026-11-16" }),
      ],
      null,
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-11-14", "2026-11-16"]);
  });
});

describe("applyTaskPatch", () => {
  it("keeps untouched fields and bumps updatedAt", () => {
    const task = makeTask({ id: "a", title: "Original", time: "09:00", updatedAt: 1 });

    const updated = applyTaskPatch(task, { completed: true, completedAt: 99 });

    expect(updated.completed).toBe(true);
    expect(updated.completedAt).toBe(99);
    expect(updated.title).toBe("Original");
    expect(updated.time).toBe("09:00");
    expect(updated.dueDate).toBe("2026-11-16");
    expect(updated.updatedAt).toBeGreaterThan(1);
  });

  it("can clear the due date explicitly", () => {
    const task = makeTask({ id: "a", title: "Con fecha" });
    expect(applyTaskPatch(task, { dueDate: null }).dueDate).toBeNull();
  });
});
