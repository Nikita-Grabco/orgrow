/**
 * Avisos push (recordatorios). Lógica pura, sin navegador, para poder probarla;
 * el acceso al navegador y a Supabase está en `src/services/push-service.ts`.
 *
 * Requisitos para recibirlos:
 *  - Que el servidor tenga configurada la clave VAPID (`VITE_VAPID_PUBLIC_KEY`).
 *  - Un navegador con service worker, Push y Notification.
 *  - En iPhone/iPad, que la app esté **instalada** en la pantalla de inicio
 *    (Safari no permite push en una pestaña normal).
 *  - Que el usuario conceda el permiso.
 */

export type PushStatus =
  /** Este navegador no puede recibir avisos (o es el entorno de desarrollo, sin service worker). */
  | "unsupported"
  /** Falta la clave VAPID: los recordatorios no están activados en esta instalación. */
  | "unconfigured"
  /** iPhone/iPad: hay que instalar la app primero. */
  | "needs-install"
  /** El usuario bloqueó los avisos en el navegador. */
  | "denied"
  /** Se puede activar. */
  | "off"
  /** Este dispositivo recibe avisos. */
  | "on";

export interface PushContext {
  /** El navegador tiene service worker + Push + Notification y hay un service worker activo. */
  supported: boolean;
  configured: boolean;
  isIOS: boolean;
  standalone: boolean;
  permission: NotificationPermission;
  /** Existe una suscripción push en este dispositivo. */
  subscribed: boolean;
}

export function pushStatus(context: PushContext): PushStatus {
  if (!context.configured) return "unconfigured";
  // En iOS fuera de la app instalada `PushManager` ni siquiera existe: es "instálala primero",
  // no "tu navegador no sirve".
  if (context.isIOS && !context.standalone) return "needs-install";
  if (!context.supported) return "unsupported";
  if (context.permission === "denied") return "denied";
  return context.permission === "granted" && context.subscribed ? "on" : "off";
}

/** `applicationServerKey` espera bytes; la clave VAPID se guarda en base64 "url-safe". */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Una clave VAPID pública válida es un punto P-256 sin comprimir: 65 bytes que empiezan por 0x04. */
export function isValidVapidPublicKey(value: string | undefined): value is string {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const bytes = urlBase64ToUint8Array(value);
    return bytes.length === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

/** Zona horaria IANA del dispositivo ("Europe/Madrid"). */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
