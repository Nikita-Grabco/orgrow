/**
 * Genera un par de claves VAPID para los recordatorios y lo imprime por pantalla.
 * No escribe ningún archivo: copia cada valor donde se indica y no lo pegues en el
 * repositorio ni en ningún chat.
 *
 * Uso: node scripts/generate-vapid-keys.mjs
 */
import { randomBytes } from "node:crypto";

import { generateVapidKeys } from "./vapid.mjs";

const { publicKey, privateKey } = generateVapidKeys();
const cronSecret = randomBytes(24).toString("hex");

console.log(`
═══ 1) CLAVE PÚBLICA — va en .env.local y en las variables de tu hosting ═══
VITE_VAPID_PUBLIC_KEY=${publicKey}

═══ 2) SECRETOS — solo en Supabase (supabase secrets set …). NO los compartas ═══
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
CRON_SECRET=${cronSecret}
VAPID_SUBJECT=mailto:TU_EMAIL   ← pon aquí un email de contacto tuyo

Guarda la clave privada: si la pierdes hay que generar otro par y todos los
dispositivos tendrán que volver a activar los avisos.
`);
