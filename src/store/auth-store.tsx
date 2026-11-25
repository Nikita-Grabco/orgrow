import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { initialsFromName, resolveDisplayName } from "@/lib/user";
import { translateAuthError } from "@/services/auth-errors";
import type { Profile } from "@/services/mappers";
import { clearAllLocalData, clearOfflineCache, isRetryableError } from "@/services/offline-repositories";
import { readStoredSession } from "@/services/offline-session";
import {
  deleteOwnAccount,
  fetchOwnProfile,
  updateOwnProfile,
  type ProfileChanges,
} from "@/services/profile-repository";
import { disablePush } from "@/services/push-service";
import { getSupabaseClient, isSupabaseConfigured } from "@/services/supabase-client";

/**
 * Sesión y cuenta.
 *
 * `status` arranca en "loading" siempre (también en el servidor) para que el
 * primer render del cliente coincida con el HTML del servidor; la sesión se
 * resuelve después, en `useEffect`.
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthResult {
  error: string | null;
  /** El registro fue correcto pero falta confirmar el email. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  /** False si faltan las variables de entorno del backend. */
  configured: boolean;
  user: User | null;
  email: string | null;
  displayName: string;
  initials: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Zona horaria del perfil (de la que depende la hora de los avisos). */
  timezone: string | null;
  /** Nombre guardado en el perfil (puede estar vacío: entonces se usa el de la sesión). */
  profileName: string;
  updateProfile: (changes: ProfileChanges) => Promise<string | null>;
  /** Borra la cuenta y todos sus datos. Devuelve un mensaje si falla. */
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function nameFromUser(user: User | null, profile: Profile | null): string {
  if (!user) return "";

  const metadataName = user.user_metadata["full_name"] ?? user.user_metadata["name"];
  // El perfil manda; mientras carga (o si falla) sirve el nickname de la sesión.
  return resolveDisplayName(
    profile?.displayName,
    typeof metadataName === "string" ? metadataName : null,
    user.email,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(isSupabaseConfigured, []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!configured) {
      setStatus("anonymous");
      return;
    }

    let active = true;
    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        // Sin red no se puede renovar un token caducado, pero la sesión sigue ahí:
        // se abre la app con ella (lo que se vea saldrá de la copia del dispositivo)
        // y Supabase la renueva solo al volver la conexión.
        const session =
          data.session ?? (error && isRetryableError(error) ? readStoredSession() : null);

        setSession(session);
        setStatus(session ? "authenticated" : "anonymous");
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[orgrow] No se pudo recuperar la sesión", error);
        setStatus("anonymous");
      });

    // Cubre login, logout, refresco del token y el regreso desde un enlace de email.
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      // El estado inicial lo decide `getSession()` (con su respaldo sin conexión);
      // un INITIAL_SESSION vacío no debe deshacerlo.
      if (event === "INITIAL_SESSION" && !nextSession) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const userId = session?.user.id ?? null;

  // Carga el perfil al iniciar sesión y lo descarta al cerrarla o cambiar de cuenta.
  useEffect(() => {
    if (!configured || !userId) {
      setProfile(null);
      return;
    }

    let active = true;
    void fetchOwnProfile().then((loaded) => {
      if (active) setProfile(loaded);
    });
    return () => {
      active = false;
    };
  }, [configured, userId]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!configured) return { error: "Este dispositivo no tiene configurado el servidor." };
      try {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
        return { error: error ? translateAuthError(error) : null };
      } catch (error) {
        return { error: translateAuthError(error) };
      }
    },
    [configured],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
      if (!configured) return { error: "Este dispositivo no tiene configurado el servidor." };
      try {
        const cleanName = fullName?.trim() ?? "";
        const { data, error } = await getSupabaseClient().auth.signUp({
          email,
          password,
          // `full_name` acaba en `raw_user_meta_data` y es el nombre que se
          // muestra en la app hasta que carga `profiles`, que lo recibe por trigger.
          ...(cleanName ? { options: { data: { full_name: cleanName } } } : {}),
        });
        if (error) return { error: translateAuthError(error) };
        // Sin sesión = el proyecto exige confirmar el email antes de entrar.
        return { error: null, needsConfirmation: !data.session };
      } catch (error) {
        return { error: translateAuthError(error) };
      }
    },
    [configured],
  );

  const signOut = useCallback(async () => {
    if (!configured) return;

    // La copia de datos de este dispositivo es de esta cuenta: se borra al salir.
    // Lo que aún no se envió se conserva y se enviará al volver a entrar.
    const leavingUserId = session?.user.id;
    if (leavingUserId) clearOfflineCache(leavingUserId);

    // Este dispositivo deja de recibir los avisos de la cuenta que se va. Si no hay red
    // no se puede borrar el registro del servidor, pero el navegador ya queda dado de baja
    // y el servidor lo descarta solo al ver que el aviso no llega.
    await disablePush();

    try {
      const { error } = await getSupabaseClient().auth.signOut();
      // Sin red el servidor no puede revocar la sesión; al menos se cierra aquí.
      if (error) await getSupabaseClient().auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("[orgrow] No se pudo cerrar la sesión", error);
    }
  }, [configured, session]);

  const updateProfile = useCallback(
    async (changes: ProfileChanges): Promise<string | null> => {
      if (!configured || !userId) return "Inicia sesión para guardar el perfil.";
      const error = await updateOwnProfile(userId, changes);
      if (!error) setProfile({ id: userId, displayName: changes.displayName.trim(), timezone: changes.timezone });
      return error;
    },
    [configured, userId],
  );

  const deleteAccount = useCallback(async (): Promise<string | null> => {
    if (!configured || !userId) return "Inicia sesión para borrar la cuenta.";
    const error = await deleteOwnAccount();
    if (error) return error;

    // La cuenta ya no existe: fuera también lo que quedaba en este dispositivo.
    await disablePush();
    clearAllLocalData(userId);
    try {
      await getSupabaseClient().auth.signOut({ scope: "local" });
    } catch (signOutError) {
      console.error("[orgrow] No se pudo cerrar la sesión local", signOutError);
    }
    return null;
  }, [configured, userId]);

  const user = session?.user ?? null;
  const displayName = nameFromUser(user, profile);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      configured,
      user,
      email: user?.email ?? null,
      displayName: displayName || "Tu cuenta",
      initials: initialsFromName(displayName || "?"),
      signIn,
      signUp,
      signOut,
      timezone: profile?.timezone ?? null,
      profileName: profile?.displayName ?? "",
      updateProfile,
      deleteAccount,
    }),
    [status, configured, user, displayName, signIn, signUp, signOut, profile, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
