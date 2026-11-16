/**
 * Nombre e iniciales a partir de los datos de la cuenta.
 *
 * Vive aparte y sin React para poder probarlo y para que, cuando exista la
 * tabla `profiles` (Parte 3), solo haya que cambiar de dónde vienen los datos.
 */

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const FALLBACK_NAME = "Tu cuenta";

/** "nikita.grabco@mail.com" → "Nikita Grabco". */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return FALLBACK_NAME;

  const [localPart] = email.split("@");
  if (!localPart) return FALLBACK_NAME;

  const words = localPart
    .replace(/[._\-+]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return FALLBACK_NAME;
  return words.map((word) => capitalize(word)).join(" ");
}

/** "Nikita Grabco" → "NG"; "Nikita" → "NI"; sin nombre → "?". */
export function initialsFromName(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  const first = words[0];
  if (!first) return "?";

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  if (!last) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
