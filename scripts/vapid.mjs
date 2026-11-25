import { generateKeyPairSync } from "node:crypto";

/**
 * Par de claves VAPID (ECDSA P-256) para los avisos push, en base64 "url-safe"
 * sin relleno, que es el formato que esperan el navegador y `web-push`.
 *
 *  - publicKey:  punto sin comprimir (0x04 + X + Y, 65 bytes). Es pública: va en
 *                `VITE_VAPID_PUBLIC_KEY` y en el navegador.
 *  - privateKey: el escalar D (32 bytes). Es SECRETA: solo como secreto de Supabase.
 */
export function generateVapidKeys() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });

  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");

  return {
    publicKey: Buffer.concat([Buffer.from([4]), x, y]).toString("base64url"),
    privateKey: jwk.d,
  };
}
