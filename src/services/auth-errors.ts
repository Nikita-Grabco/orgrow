/**
 * Traduce los errores de Supabase Auth a mensajes que se puedan mostrar.
 *
 * Supabase devuelve siempre mensajes en inglés y a veces genéricos. La UI nunca
 * enseña el texto original: así no se filtran detalles internos y el usuario
 * entiende qué puede hacer.
 */

interface ErrorLike {
  message?: string | undefined;
  code?: string | undefined;
  status?: number | undefined;
}

function read(error: unknown): { message: string; code: string } {
  if (typeof error === "string") return { message: error, code: "" };
  if (!error || typeof error !== "object") return { message: "", code: "" };

  const value = error as ErrorLike;
  return {
    message: typeof value.message === "string" ? value.message : "",
    code: typeof value.code === "string" ? value.code : "",
  };
}

const RULES: { match: RegExp; message: string }[] = [
  {
    match: /invalid login credentials/i,
    message: "Email o contraseña incorrectos.",
  },
  {
    match: /email not confirmed|email_not_confirmed/i,
    message: "Todavía no has confirmado tu email. Revisa el correo de confirmación.",
  },
  {
    match: /user already registered|user_already_exists/i,
    message: "Ya existe una cuenta con ese email. Inicia sesión.",
  },
  {
    match: /password should be at least/i,
    message: "La contraseña es demasiado corta: usa al menos 6 caracteres.",
  },
  {
    match: /rate limit|too many requests|over_email_send_rate_limit/i,
    message: "Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.",
  },
  {
    match: /unable to validate email|invalid email|email address .* is invalid/i,
    message: "Escribe un email válido.",
  },
  {
    match: /signups? not allowed|signup is disabled/i,
    message: "El registro está desactivado en este proyecto.",
  },
  {
    match: /password .*weak|weak_password/i,
    message: "Esa contraseña es demasiado débil. Prueba una más larga.",
  },
  {
    match: /fetch failed|failed to fetch|networkerror|load failed|network request failed/i,
    message: "No se pudo conectar con el servidor. Comprueba tu conexión.",
  },
  {
    match: /jwt|session|refresh token/i,
    message: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  },
];

const FALLBACK = "No se pudo completar la operación. Inténtalo de nuevo.";

export function translateAuthError(error: unknown): string {
  const { message, code } = read(error);
  const haystack = `${code} ${message}`.trim();
  if (!haystack) return FALLBACK;

  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.message;
  }
  return FALLBACK;
}
