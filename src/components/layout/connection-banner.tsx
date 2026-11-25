import { CloudUpload, WifiOff } from "lucide-react";

import { useSyncStatus } from "@/hooks/use-sync-status";
import { connectionMessage } from "@/lib/connection";
import { cn } from "@/lib/utils";

/**
 * Dice cuándo lo que ves o haces solo está en este dispositivo: sin conexión, o
 * con cambios aún sin enviar. Desaparece solo cuando todo está sincronizado.
 */
export function ConnectionBanner() {
  const status = useSyncStatus();
  const message = connectionMessage(status);
  if (!message) return null;

  const Icon = status.online ? CloudUpload : WifiOff;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-border px-4 py-2 text-center text-xs font-medium",
        status.online ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", status.syncing && "animate-pulse")} aria-hidden />
      {message}
    </div>
  );
}
