import { useState } from "react";

import { Chip } from "@/components/common/chip";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { REMINDER_OPTIONS } from "@/config/reminders";
import { readDefaultReminder, writeDefaultReminder } from "@/lib/default-reminder";
import type { PushStatus } from "@/lib/push";
import { isPushConfigured } from "@/services/push-service";

const TEXT: Record<PushStatus, string> = {
  on: "Este dispositivo recibe los avisos de tus tareas y actividades.",
  off: "Los avisos no están activados en este dispositivo.",
  denied:
    "Los tienes bloqueados en el navegador. Permítelos en los ajustes del sitio para poder activarlos.",
  "needs-install":
    "En iPhone y iPad primero instala Orgrow en la pantalla de inicio y ábrela desde ahí.",
  unsupported:
    "Este navegador no puede recibir avisos (en desarrollo tampoco: solo en la app desplegada).",
  unconfigured: "Los recordatorios no están configurados en esta instalación.",
};

export function NotificationsSection() {
  const { status, busy, error, enable, disable } = usePushNotifications();
  const [defaultReminder, setDefaultReminder] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readDefaultReminder(window.localStorage),
  );

  function chooseDefault(minutes: number | null) {
    writeDefaultReminder(window.localStorage, minutes);
    setDefaultReminder(minutes);
  }

  return (
    <SettingsSection
      title="Avisos"
      description="Recordatorios en este dispositivo. Cada dispositivo se activa por separado."
    >
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
      {isPushConfigured() && (
        <div className="space-y-2">
          <p className="eyebrow">Avisarme por defecto</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Aviso por defecto">
            {REMINDER_OPTIONS.map((option) => (
              <Chip
                key={String(option.value)}
                selected={defaultReminder === option.value}
                onClick={() => chooseDefault(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Se aplica a las tareas y actividades nuevas en este dispositivo; luego puedes cambiarlo
            en cada una. Las tareas con fecha pero sin hora avisan a las 09:00.
          </p>
        </div>
      )}
    </SettingsSection>
  );
}
