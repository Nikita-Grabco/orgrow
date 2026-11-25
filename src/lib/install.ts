/**
 * Decide si hay que ofrecer instalar la app y cómo. Funciones puras, sin
 * navegador, para poder probarlas.
 *
 *  - "prompt": el navegador (Chrome, Edge, Android) permite instalar con un botón.
 *  - "ios": Safari en iPhone/iPad no tiene botón; hay que explicar Compartir →
 *    Añadir a pantalla de inicio.
 *  - "hidden": ya está instalada, el usuario lo descartó o no se puede instalar.
 */
export type InstallMode = "prompt" | "ios" | "hidden";

export interface InstallContext {
  /** Ya se abrió desde el icono de la pantalla de inicio. */
  standalone: boolean;
  /** El navegador entregó `beforeinstallprompt`. */
  hasInstallPrompt: boolean;
  isIOS: boolean;
  /** Safari de verdad: en Chrome/Firefox para iOS no existe "Añadir a inicio" de la misma forma. */
  isSafari: boolean;
  dismissed: boolean;
}

export function installMode(context: InstallContext): InstallMode {
  if (context.standalone || context.dismissed) return "hidden";
  if (context.hasInstallPrompt) return "prompt";
  if (context.isIOS && context.isSafari) return "ios";
  return "hidden";
}

/** iPhone, iPad y también iPadOS, que se presenta como un Mac con pantalla táctil. */
export function detectIOS(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/** Safari y no otro navegador de iOS (Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS…). */
export function detectSafari(userAgent: string): boolean {
  return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo/i.test(userAgent);
}

export const INSTALL_DISMISSED_KEY = "orgrow:v1:install-dismissed";
