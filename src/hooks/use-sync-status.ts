import { useSyncExternalStore } from "react";

import { INITIAL_SYNC_STATUS, syncStatus, type SyncStatus } from "@/services/sync-status";

/** El servidor siempre pinta el estado inicial, igual que el primer render del cliente. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.get, () => INITIAL_SYNC_STATUS);
}
