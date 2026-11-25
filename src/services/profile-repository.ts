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
