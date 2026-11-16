import { describe, expect, it } from "vitest";

import { displayNameFromEmail, initialsFromName, FALLBACK_NAME } from "@/lib/user";
import { translateAuthError } from "@/services/auth-errors";

describe("displayNameFromEmail", () => {
  it("builds a readable name from the email", () => {
    expect(displayNameFromEmail("nikita.grabco@mail.com")).toBe("Nikita Grabco");
    expect(displayNameFromEmail("nikita_grabco@mail.com")).toBe("Nikita Grabco");
    expect(displayNameFromEmail("nikita-grabco@mail.com")).toBe("Nikita Grabco");
    expect(displayNameFromEmail("nikita+orgadia@mail.com")).toBe("Nikita Orgadia");
  });

  it("falls back when there is no usable email", () => {
    expect(displayNameFromEmail(null)).toBe(FALLBACK_NAME);
    expect(displayNameFromEmail(undefined)).toBe(FALLBACK_NAME);
    expect(displayNameFromEmail("")).toBe(FALLBACK_NAME);
    expect(displayNameFromEmail("@mail.com")).toBe(FALLBACK_NAME);
  });
});

describe("initialsFromName", () => {
  it("uses the first and last word", () => {
    expect(initialsFromName("Nikita Grabco")).toBe("NG");
    expect(initialsFromName("Nikita Garcia Grabco")).toBe("NG");
  });

  it("uses two letters for a single word and degrades gracefully", () => {
    expect(initialsFromName("Nikita")).toBe("NI");
    expect(initialsFromName("   ")).toBe("?");
  });
});

describe("translateAuthError", () => {
  it("explains wrong credentials in Spanish", () => {
    expect(translateAuthError({ message: "Invalid login credentials" })).toBe(
      "Email o contraseña incorrectos.",
    );
  });

  it("explains an unconfirmed email", () => {
    expect(translateAuthError({ message: "Email not confirmed" })).toMatch(/confirmado/);
  });

  it("explains an existing account", () => {
    expect(translateAuthError({ message: "User already registered" })).toMatch(/Ya existe/);
  });

  it("explains rate limits and network failures", () => {
    expect(translateAuthError({ message: "Email rate limit exceeded" })).toMatch(/Demasiados/);
    expect(translateAuthError({ message: "TypeError: fetch failed" })).toMatch(/conexión/);
  });

  it("never leaks the original message for unknown errors", () => {
    const message = translateAuthError({ message: "some internal pg detail" });
    expect(message).not.toContain("pg detail");
    expect(message).toMatch(/Inténtalo de nuevo/);
    expect(translateAuthError(null)).toMatch(/Inténtalo de nuevo/);
  });
});
