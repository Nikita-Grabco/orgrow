import { useCallback, useEffect, useState } from "react";

import { pushStatus, type PushStatus } from "@/lib/push";
import { disablePush, enablePush, readPushContext, refreshPushRegistration } from "@/services/push-service";
import { useAuth } from "@/store/auth-store";

/**
 * Estado de los avisos push en este dispositivo. Es `null` hasta que se comprueba
 * tras montar (el servidor no puede saberlo), para no desajustar la hidratación.
 */
export function usePushNotifications(): {
  status: PushStatus | null;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(pushStatus(await readPushContext()));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Si ya está activado, se vuelve a registrar por si el navegador cambió la URL de push.
      if (userId) await refreshPushRegistration(userId);
      const context = await readPushContext();
      if (active) setStatus(pushStatus(context));
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const result = await enablePush(userId);
    setError(result.error);
    await refresh();
    setBusy(false);
  }, [userId, refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await disablePush();
    setError(result.error);
    await refresh();
    setBusy(false);
  }, [refresh]);

  return { status, busy, error, enable, disable };
}
