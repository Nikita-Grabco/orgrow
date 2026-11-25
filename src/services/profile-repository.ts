import { profileFromRow, type Profile, type ProfileRow } from "@/services/mappers";
import { getSupabaseClient } from "@/services/supabase-client";

/**
 * Perfil del usuario con sesión. RLS solo deja ver la fila propia, así que no
 * hace falta filtrar por id: devuelve la del usuario autenticado.
 *
 * Nunca lanza: si falla (sin red, perfil aún sin crear) la app sigue con el
 * nombre que ya tiene en la sesión y el error queda en la consola.
 */
export async function fetchOwnProfile(): Promise<Profile | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("profiles")
      .select("id, display_name, timezone")
      .maybeSingle<ProfileRow>();

    if (error) throw error;
    return data ? profileFromRow(data) : null;
  } catch (error) {
    console.error("[orgrow] No se pudo cargar el perfil", error);
    return null;
  }
}

export interface ProfileChanges {
  displayName: string;
  timezone: string;
}

/** Zona horaria IANA válida para este navegador ("Europe/Madrid"). */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Guarda nombre y zona horaria del perfil propio. Devuelve un mensaje si falla. */
export async function updateOwnProfile(
  userId: string,
  changes: ProfileChanges,
): Promise<string | null> {
  const displayName = changes.displayName.trim();
  if (displayName.length > 60) return "El nombre admite como máximo 60 caracteres.";
  if (!isValidTimeZone(changes.timezone)) return "La zona horaria no es válida.";

  try {
    const { error } = await getSupabaseClient()
      .from("profiles")
      .update({ display_name: displayName, timezone: changes.timezone })
      .eq("id", userId);
    if (error) throw error;
    return null;
  } catch (error) {
    console.error("[orgrow] No se pudo guardar el perfil", error);
    return "No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.";
  }
}

/** Borra la cuenta y todos sus datos (función `delete_own_account`, ver docs/supabase-account.sql). */
export async function deleteOwnAccount(): Promise<string | null> {
  try {
    const { error } = await getSupabaseClient().rpc("delete_own_account");
    if (error) throw error;
    return null;
  } catch (error) {
    console.error("[orgrow] No se pudo borrar la cuenta", error);
    return "No se pudo borrar la cuenta. Comprueba tu conexión y que has aplicado docs/supabase-account.sql.";
  }
}
