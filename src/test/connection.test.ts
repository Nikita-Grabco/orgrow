import { describe, expect, it } from "vitest";

import { connectionMessage } from "@/lib/connection";

describe("connectionMessage", () => {
  it("no dice nada cuando todo está sincronizado", () => {
    expect(connectionMessage({ online: true, pending: 0, syncing: false })).toBeNull();
  });

  it("avisa de que no hay conexión y de lo pendiente, en singular y plural", () => {
    expect(connectionMessage({ online: false, pending: 0, syncing: false })).toMatch(/Sin conexión/);
    expect(connectionMessage({ online: false, pending: 1, syncing: false })).toBe(
      "Sin conexión · 1 cambio pendiente de enviar",
    );
    expect(connectionMessage({ online: false, pending: 3, syncing: false })).toBe(
      "Sin conexión · 3 cambios pendientes de enviar",
    );
  });

  it("con red distingue entre enviando y reintentando", () => {
    expect(connectionMessage({ online: true, pending: 2, syncing: true })).toBe("Enviando 2 cambios…");
    expect(connectionMessage({ online: true, pending: 1, syncing: false })).toBe(
      "1 cambio sin enviar · reintentando",
    );
  });
});
