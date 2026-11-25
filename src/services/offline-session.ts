import type { Session } from "@supabase/supabase-js";

/**
 * Sesión guardada en este dispositivo, para abrir la app sin conexión.
 *
 * Con el token de acceso caducado (dura una hora) y sin red, `getSession()` no
 * puede renovarlo y devuelve "sin sesión", aunque el usuario siga conectado: la
 * sesión sigue guardada y se renovará sola al volver la red. Sin esto, abrir la
 * app sin conexión pasada la primera hora mandaría a la pantalla de acceso.
 *
 * Esta sesión solo sirve para mostrar la app y sus datos locales: cualquier
 * llamada al servidor sigue necesitando un token válido.
 */

/** Misma clave que `storageKey` en `supabase-client.ts`. */
export const AUTH_STORAGE_KEY = "orgadia:auth";

export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    const user = parsed?.user;
    if (
      !parsed ||
      typeof parsed.refresh_token !== "string" ||
      !parsed.refresh_token ||
      !user ||
      typeof user.id !== "string" ||
      !user.id
    ) {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredSession(window.localStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return null;
  }
}
