/**
 * Registra el service worker (`public/sw.js`) solo en producción: en desarrollo
 * una caché agresiva confunde más que ayuda. Seguro de llamar en el servidor.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error: unknown) =>
        console.error("[orgrow] No se pudo registrar el service worker", error),
      );
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
