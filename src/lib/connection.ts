import type { SyncStatus } from "@/services/sync-status";

/** Texto del aviso de conexión, o `null` si todo está al día y no hay que decir nada. */
export function connectionMessage({ online, pending, syncing }: SyncStatus): string | null {
  const changes = `${pending} ${pending === 1 ? "cambio" : "cambios"}`;

  if (!online) {
    return pending > 0
      ? `Sin conexión · ${changes} pendiente${pending === 1 ? "" : "s"} de enviar`
      : "Sin conexión · puedes seguir usando la app, se guardará al volver";
  }
  if (pending > 0) {
    return syncing ? `Enviando ${changes}…` : `${changes} sin enviar · reintentando`;
  }
  return null;
}
