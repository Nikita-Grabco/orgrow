/**
 * Tema de la app: claro, oscuro o el del sistema (por defecto, oscuro). La preferencia vive en este
 * dispositivo (`localStorage`); el modo oscuro es el de siempre y el claro se activa
 * con la clase `light` en <html> (ver `styles.css`).
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "orgrow:theme";
export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

/** Color de la barra del navegador (`theme-color`) para cada tema. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#0b0d12", light: "#f6f7fb" };

/** Quien entra por primera vez (sin preferencia guardada) ve el tema oscuro. */
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseTheme(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function readThemePreference(storage: Pick<Storage, "getItem"> | null): ThemePreference {
  try {
    return parseTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Pone o quita la clase `light`, el `color-scheme` y el `theme-color` del documento. */
export function applyTheme(resolved: ResolvedTheme, doc: Document): void {
  const root = doc.documentElement;
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
}

/**
 * Se ejecuta en el <head>, antes de pintar, para que no haya un destello del tema
 * equivocado. Debe ser autónomo: no puede importar nada.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var l=p==="light"||(p==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);var r=document.documentElement;if(l){r.classList.add("light");r.style.colorScheme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(
  THEME_COLORS.light,
)})}}catch(e){}})();`;
