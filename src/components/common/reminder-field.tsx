import { Bell } from "lucide-react";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { DEFAULT_REMINDER_TIME, REMINDER_OPTIONS } from "@/config/reminders";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { isPushConfigured } from "@/services/push-service";

interface ReminderFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Sin fecha no hay a qué hora avisar: se explica en vez de ofrecer opciones. */
  hasDate: boolean;
  /** Una tarea sin hora se avisa a una hora fija (`DEFAULT_REMINDER_TIME`). */
  hasTime: boolean;
}

/**
 * "Avisarme": cuánto antes recibir una notificación. No se muestra si la
 * instalación no tiene recordatorios configurados, para no ofrecer algo que no
 * funciona.
 */
export function ReminderField({ value, onChange, hasDate, hasTime }: ReminderFieldProps) {
  const { status, busy, enable } = usePushNotifications();
  if (!isPushConfigured()) return null;

  return (
    <div className="space-y-2">
      <p className="eyebrow">Avisarme</p>

      {hasDate ? (
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((option) => (
            <Chip
              key={String(option.value)}
              selected={value === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.value !== null && <Bell className="size-3" aria-hidden />}
              {option.label}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Elige un día para poder recibir un aviso.</p>
      )}

      {hasDate && value !== null && !hasTime && (
        <p className="text-xs text-muted-foreground">
          Sin hora, el aviso llega a las {DEFAULT_REMINDER_TIME} (restando lo que elijas).
        </p>
      )}

      {value !== null && status === "off" && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Los avisos aún no están activados en este dispositivo.
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void enable()}
          >
            Activar avisos
          </Button>
        </p>
      )}
      {value !== null && status === "needs-install" && (
        <p className="text-xs text-muted-foreground">
          En iPhone y iPad hay que instalar Orgrow en la pantalla de inicio para recibir avisos.
        </p>
      )}
      {value !== null && status === "denied" && (
        <p className="text-xs text-muted-foreground">
          Los avisos están bloqueados en el navegador. Actívalos en los ajustes del sitio.
        </p>
      )}
    </div>
  );
}
