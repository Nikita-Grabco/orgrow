import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Brand } from "@/components/layout/brand";
import { importLocalDataOnce } from "@/services/local-import";
import { createOfflinePlanner } from "@/services/offline-repositories";
import { getSupabaseClient } from "@/services/supabase-client";
import { syncStatus } from "@/services/sync-status";
import {
  createSupabasePlannerRepositories,
  importPlannerData,
} from "@/services/supabase-repositories";
import { PlannerProvider } from "@/store/planner-store";
import { useAuth } from "@/store/auth-store";

export const ACCESS_PATH = "/acceso";

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      {children}
    </div>
  );
}

/** Mientras se comprueba la sesión guardada. También es lo que renderiza el SSR. */
function AuthSplash() {
  return (
    <CenteredScreen>
      <Brand link={false} surface="background" />
      <p className="animate-pulse text-sm font-medium text-muted-foreground" role="status">
        Cargando tu día…
      </p>
    </CenteredScreen>
  );
}

/** Sin variables de entorno no hay backend: mejor decirlo que fingir que funciona. */
function MissingConfiguration() {
  return (
    <CenteredScreen>
      <Brand link={false} surface="background" />
      <div className="surface max-w-md space-y-3 p-6 text-center">
        <h1 className="font-display font-semibold text-xl text-foreground">
          Falta configurar el servidor
        </h1>
        <p className="text-sm text-muted-foreground">
          Copia <code className="font-semibold text-foreground">.env.example</code> a{" "}
          <code className="font-semibold text-foreground">.env.local</code>, rellena la URL y la
          clave pública de Supabase, y reinicia la aplicación.
        </p>
      </div>
    </CenteredScreen>
  );
}

/**
 * Puerta de la app: decide entre pantalla de acceso, carga y aplicación real.
 *
 * - Sin sesión, cualquier ruta privada redirige a `/acceso`.
 * - Con sesión, `/acceso` redirige al dashboard.
 * - La pantalla de acceso se renderiza sin `AppShell` ni datos del usuario.
 */
export function AuthGate() {
  const { status, configured } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const onAccessPage = pathname === ACCESS_PATH;

  useEffect(() => {
    if (!configured || status === "loading") return;

    if (status === "anonymous" && !onAccessPage) {
      void navigate({ to: ACCESS_PATH, replace: true });
    } else if (status === "authenticated" && onAccessPage) {
      void navigate({ to: "/", replace: true });
    }
  }, [configured, status, onAccessPage, navigate]);

  if (!configured) return <MissingConfiguration />;

  if (onAccessPage) return <Outlet />;

  if (status !== "authenticated") return <AuthSplash />;

  return <AuthenticatedApp />;
}

/**
 * La app con sesión: los datos viven en el servidor (Supabase), protegidos por
 * RLS para la cuenta actual. Al cambiar de cuenta el `key` descarta todo el estado.
 */
function AuthenticatedApp() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Datos en Supabase, con copia en el dispositivo y cola de cambios para cuando no hay red.
  const offline = useMemo(
    () =>
      createOfflinePlanner(
        createSupabasePlannerRepositories(getSupabaseClient()),
        userId ?? "anonymous",
        {
          onDiscard: () =>
            toast.error("Un cambio hecho sin conexión no se pudo guardar y se descartó."),
        },
      ),
    [userId],
  );

  useEffect(() => {
    const stop = offline.start();
    return () => {
      stop();
      syncStatus.reset();
    };
  }, [offline]);

  // Primera vez en este dispositivo: sube lo que el usuario ya tenía guardado en local.
  const importLocalData = useCallback(async () => {
    if (!userId) return;
    try {
      const total = await importLocalDataOnce(userId, (payload) =>
        importPlannerData(getSupabaseClient(), payload),
      );
      if (total > 0) {
        toast.success(`Hemos subido a tu cuenta ${total} elementos guardados en este dispositivo`);
      }
    } catch (error) {
      console.error("[orgrow] No se pudieron importar los datos locales", error);
      toast.error("No se pudieron subir tus datos de este dispositivo. Lo reintentaremos.");
    }
  }, [userId]);

  return (
    <PlannerProvider
      key={userId ?? "anonymous"}
      repositories={offline.repositories}
      beforeLoad={importLocalData}
      syncOnFocus
    >
      <AppShell>
        <Outlet />
      </AppShell>
    </PlannerProvider>
  );
}
