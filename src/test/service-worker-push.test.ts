import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

/** Ejecuta `public/sw.js` con un `self` falso para probar los avisos push. */
const SOURCE = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://orgrow.test";

type Handler = (event: unknown) => void;

interface FakeClient {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
}

function setup(windows: FakeClient[] = []) {
  const handlers: Record<string, Handler> = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => {});

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow },
  };
  runInNewContext(SOURCE, { self, URL, caches: {}, fetch: vi.fn(), Response, Promise });

  async function push(payload: unknown, kind: "json" | "text" = "json") {
    let waiting: Promise<unknown> | undefined;
    handlers["push"]!({
      data: {
        json: () => {
          if (kind === "text") throw new SyntaxError("no es JSON");
          return payload;
        },
        text: () => String(payload),
      },
      waitUntil: (promise: Promise<unknown>) => (waiting = promise),
    });
    await waiting;
  }

  async function click(url: unknown) {
    const close = vi.fn();
    let waiting: Promise<unknown> | undefined;
    handlers["notificationclick"]!({
      notification: { close, data: url === undefined ? undefined : { url } },
      waitUntil: (promise: Promise<unknown>) => (waiting = promise),
    });
    await waiting;
    return close;
  }

  return { push, click, showNotification, openWindow, self };
}

describe("service worker · recibir un aviso", () => {
  it("muestra la notificación con el título, el texto y la ruta a abrir", async () => {
    const { push, showNotification } = setup();

    await push({ title: "Dentista", body: "Hoy a las 10:00", url: "/agenda", tag: "activity-1" });

    expect(showNotification).toHaveBeenCalledWith("Dentista", {
      body: "Hoy a las 10:00",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "activity-1",
      data: { url: "/agenda" },
    });
  });

  it("siempre muestra algo, aunque el aviso venga vacío o roto (el navegador lo exige)", async () => {
    const { push, showNotification } = setup();

    await push({});
    expect(showNotification).toHaveBeenLastCalledWith("Orgrow", expect.objectContaining({ body: "", data: { url: "/" } }));

    await push("texto plano", "text");
    expect(showNotification).toHaveBeenLastCalledWith("Orgrow", expect.objectContaining({ body: "texto plano" }));
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it("nunca deja que un aviso apunte fuera de la app", async () => {
    const { push, showNotification } = setup();

    for (const hostile of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", 42, null]) {
      await push({ title: "x", url: hostile });
      expect(showNotification).toHaveBeenLastCalledWith("x", expect.objectContaining({ data: { url: "/" } }));
    }
  });
});

describe("service worker · pulsar un aviso", () => {
  it("cierra la notificación y enfoca la ventana abierta de la app, yendo a la ruta", async () => {
    const win: FakeClient = { url: `${ORIGIN}/tareas`, focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
    const { click, openWindow } = setup([win]);

    const close = await click("/agenda");

    expect(close).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith(`${ORIGIN}/agenda`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("si la app no está abierta, la abre en la ruta", async () => {
    const { click, openWindow } = setup([]);
    await click("/tareas");
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/tareas`);
  });

  it("ignora ventanas de otros orígenes", async () => {
    const other: FakeClient = { url: "https://otra.web/", focus: vi.fn(async () => {}) };
    const { click, openWindow } = setup([other]);

    await click("/");

    expect(other.focus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("sin ruta o con una ruta peligrosa abre la raíz", async () => {
    const { click, openWindow } = setup([]);

    await click(undefined);
    expect(openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/`);

    await click("https://evil.example/phish");
    expect(openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/`);
  });
});
