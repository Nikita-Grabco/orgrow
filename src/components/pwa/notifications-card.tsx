import { Bell, BellOff, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const DISMISSED_KEY = "orgrow:v1:notifications-card-dismissed";

/**
 * Invita a activar los avisos de los recordatorios en este dispositivo. Solo
 * aparece cuando hay algo que hacer: activarlos, instalar la app (iPhone/iPad) o
 * desbloquearlos en el navegador. Se puede descartar.
 */
export function NotificationsCard() {
  const { status, busy, error, enable } = usePushNotifications();
  // Oculta hasta leer el almacenamiento: así no parpadea para quien ya la descartó.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) !== null);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;
  if (status !== "off" && status !== "needs-install" && status !== "denied") return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Sin almacenamiento solo se oculta hasta recargar.
    }
    setDismissed(true);
  }

  const Icon = status === "denied" ? BellOff : Bell;

  return (
    <section className="surface relative flex items-start gap-4 p-4 pr-12 sm:items-center sm:p-5 sm:pr-14">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-foreground">Recibe avisos de tus tareas y citas</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {status === "off" && "Te avisamos a la hora que elijas, aunque tengas la app cerrada."}
          {status === "needs-install" &&
            "En iPhone y iPad primero instala Orgrow en la pantalla de inicio y ábrela desde ahí."}
          {status === "denied" &&
            "Los tienes bloqueados en el navegador. Para recibirlos, permítelos en los ajustes del sitio."}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>

      {status === "off" && (
        <Button size="sm" disabled={busy} onClick={() => void enable()} className="shrink-0">
          Activar avisos
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="No volver a mostrar"
        className="absolute right-2 top-2"
        onClick={dismiss}
      >
        <X />
      </Button>
    </section>
  );
}
