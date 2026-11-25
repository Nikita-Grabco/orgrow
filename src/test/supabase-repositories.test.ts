import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  createSupabaseHabitLogsRepository,
  createSupabaseNotesRepository,
  createSupabaseTasksRepository,
  importPlannerData,
} from "@/services/supabase-repositories";
import type { TaskRow } from "@/services/mappers";
import type { Task } from "@/types/planner";

interface Call {
  table: string;
  ops: Array<[string, unknown[]]>;
}

interface Reply {
  data?: unknown;
  error?: { message: string } | null;
}

/**
 * Cliente falso: apunta cada llamada encadenada (`from().select().eq()…`) y
 * responde lo que decida `respond`. Basta para comprobar qué se le pide a la
 * base de datos sin levantar ninguna.
 */
function fakeClient(respond: (call: Call) => Reply = () => ({ data: null })) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);

      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                const reply = respond(call);
                Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null }).then(
                  resolve,
                  reject,
                );
              };
            }
            return (...args: unknown[]) => {
              call.ops.push([String(prop), args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

const opsOf = (call: Call, name: string) => call.ops.filter(([op]) => op === name);

const TASK_ROW: TaskRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Comprar pan",
  category: "hogar",
  priority: "baja",
  due_date: "2026-11-26",
  due_time: "09:00:00",
  completed: false,
  completed_at: null,
  created_at: "2026-11-20T08:00:00.000Z",
  updated_at: "2026-11-20T08:00:00.000Z",
};

const TASK: Task = {
  id: TASK_ROW.id,
  title: "Comprar pan",
  category: "hogar",
  priority: "baja",
  dueDate: "2026-11-26",
  time: "09:00",
  completed: false,
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

describe("repositorio de tareas en Supabase", () => {
  it("lista y traduce las filas, con orden estable", async () => {
    const { client, calls } = fakeClient(() => ({ data: [TASK_ROW] }));

    const tasks = await createSupabaseTasksRepository(client).list();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: TASK_ROW.id, dueDate: "2026-11-26", time: "09:00" });
    expect(calls[0]?.table).toBe("tasks");
    expect(opsOf(calls[0]!, "order").map(([, args]) => (args[0] as string))).toEqual([
      "created_at",
      "id",
    ]);
  });

  it("pagina cuando hay más de 1000 filas", async () => {
    const page = Array.from({ length: 1000 }, (_, index) => ({
      ...TASK_ROW,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));
    const { client, calls } = fakeClient((call) => {
      const [, args] = opsOf(call, "range")[0]!;
      return { data: args[0] === 0 ? page : [TASK_ROW] };
    });

    const tasks = await createSupabaseTasksRepository(client).list();

    expect(tasks).toHaveLength(1001);
    expect(calls).toHaveLength(2);
    expect(opsOf(calls[1]!, "range")[0]![1]).toEqual([1000, 1999]);
  });

  it("crea enviando el id del cliente y sin user_id", async () => {
    const { client, calls } = fakeClient(() => ({ data: TASK_ROW }));

    const created = await createSupabaseTasksRepository(client).create(TASK);

    const [, [payload]] = opsOf(calls[0]!, "insert")[0]!;
    expect(payload).toMatchObject({ id: TASK.id, title: "Comprar pan", due_time: "09:00" });
    expect(payload).not.toHaveProperty("user_id");
    expect(created.id).toBe(TASK.id);
  });

  it("al completar envía completed y completed_at", async () => {
    const { client, calls } = fakeClient(() => ({ data: TASK_ROW }));
    const at = Date.parse("2026-11-25T10:00:00.000Z");

    await createSupabaseTasksRepository(client).update({ ...TASK, completed: true, completedAt: at });

    expect(opsOf(calls[0]!, "update")[0]![1][0]).toMatchObject({
      completed: true,
      completed_at: "2026-11-25T10:00:00.000Z",
    });
    expect(opsOf(calls[0]!, "eq")[0]![1]).toEqual(["id", TASK.id]);
  });

  it("editar una tarea que ya no existe lanza error (el store recarga)", async () => {
    const { client } = fakeClient(() => ({ data: null }));

    await expect(createSupabaseTasksRepository(client).update(TASK)).rejects.toThrow(
      /No existe la tarea/,
    );
  });

  it("convierte los errores de la base de datos en Error", async () => {
    const { client } = fakeClient(() => ({ error: { message: "permission denied" } }));
    const repo = createSupabaseTasksRepository(client);

    await expect(repo.list()).rejects.toThrow("permission denied");
    await expect(repo.remove(TASK.id)).rejects.toBeInstanceOf(Error);
  });

  it("borra por id", async () => {
    const { client, calls } = fakeClient();

    await createSupabaseTasksRepository(client).remove(TASK.id);

    expect(opsOf(calls[0]!, "delete")).toHaveLength(1);
    expect(opsOf(calls[0]!, "eq")[0]![1]).toEqual(["id", TASK.id]);
  });
});

describe("repositorio de notas en Supabase", () => {
  it("ordena de más reciente a más antigua", async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));

    await createSupabaseNotesRepository(client).list();

    expect(opsOf(calls[0]!, "order")[0]![1]).toEqual(["created_at", { ascending: false }]);
  });
});

describe("repositorio de registros de hábito en Supabase", () => {
  it("guarda por hábito y día, reemplazando si ya existe", async () => {
    const { client, calls } = fakeClient(() => ({
      data: { id: "uuid", habit_id: "h1", log_date: "2026-11-25", value: 2 },
    }));

    const saved = await createSupabaseHabitLogsRepository(client).upsert({
      id: "h1:2026-11-25",
      habitId: "h1",
      date: "2026-11-25",
      value: 2,
    });

    const [, [payload, options]] = opsOf(calls[0]!, "upsert")[0]!;
    expect(payload).toEqual({ habit_id: "h1", log_date: "2026-11-25", value: 2 });
    expect(options).toEqual({ onConflict: "habit_id,log_date" });
    expect(saved.id).toBe("h1:2026-11-25");
  });

  it("borra descomponiendo el id en hábito y día", async () => {
    const { client, calls } = fakeClient();

    await createSupabaseHabitLogsRepository(client).remove("abc-123:2026-11-25");

    expect(opsOf(calls[0]!, "eq").map(([, args]) => args)).toEqual([
      ["habit_id", "abc-123"],
      ["log_date", "2026-11-25"],
    ]);
  });
});

describe("importación de datos", () => {
  it("sube cada tabla con upsert, hábitos antes que sus registros, y omite las vacías", async () => {
    const { client, calls } = fakeClient();

    await importPlannerData(client, {
      tasks: [
        { ...TASK, completed: false, completedAt: 99 },
        { ...TASK, id: "t2", completed: true, completedAt: 1000 },
      ],
      notes: [],
      activities: [],
      habits: [
        {
          id: "h1",
          name: "Leer",
          kind: "time",
          target: 60,
          step: 15,
          frequency: { type: "daily" },
          category: "personal",
          archived: false,
          createdAt: 5,
          updatedAt: 5,
        },
      ],
      habitLogs: [{ id: "h1:2026-11-25", habitId: "h1", date: "2026-11-25", value: 30 }],
    });

    expect(calls.map((call) => call.table)).toEqual(["tasks", "habits", "habit_logs"]);

    const [, [rows, options]] = opsOf(calls[0]!, "upsert")[0]!;
    expect(options).toEqual({ onConflict: "id" });
    // completed_at solo existe en tareas completadas (lo exige un CHECK).
    expect((rows as Array<Record<string, unknown>>).map((row) => row["completed_at"])).toEqual([
      null,
      "1970-01-01T00:00:01.000Z",
    ]);
    expect(opsOf(calls[2]!, "upsert")[0]![1][1]).toEqual({ onConflict: "habit_id,log_date" });
  });

  it("si la base de datos rechaza algo, falla en voz alta", async () => {
    const { client } = fakeClient(() => ({ error: { message: "violates check constraint" } }));

    await expect(
      importPlannerData(client, {
        tasks: [TASK],
        notes: [],
        activities: [],
        habits: [],
        habitLogs: [],
      }),
    ).rejects.toThrow("violates check constraint");
  });
});
