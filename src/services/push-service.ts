import {
  deviceTimeZone,
  isValidVapidPublicKey,
  urlBase64ToUint8Array,
  type PushContext,
} from "@/lib/push";
import { detectIOS } from "@/lib/install";
import { getSupabaseClient } from "@/services/supabase-client";

/**
 * Avisos push desde el navegador: pedir permiso, suscribir este dispositivo y
 * registrarlo en Supabase. La parte pura (estados, claves) está en `src/lib/push.ts`.
 *
 * Todo es "mejor esfuerzo" y nunca lanza: devuelve un mensaje en español.
 */

function vapidKey(): string | null {
  const value = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  return isValidVapidPublicKey(value) ? value : null;
}

/** Hay clave VAPID válida: los recordatorios están disponibles en esta instalación. */
export function isPushConfigured(): boolean {
  return vapidKey() !== null;
}

/**
 * En desarrollo no hay service worker (solo se registra en producción), así que
 * tampoco puede haber avisos: se dice "no disponible" en vez de quedarse esperando.
 */
function browserSupportsPush(): boolean {
  return (
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function readPushContext(): Promise<PushContext> {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported = browserSupportsPush();

  return {
    supported,
    configured: isPushConfigured(),
    isIOS: detectIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    standalone: iosStandalone || window.matchMedia("(display-mode: standalone)").matches,
    permission: "Notification" in window ? Notification.permission : "denied",
    subscribed: supported ? (await currentSubscription()) !== null : false,
  };
}

export interface PushResult {
  error: string | null;
}

/** Guarda este dispositivo (y la zona horaria, de la que depende la hora de los avisos). */
async function registerOnServer(subscription: PushSubscription, userId: string): Promise<void> {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.["p256dh"] || !keys["auth"]) {
    throw new Error("La suscripción del navegador está incompleta");
  }

  const client = getSupabaseClient();
  const { error } = await client.rpc("register_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: keys["p256dh"],
    p_auth: keys["auth"],
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;

  // Los avisos se calculan en la zona horaria del perfil: debe ser la del usuario.
  const timeZone = deviceTimeZone();
  if (timeZone) {
    const { error: profileError } = await client
      .from("profiles")
      .update({ timezone: timeZone })
      .eq("id", userId);
    if (profileError) console.error("[orgrow] No se pudo guardar la zona horaria", profileError);
  }
}

export async function enablePush(userId: string): Promise<PushResult> {
  const key = vapidKey();
  if (!key) return { error: "Los avisos no están configurados en esta instalación." };
  if (!browserSupportsPush()) return { error: "Este navegador no puede recibir avisos." };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        error:
          permission === "denied"
            ? "Has bloqueado los avisos. Actívalos desde los ajustes del navegador para este sitio."
            : "No se concedió el permiso para los avisos.",
      };
    }

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return { error: "La app aún no está lista para avisos. Recarga e inténtalo de nuevo." };

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    try {
      await registerOnServer(subscription, userId);
    } catch (error) {
      // Sin registro en el servidor la suscripción no sirve; no dejarla a medias.
      await subscription.unsubscribe().catch(() => undefined);
      throw error;
    }
    return { error: null };
  } catch (error) {
    console.error("[orgrow] No se pudieron activar los avisos", error);
    return { error: "No se pudieron activar los avisos. Inténtalo de nuevo." };
  }
}

/** Mantiene al día el registro de un dispositivo ya suscrito (la URL de push puede cambiar). */
export async function refreshPushRegistration(userId: string): Promise<void> {
  try {
    if (!browserSupportsPush() || Notification.permission !== "granted") return;
    const subscription = await currentSubscription();
    if (subscription) await registerOnServer(subscription, userId);
  } catch (error) {
    console.error("[orgrow] No se pudo actualizar el registro de avisos", error);
  }
}

/** Quita los avisos de este dispositivo: del navegador y del servidor. */
export async function disablePush(): Promise<PushResult> {
  try {
    if (!browserSupportsPush()) return { error: null };

    const subscription = await currentSubscription();
    if (!subscription) return { error: null };

    const { endpoint } = subscription;
    await subscription.unsubscribe();

    const { error } = await getSupabaseClient()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("[orgrow] No se pudieron desactivar los avisos", error);
    return { error: "No se pudieron desactivar los avisos. Inténtalo de nuevo." };
  }
}
