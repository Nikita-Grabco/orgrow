/* Service worker de Orgrow.
 *
 * Solo guarda lo que NO es privado: la aplicación (HTML, JS, CSS, fuentes e
 * iconos). Los datos de la cuenta viajan a Supabase (otro origen) y este archivo
 * nunca los toca: su copia sin conexión la gestiona la propia app, por usuario.
 *
 * Estrategias
 *  - Navegación (HTML): red primero; si no hay red, la última copia de esa página,
 *    luego la de "/", luego /offline.html. Todas las páginas se renderizan en el
 *    servidor sin datos del usuario, así que guardarlas es seguro.
 *  - /assets/* (nombres con hash, inmutables): caché primero.
 *  - Iconos y fuentes: caché primero.
 *  - Todo lo demás (POST, otros orígenes, funciones del servidor): ni se toca.
 *
 * Avisos push (recordatorios): al llegar uno se muestra la notificación y, al
 * pulsarla, se abre o enfoca la app en la ruta indicada.
 */
const VERSION = "orgrow-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FONT_CACHE = `${VERSION}-fonts`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Si una de las dos falla (p. ej. sin red al instalar) no se aborta la instalación.
      await Promise.allSettled([cache.add("/offline.html"), cache.add("/")]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Solo respuestas correctas y completas: nunca guardar errores ni redirecciones. */
const cacheable = (response) => response && response.ok && response.status === 200;

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      // Se guarda sin cabeceras de cookies ni parámetros: una entrada por ruta.
      const url = new URL(request.url);
      await cache.put(url.origin + url.pathname, response.clone());
    }
    return response;
  } catch {
    const url = new URL(request.url);
    return (
      (await cache.match(url.origin + url.pathname)) ||
      (await cache.match("/")) ||
      (await cache.match("/offline.html")) ||
      Response.error()
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Las fuentes de otro origen llegan "opacas" (status 0) y aun así se pueden reutilizar.
  if (cacheable(response) || response.type === "opaque") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Cualquier otro origen (Supabase incluido) pasa directo a la red.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

/* -------------------------------------------------------------------------- */
/* Avisos push                                                                */
/* -------------------------------------------------------------------------- */

/** Solo rutas de esta misma app: un aviso nunca debe poder abrir otra web. */
function safeAppPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // No era JSON: se muestra el texto tal cual.
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof data.title === "string" && data.title ? data.title : "Orgrow";

  // Los navegadores exigen mostrar siempre una notificación al recibir un push.
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Mismo `tag` = la notificación nueva sustituye a la anterior en vez de apilarse.
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: safeAppPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safeAppPath(event.notification.data && event.notification.data.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);

      if (open) {
        await open.focus();
        // `navigate` no existe en todos los navegadores: si falla, queda enfocada la ventana.
        if ("navigate" in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
