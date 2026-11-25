import { describe, expect, it } from "vitest";

import {
  isValidVapidPublicKey,
  pushStatus,
  urlBase64ToUint8Array,
  type PushContext,
} from "@/lib/push";

const ready: PushContext = {
  supported: true,
  configured: true,
  isIOS: false,
  standalone: false,
  permission: "default",
  subscribed: false,
};

describe("pushStatus", () => {
  it("sin clave VAPID no hay recordatorios, pase lo que pase", () => {
    expect(pushStatus({ ...ready, configured: false })).toBe("unconfigured");
    expect(pushStatus({ ...ready, configured: false, isIOS: true })).toBe("unconfigured");
  });

  it("se puede activar si el navegador lo permite y aún no se hizo", () => {
    expect(pushStatus(ready)).toBe("off");
  });

  it("está activo con permiso concedido y suscripción", () => {
    expect(pushStatus({ ...ready, permission: "granted", subscribed: true })).toBe("on");
  });

  it("permiso concedido pero sin suscripción (p. ej. al volver a entrar) se ofrece activar", () => {
    expect(pushStatus({ ...ready, permission: "granted", subscribed: false })).toBe("off");
  });

  it("avisos bloqueados por el usuario", () => {
    expect(pushStatus({ ...ready, permission: "denied" })).toBe("denied");
  });

  it("en iPhone/iPad fuera de la app instalada pide instalarla, no dice que no sirve", () => {
    expect(pushStatus({ ...ready, isIOS: true, supported: false })).toBe("needs-install");
    expect(pushStatus({ ...ready, isIOS: true, standalone: true })).toBe("off");
  });

  it("un navegador sin Push (o el entorno de desarrollo) no ofrece nada", () => {
    expect(pushStatus({ ...ready, supported: false })).toBe("unsupported");
  });
});

describe("claves VAPID", () => {
  // Punto P-256 sin comprimir: 0x04 + 64 bytes, en base64 url-safe sin relleno.
  const bytes = new Uint8Array(65).fill(7);
  bytes[0] = 4;
  const VALID = Buffer.from(bytes).toString("base64url");

  it("decodifica base64 url-safe con y sin relleno", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("AQI"))).toEqual([1, 2]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });

  it("acepta una clave pública válida", () => {
    expect(VALID).toHaveLength(87);
    expect(isValidVapidPublicKey(VALID)).toBe(true);
  });

  it("rechaza lo que no sea una clave pública VAPID", () => {
    expect(isValidVapidPublicKey(undefined)).toBe(false);
    expect(isValidVapidPublicKey("")).toBe(false);
    expect(isValidVapidPublicKey("clave con espacios")).toBe(false);
    expect(isValidVapidPublicKey("AQID")).toBe(false); // longitud incorrecta
    // 65 bytes pero no empieza por 0x04: no es un punto sin comprimir
    const wrong = new Uint8Array(65).fill(7);
    expect(isValidVapidPublicKey(Buffer.from(wrong).toString("base64url"))).toBe(false);
  });
});
