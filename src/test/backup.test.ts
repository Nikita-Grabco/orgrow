import { describe, expect, it } from "vitest";

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_CHARS,
  assignBackupIds,
  backupFileName,
  createBackup,
  parseBackup,
} from "@/lib/backup";
import type { ImportPayload } from "@/services/supabase-repositories";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = 1_700_000_000_000;

const payload: ImportPayload = {
  tasks: [
    { id: UID, title: "Llamar", category: "trabajo", priority: "alta", dueDate: "2026-12-01", time: "09:30", completed: false, remindBefore: 10, createdAt: NOW, updatedAt: NOW },
  ],
  notes: [{ id: "n-1", content: "Idea", kind: "idea", pinned: true, createdAt: NOW }],
  activities: [
    { id: "a-1", title: "Dentista", category: "salud", date: "2026-12-02", start: "10:00", end: "11:00", location: "Centro", remindBefore: 60, createdAt: NOW, updatedAt: NOW },
  ],
  habits: [
    { id: "h-1", name: "Agua", kind: "count", target: 2, step: 0.25, unit: "L", frequency: { type: "daily" }, category: "salud", archived: false, createdAt: NOW, updatedAt: NOW },
  ],
  habitLogs: [{ id: "x", habitId: "h-1", date: "2026-12-01", value: 1.5 }],
};

const roundtrip = (data: unknown = payload, extra: object = {}) =>
  parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, owner: OWNER, data, ...extra }), NOW);

describe("copia de seguridad", () => {
  it("exportar y volver a leer devuelve los mismos datos", () => {
    const file = createBackup(payload, OWNER, new Date("2026-12-05T10:00:00Z"));
    expect(file.exportedAt).toBe("2026-12-05T10:00:00.000Z");
    expect(backupFileName(new Date("2026-12-05T10:00:00Z"))).toBe("orgrow-copia-2026-12-05.json");

    const result = parseBackup(JSON.stringify(file), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.skipped).toBe(0);
    expect(result.backup.owner).toBe(OWNER);
    expect(result.backup.payload.tasks[0]).toMatchObject({ title: "Llamar", time: "09:30", remindBefore: 10 });
    expect(result.backup.payload.habits[0]).toMatchObject({ unit: "L", step: 0.25 });
    expect(result.backup.payload.habitLogs).toHaveLength(1);
  });

  it("rechaza lo que no es una copia de Orgrow", () => {
    expect(parseBackup("no es json").ok).toBe(false);
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "otra-cosa", version: 1, data: {} })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} })).ok).toBe(false);
    expect(parseBackup("x".repeat(MAX_BACKUP_CHARS + 1)).ok).toBe(false);
  });

  it("descarta elementos inválidos y cuenta cuántos, sin perder los buenos", () => {
    const result = roundtrip({
      tasks: [
        ...payload.tasks,
        { id: "t", title: "", category: "trabajo", priority: "alta" },
        { id: "t", title: "x", category: "inventada", priority: "alta" },
        "basura",
        null,
      ],
      notes: [{ id: "n", content: "x".repeat(4001), kind: "idea" }],
      activities: [{ ...payload.activities[0], date: "2026-13-45" }],
      habits: payload.habits,
      habitLogs: [...payload.habitLogs, { habitId: "no-existe", date: "2026-12-01", value: 1 }, { habitId: "h-1", date: "2026-12-01", value: 2 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.payload.tasks).toHaveLength(1);
    expect(result.backup.payload.notes).toHaveLength(0);
    expect(result.backup.payload.activities).toHaveLength(0);
    // 4 tareas inválidas + 1 nota + 1 actividad + 1 registro huérfano + 1 repetido
    expect(result.backup.skipped).toBe(8);
  });

  it("normaliza a las restricciones de la base de datos", () => {
    const result = roundtrip({
      tasks: [{ ...payload.tasks[0], dueDate: null, time: "09:30", remindBefore: 10, completed: false }],
      activities: [{ ...payload.activities[0], end: "09:00", remindBefore: -5 }],
      habits: [
        { ...payload.habits[0], id: "c", kind: "check", target: 9, step: 9, unit: "L" },
        { ...payload.habits[0], id: "bad", target: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { tasks, activities, habits } = result.backup.payload;
    // sin fecha no hay hora ni aviso
    expect(tasks[0]).not.toHaveProperty("time");
    expect(tasks[0]?.remindBefore).toBeNull();
    // fin anterior al inicio se descarta; aviso negativo también
    expect(activities[0]).not.toHaveProperty("end");
    expect(activities[0]?.remindBefore).toBeNull();
    // un hábito de "sí/no" siempre es meta 1 paso 1 y sin unidad; el de meta 0 se descarta
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({ target: 1, step: 1 });
    expect(habits[0]).not.toHaveProperty("unit");
  });

  it("una tarea completada conserva su fecha de completado", () => {
    const result = roundtrip({ tasks: [{ ...payload.tasks[0], completed: true, completedAt: NOW + 5 }] });
    if (!result.ok) throw new Error("debería ser válida");
    expect(result.backup.payload.tasks[0]).toMatchObject({ completed: true, completedAt: NOW + 5 });
  });

  it("ignora un owner que no es uuid", () => {
    const result = roundtrip(payload, { owner: "no-soy-uuid" });
    expect(result.ok && result.backup.owner).toBe(null);
  });
});

describe("assignBackupIds", () => {
  const parse = () => {
    const result = roundtrip();
    if (!result.ok) throw new Error("debería ser válida");
    return result.backup;
  };

  it("en la misma cuenta conserva los ids con forma de uuid (restaurar sin duplicar)", () => {
    const out = assignBackupIds(parse(), OWNER);
    expect(out.tasks[0]?.id).toBe(UID);
    // los que no son uuid se derivan
    expect(out.notes[0]?.id).not.toBe("n-1");
    expect(out.notes[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("en otra cuenta deriva todos los ids de esa cuenta, estables entre importaciones", () => {
    const a = assignBackupIds(parse(), OTHER);
    const b = assignBackupIds(parse(), OTHER);
    expect(a.tasks[0]?.id).not.toBe(UID);
    expect(a).toEqual(b);
    expect(assignBackupIds(parse(), UID).tasks[0]?.id).not.toBe(a.tasks[0]?.id);
  });

  it("los registros de hábito siguen apuntando al hábito con su id nuevo", () => {
    const out = assignBackupIds(parse(), OTHER);
    expect(out.habitLogs[0]?.habitId).toBe(out.habits[0]?.id);
    expect(out.habits[0]?.id).not.toBe("h-1");
  });
});
