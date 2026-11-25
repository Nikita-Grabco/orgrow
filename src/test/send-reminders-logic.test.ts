import { describe, expect, it } from "vitest";

import { isValidVapidPublicKey } from "@/lib/push";
import { generateVapidKeys } from "../../scripts/vapid.mjs";
import {
  BATCH_LIMIT,
  MAX_LATE_MS,
  buildPayload,
  classifyPushFailure,
  dueWindow,
  groupByUser,
  safeEqual,
  whenText,
} from "../../docs/supabase-functions/send-reminders/logic.ts";

describe("whenText", () => {
  it("expresa el adelanto en lenguaje natural", () => {
    expect(whenText(0)).toBe("Ahora");
    expect(whenText(null)).toBe("Ahora");
    expect(whenText(10)).toBe("En 10 min");
    expect(whenText(60)).toBe("En 1 hora");
    expect(whenText(120)).toBe("En 2 horas");
    expect(whenText(1440)).toBe("Mañana");
    expect(whenText(2880)).toBe("En 2 días");
  });
});

describe("buildPayload", () => {
  it("tarea con hora", () => {
    expect(
      buildPayload("task", { id: "t1", user_id: "u", title: "Llamar al médico", remind_before_minutes: 10, time: "09:30:00" }),
    ).toEqual({ title: "Llamar al médico", body: "En 10 min · Tarea a las 09:30", url: "/tareas", tag: "task-t1" });
  });

  it("tarea sin hora no inventa una", () => {
    expect(
      buildPayload("task", { id: "t2", user_id: "u", title: "Comprar pan", remind_before_minutes: 0, time: null }).body,
    ).toBe("Ahora · Tarea");
  });

  it("actividad con lugar", () => {
    expect(
      buildPayload("activity", {
        id: "a1",
        user_id: "u",
        title: "Dentista",
        remind_before_minutes: 60,
        time: "10:00:00",
        location: "  Calle Mayor 3 ",
      }),
    ).toEqual({
      title: "Dentista",
      body: "En 1 hora · Actividad a las 10:00 · Calle Mayor 3",
      url: "/agenda",
      tag: "activity-a1",
    });
  });

  it("el tag es distinto por elemento, para que un aviso sustituya al suyo y no a otro", () => {
    const row = { user_id: "u", title: "x", remind_before_minutes: 0, time: null };
    expect(buildPayload("task", { ...row, id: "1" }).tag).not.toBe(buildPayload("task", { ...row, id: "2" }).tag);
    expect(buildPayload("task", { ...row, id: "1" }).tag).not.toBe(buildPayload("activity", { ...row, id: "1" }).tag);
  });
});

describe("dueWindow", () => {
  it("atiende lo vencido de las últimas 24 h y nada más antiguo", () => {
    const now = new Date("2026-12-01T10:00:00.000Z");
    expect(dueWindow(now)).toEqual({ from: "2026-11-30T10:00:00.000Z", to: "2026-12-01T10:00:00.000Z" });
    expect(MAX_LATE_MS).toBe(86_400_000);
    expect(BATCH_LIMIT).toBeGreaterThan(0);
  });
});

describe("groupByUser", () => {
  it("agrupa conservando el orden", () => {
    const groups = groupByUser([
      { user_id: "a", n: 1 },
      { user_id: "b", n: 2 },
      { user_id: "a", n: 3 },
    ]);
    expect([...groups.keys()]).toEqual(["a", "b"]);
    expect(groups.get("a")?.map((row) => row.n)).toEqual([1, 3]);
  });
});

describe("classifyPushFailure", () => {
  it("borra suscripciones muertas, reintenta lo pasajero y descarta lo definitivo", () => {
    expect(classifyPushFailure(404)).toBe("gone");
    expect(classifyPushFailure(410)).toBe("gone");
    expect(classifyPushFailure(429)).toBe("retry");
    expect(classifyPushFailure(500)).toBe("retry");
    expect(classifyPushFailure(503)).toBe("retry");
    expect(classifyPushFailure(undefined)).toBe("retry");
    expect(classifyPushFailure(400)).toBe("drop");
    expect(classifyPushFailure(401)).toBe("drop");
    expect(classifyPushFailure(403)).toBe("drop");
  });
});

describe("safeEqual", () => {
  it("compara secretos", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abc123")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("generador de claves VAPID", () => {
  it("la clave pública generada la acepta la validación de la app", () => {
    const { publicKey, privateKey } = generateVapidKeys();
    expect(isValidVapidPublicKey(publicKey)).toBe(true);
    expect(Buffer.from(privateKey, "base64url")).toHaveLength(32);
  });

  it("cada ejecución genera un par distinto", () => {
    expect(generateVapidKeys().publicKey).not.toBe(generateVapidKeys().publicKey);
  });
});
