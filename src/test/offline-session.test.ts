import { describe, expect, it } from "vitest";

import { parseStoredSession } from "@/services/offline-session";

const VALID = {
  access_token: "a",
  refresh_token: "r",
  expires_at: 1,
  user: { id: "u1", email: "a@b.c", user_metadata: { full_name: "Nikita" } },
};

describe("parseStoredSession", () => {
  it("recupera una sesión guardada válida", () => {
    const session = parseStoredSession(JSON.stringify(VALID));
    expect(session?.user.id).toBe("u1");
    expect(session?.user.user_metadata["full_name"]).toBe("Nikita");
  });

  it("rechaza lo que no sea una sesión utilizable", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession("")).toBeNull();
    expect(parseStoredSession("{no es json")).toBeNull();
    expect(parseStoredSession("null")).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...VALID, refresh_token: "" }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...VALID, user: {} }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ refresh_token: "r" }))).toBeNull();
  });
});
