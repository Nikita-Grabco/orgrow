import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_KEY,
  readDefaultReminder,
  writeDefaultReminder,
} from "@/lib/default-reminder";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("aviso por defecto", () => {
  it("sin valor guardado no hay aviso", () => {
    expect(readDefaultReminder(memoryStorage())).toBeNull();
    expect(readDefaultReminder(null)).toBeNull();
  });

  it("guarda y lee minutos, incluido 0 ('a la hora')", () => {
    const storage = memoryStorage();
    writeDefaultReminder(storage, 60);
    expect(readDefaultReminder(storage)).toBe(60);
    writeDefaultReminder(storage, 0);
    expect(readDefaultReminder(storage)).toBe(0);
  });

  it("'sin aviso' borra el valor", () => {
    const storage = memoryStorage({ [DEFAULT_REMINDER_KEY]: "1440" });
    writeDefaultReminder(storage, null);
    expect(storage.data.has(DEFAULT_REMINDER_KEY)).toBe(false);
    expect(readDefaultReminder(storage)).toBeNull();
  });

  it("ignora valores corruptos o fuera de rango", () => {
    for (const bad of ["abc", "-5", "10081", "1.5", ""]) {
      expect(readDefaultReminder(memoryStorage({ [DEFAULT_REMINDER_KEY]: bad }))).toBeNull();
    }
  });
});
