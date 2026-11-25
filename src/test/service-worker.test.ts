import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ejecuta `public/sw.js` con un `self`, una caché y un `fetch` falsos para
 * comprobar qué guarda y qué deja pasar. No hace falta un navegador.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://orgrow.test";

type Handler = (event: unknown) => void;

function setup(network: (url: string) => Promise<Response>) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();

  const keyOf = (input: unknown) => (typeof input === "string" ? input : (input as Request).url);

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async match(input: unknown) {
          return store.get(keyOf(input))?.clone();
        },
        async put(input: unknown, response: Response) {
          store.set(keyOf(input), response);
        },
        async add(input: unknown) {
          store.set(keyOf(input), await network(keyOf(input)));
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };

  const fetchMock = vi.fn((request: Request | string) =>
    network(typeof request === "string" ? request : request.url),
  );
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };

  runInNewContext(SOURCE, { self, caches, fetch: fetchMock, URL, Response, Promise });

  /** Lanza un `fetch` del navegador y devuelve la respuesta, o `undefined` si el SW no intervino. */
  async function request(url: string, init: { method?: string; mode?: string } = {}) {
    let answered: Promise<Response> | undefined;
    handlers["fetch"]!({
      request: { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors" },
      respondWith: (response: Promise<Response>) => {
        answered = response;
      },
    });
    return answered;
  }

  async function install() {
    let waiting: Promise<unknown> | undefined;
    handlers["install"]!({ waitUntil: (promise: Promise<unknown>) => (waiting = promise) });
    await waiting;
    return self;
  }

  return { request, install, stores, fetchMock, self, handlers };
}

const ok = (body: string) => new Response(body, { status: 200 });

let online = true;
const network = async (url: string) => {
  if (!online) throw new TypeError("Failed to fetch");
  if (url.endsWith("/boom")) return new Response("error", { status: 500 });
  return ok(`red:${url}`);
};

beforeEach(() => {
  online = true;
});

describe("service worker", () => {
  it("al instalarse guarda la página sin conexión y activa el worker al instante", async () => {
    const { install, stores, self } = setup(network);
    await install();

    expect([...stores.get("orgrow-v1-shell")!.keys()].sort()).toEqual(["/", "/offline.html"]);
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("no interviene en POST ni en otros orígenes (Supabase)", async () => {
    const { request } = setup(network);

    expect(await request(`${ORIGIN}/algo`, { method: "POST" })).toBeUndefined();
    expect(await request("https://abcdefghijklmnopqrst.supabase.co/rest/v1/tasks")).toBeUndefined();
  });

  it("no guarda nada privado: ni peticiones de datos ni rutas que no sean app", async () => {
    const { request, stores } = setup(network);

    expect(await request(`${ORIGIN}/api/lo-que-sea`)).toBeUndefined();
    expect(stores.size).toBe(0);
  });

  it("navegación: red primero y la guarda; sin red sirve la última copia de esa ruta", async () => {
    const { request, stores } = setup(network);

    expect(await (await request(`${ORIGIN}/tareas?x=1`, { mode: "navigate" }))!.text()).toBe(
      `red:${ORIGIN}/tareas?x=1`,
    );
    // Se guarda por ruta, sin parámetros.
    expect([...stores.get("orgrow-v1-shell")!.keys()]).toEqual([`${ORIGIN}/tareas`]);

    online = false;
    expect(await (await request(`${ORIGIN}/tareas?x=2`, { mode: "navigate" }))!.text()).toBe(
      `red:${ORIGIN}/tareas?x=1`,
    );
  });

  it("navegación sin red a una ruta nueva: usa '/', y si no existe, la página offline", async () => {
    const { request, install } = setup(network);
    await install();

    online = false;
    expect(await (await request(`${ORIGIN}/notas`, { mode: "navigate" }))!.text()).toBe("red:/");

    const empty = setup(network);
    online = false;
    // Sin nada guardado devuelve un error de red: el navegador muestra su propia pantalla.
    const response = await empty.request(`${ORIGIN}/notas`, { mode: "navigate" });
    expect((await response!).type).toBe("error");
  });

  it("no guarda respuestas con error", async () => {
    const { request, stores } = setup(network);

    const response = await (await request(`${ORIGIN}/boom`, { mode: "navigate" }))!;
    expect(response.status).toBe(500);
    expect(stores.get("orgrow-v1-shell")?.size ?? 0).toBe(0);
  });

  it("/assets: caché primero, la segunda vez no toca la red", async () => {
    const { request, fetchMock } = setup(network);
    const url = `${ORIGIN}/assets/index-abc123.js`;

    expect(await (await request(url))!.text()).toBe(`red:${url}`);
    expect(await (await request(url))!.text()).toBe(`red:${url}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    online = false;
    expect(await (await request(url))!.text()).toBe(`red:${url}`);
  });

  it("las fuentes de Google se guardan aparte", async () => {
    const { request, stores } = setup(network);
    await request("https://fonts.gstatic.com/s/source.woff2");
    await vi.waitFor(() => expect(stores.get("orgrow-v1-fonts")?.size).toBe(1));
  });

  it("al activarse borra las cachés de versiones antiguas", async () => {
    const { handlers, stores } = setup(network);
    stores.set("orgrow-v0-shell", new Map());
    stores.set("orgrow-v1-assets", new Map());

    let waiting: Promise<unknown> | undefined;
    handlers["activate"]!({ waitUntil: (promise: Promise<unknown>) => (waiting = promise) });
    await waiting;

    expect([...stores.keys()]).toEqual(["orgrow-v1-assets"]);
  });
});
