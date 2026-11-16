import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseClient,
  getSupabaseConfig,
  isSupabaseConfigured,
  resetSupabaseClient,
  SupabaseConfigError,
} from "@/services/supabase-client";

const URL_OK = "https://proyecto-demo.supabase.co";
const KEY_OK = "sb_publishable_demo";

/** Los valores se inyectan a propósito: los tests no dependen de `.env.local`. */
function stubConfig(url: string, key: string) {
  vi.stubEnv("VITE_SUPABASE_URL", url);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
}

beforeEach(() => {
  resetSupabaseClient();
  stubConfig(URL_OK, KEY_OK);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetSupabaseClient();
});

describe("supabase config", () => {
  it("reads a valid configuration and trims the trailing slash", () => {
    stubConfig(`  ${URL_OK}/  `, ` ${KEY_OK} `);

    expect(getSupabaseConfig()).toEqual({ url: URL_OK, publishableKey: KEY_OK });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("reports every missing variable at once", () => {
    stubConfig("", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseConfig()).toThrow(SupabaseConfigError);
    expect(() => getSupabaseConfig()).toThrow(/VITE_SUPABASE_URL/);
    expect(() => getSupabaseConfig()).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("rejects a URL that is not a Supabase project URL", () => {
    stubConfig("http://localhost:54321", KEY_OK);

    expect(() => getSupabaseConfig()).toThrow(/no parece una URL de Supabase/);
  });

  it("creates the client lazily and reuses the same instance", () => {
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).toBe(second);

    resetSupabaseClient();
    expect(getSupabaseClient()).not.toBe(first);
  });

  it("does not build a client when the environment is missing", () => {
    stubConfig("", "");
    expect(() => getSupabaseClient()).toThrow(SupabaseConfigError);
  });
});
