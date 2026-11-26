/**
 * Cabeceras de seguridad de las respuestas del servidor (HTML renderizado).
 *
 * - Las de bajo riesgo se aplican ya: nosniff, referrer, permisos del navegador y HSTS (solo https).
 * - La política CSP va en modo **informe** (`Report-Only`): el navegador avisa en la consola de lo
 *   que bloquearía sin romper nada. Se pasa a `Content-Security-Policy` en la Parte 11, cuando se
 *   haya comprobado en el dominio real (y decidido quién puede incrustar la app en un iframe:
 *   el editor de Lovable lo hace, por eso aquí no se pone `frame-ancestors`).
 */

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  // TanStack Start inyecta un script en línea para hidratar.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // Supabase: API REST/Auth y Realtime.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

export const CSP_VALUE = CSP_DIRECTIVES.join("; ");

const STATIC_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy-Report-Only": CSP_VALUE,
};

/** Devuelve la respuesta con las cabeceras añadidas (sin pisar las que ya trae). */
export function withSecurityHeaders(response: Response, requestUrl: string): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (requestUrl.startsWith("https://") && !headers.has("Strict-Transport-Security")) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Si la petición llegó por http a un dominio real, devuelve una redirección permanente
 * (308, conserva el método) a la misma URL en https. En local (localhost, *.localhost, *.test)
 * no redirige para que `npm run dev` siga funcionando. Devuelve `null` si no hay que redirigir.
 */
export function httpsRedirect(requestUrl: string): Response | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:") return null;
  const host = url.hostname;
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".test")) return null;

  url.protocol = "https:";
  return new Response(null, { status: 308, headers: { Location: url.toString() } });
}
