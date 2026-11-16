import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente único de Supabase.
 *
 * Se crea de forma **perezosa** a propósito: durante el build y el render en
 * servidor no hay variables de entorno ni `localStorage`, así que instanciarlo
 * al importar el módulo rompería la app. La primera llamada desde el navegador
 * es la que lo construye, y a partir de ahí se reutiliza la misma instancia
 * (Supabase mantiene la sesión y un único socket de realtime).
 *
 * Las claves reales viven en `.env.local`, nunca en el repositorio.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

const ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

type EnvKey = (typeof ENV_KEYS)[number];

function readEnv(key: EnvKey): string {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : "";
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/** Configuración validada. Lanza `SupabaseConfigError` si falta o es inválida. */
export function getSupabaseConfig(): SupabaseConfig {
  const missing = ENV_KEYS.filter((key) => !readEnv(key));
  if (missing.length > 0) {
    throw new SupabaseConfigError(
      `Faltan variables de entorno: ${missing.join(", ")}. Copia .env.example a .env.local y rellénalas.`,
    );
  }

  const url = readEnv("VITE_SUPABASE_URL");
  if (!/^https:\/\/[\w.-]+\.supabase\.co\/?$/i.test(url)) {
    throw new SupabaseConfigError(
      "VITE_SUPABASE_URL no parece una URL de Supabase (https://<proyecto>.supabase.co).",
    );
  }

  return { url: url.replace(/\/+$/, ""), publishableKey: readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") };
}

/**
 * `false` cuando el entorno aún no está configurado. Permite que la app siga
 * funcionando con el almacenamiento local mientras se despliega el backend.
 */
export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const { url, publishableKey } = getSupabaseConfig();
    cachedClient = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Prefijo propio: no choca con otras apps que usen el mismo dominio.
        storageKey: "orgadia:auth",
      },
    });
  }
  return cachedClient;
}

/** Solo para tests: olvida la instancia cacheada. */
export function resetSupabaseClient(): void {
  cachedClient = null;
}
