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

import { displayNameFromEmail, initialsFromName } from "@/lib/user";
import { translateAuthError } from "@/services/auth-errors";
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
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function nameFromUser(user: User | null): string {
  if (!user) return "";

  const metadataName = user.user_metadata["full_name"] ?? user.user_metadata["name"];
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }
  // Antes de existir la tabla `profiles` (Parte 3) el email es la única fuente.
  return displayNameFromEmail(user.email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(isSupabaseConfigured, []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    if (!configured) {
      setStatus("anonymous");
      return;
    }

    let active = true;
    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "anonymous");
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[orgadia] No se pudo recuperar la sesión", error);
        setStatus("anonymous");
      });

    // Cubre login, logout, refresco del token y el regreso desde un enlace de email.
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

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
    async (email: string, password: string): Promise<AuthResult> => {
      if (!configured) return { error: "Este dispositivo no tiene configurado el servidor." };
      try {
        const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
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
    try {
      await getSupabaseClient().auth.signOut();
    } catch (error) {
      console.error("[orgadia] No se pudo cerrar la sesión", error);
    }
  }, [configured]);

  const user = session?.user ?? null;
  const displayName = nameFromUser(user);

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
    }),
    [status, configured, user, displayName, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
