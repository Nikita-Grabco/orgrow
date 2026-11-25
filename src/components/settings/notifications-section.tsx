import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import type { PushStatus } from "@/lib/push";

const TEXT: Record<PushStatus, string> = {
  on: "Este dispositivo recibe los avisos de tus tareas y actividades.",
  off: "Los avisos no están activados en este dispositivo.",
  denied: "Los tienes bloqueados en el navegador. Permítelos en los ajustes del sitio para poder activarlos.",
  "needs-install": "En iPhone y iPad primero instala Orgrow en la pantalla de inicio y ábrela desde ahí.",
  unsupported: "Este navegador no puede recibir avisos (en desarrollo tampoco: solo en la app desplegada).",
  unconfigured: "Los recordatorios no están configurados en esta instalación.",
};

export function NotificationsSection() {
  const { status, busy, error, enable, disable } = usePushNotifications();

  return (
    <SettingsSection title="Avisos" description="Recordatorios en este dispositivo. Cada dispositivo se activa por separado.">
      <p className="text-sm text-foreground">{status ? TEXT[status] : "Comprobando…"}</p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      {status === "off" && (
        <Button disabled={busy} onClick={() => void enable()}>
          Activar avisos
        </Button>
      )}
      {status === "on" && (
        <Button variant="outline" disabled={busy} onClick={() => void disable()}>
          Desactivar en este dispositivo
        </Button>
      )}
    </SettingsSection>
  );
}
