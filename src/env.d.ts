/// <reference types="vite/client" />

/**
 * Variables de entorno leídas por el cliente de Supabase.
 *
 * Se declaran aquí para que TypeScript las conozca con nombre propio
 * (`noPropertyAccessFromIndexSignature` prohíbe el acceso por punto a la
 * firma de índice de `ImportMetaEnv`). Los valores reales viven en
 * `.env.local`, que nunca se versiona.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
