/**
 * Estado de la sincronización, para que la interfaz pueda decir "sin conexión"
 * o "3 cambios pendientes". Es un almacén mínimo compatible con
 * `useSyncExternalStore` (ver `src/hooks/use-sync-status.ts`).
 *
 * Es global a propósito: solo hay una sesión de usuario por pestaña.
 */
export interface SyncStatus {
  /** Lo que informa el navegador; puede haber red sin acceso al servidor. */
  online: boolean;
  /** Cambios guardados en este dispositivo que aún no han llegado al servidor. */
  pending: number;
  /** Hay un envío en curso. */
  syncing: boolean;
}

export const INITIAL_SYNC_STATUS: SyncStatus = { online: true, pending: 0, syncing: false };

let state: SyncStatus = INITIAL_SYNC_STATUS;
const listeners = new Set<() => void>();

export const syncStatus = {
  get: (): SyncStatus => state,

  set(partial: Partial<SyncStatus>): void {
    const next = { ...state, ...partial };
    // Mismo contenido = mismo objeto: así no se dispara ningún render de más.
    if (next.online === state.online && next.pending === state.pending && next.syncing === state.syncing) {
      return;
    }
    state = next;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reset(): void {
    state = INITIAL_SYNC_STATUS;
    listeners.forEach((listener) => listener());
  },
};
