import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DangerSection } from "@/components/settings/danger-section";
import { clearAllLocalData, offlineKeys } from "@/services/offline-repositories";
import { isValidTimeZone } from "@/services/profile-repository";

const deleteAccount = vi.fn();
const signOut = vi.fn();

vi.mock("@/store/auth-store", () => ({
  useAuth: () => ({ deleteAccount, signOut }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("zona horaria", () => {
  it("acepta zonas IANA y rechaza el resto", () => {
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("clearAllLocalData", () => {
  it("borra copia, cola e importación de esa cuenta y no toca otras", () => {
    window.localStorage.clear();
    const keys = offlineKeys("u1");
    window.localStorage.setItem(keys.cache, "x");
    window.localStorage.setItem(keys.outbox, "x");
    window.localStorage.setItem("orgrow:v1:imported:u1", "x");
    window.localStorage.setItem(offlineKeys("u2").cache, "otra");

    clearAllLocalData("u1", window.localStorage);

    expect(window.localStorage.getItem(keys.cache)).toBeNull();
    expect(window.localStorage.getItem(keys.outbox)).toBeNull();
    expect(window.localStorage.getItem("orgrow:v1:imported:u1")).toBeNull();
    expect(window.localStorage.getItem(offlineKeys("u2").cache)).toBe("otra");
  });
});

describe("borrar la cuenta", () => {
  beforeEach(() => {
    deleteAccount.mockReset();
    signOut.mockReset();
  });

  async function openDialog() {
    render(<DangerSection />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar mi cuenta" }));
    return await screen.findByLabelText("Escribe ELIMINAR para confirmar");
  }

  it("no se puede confirmar sin escribir ELIMINAR", async () => {
    const input = await openDialog();
    const confirm = screen.getByRole("button", { name: "Borrar para siempre" });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "eliminar" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "ELIMINAR" } });
    expect(confirm).toBeEnabled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("al confirmar borra la cuenta", async () => {
    deleteAccount.mockResolvedValue(null);
    const input = await openDialog();
    fireEvent.change(input, { target: { value: "ELIMINAR" } });
    fireEvent.click(screen.getByRole("button", { name: "Borrar para siempre" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it("si falla, el diálogo sigue abierto para reintentar", async () => {
    deleteAccount.mockResolvedValue("No se pudo borrar la cuenta.");
    const input = await openDialog();
    fireEvent.change(input, { target: { value: "ELIMINAR" } });
    fireEvent.click(screen.getByRole("button", { name: "Borrar para siempre" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    expect(screen.getByLabelText("Escribe ELIMINAR para confirmar")).toBeInTheDocument();
  });
});
