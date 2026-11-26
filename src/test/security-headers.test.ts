import { describe, expect, it } from "vitest";

import { CSP_VALUE, httpsRedirect, withSecurityHeaders } from "@/lib/security-headers";

describe("withSecurityHeaders", () => {
  it("añade las cabeceras y conserva cuerpo, estado y cabeceras existentes", async () => {
    const original = new Response("<p>hola</p>", {
      status: 201,
      headers: { "content-type": "text/html", "x-propia": "1" },
    });
    const out = withSecurityHeaders(original, "https://orgrow.test/");

    expect(out.status).toBe(201);
    expect(await out.text()).toBe("<p>hola</p>");
    expect(out.headers.get("content-type")).toBe("text/html");
    expect(out.headers.get("x-propia")).toBe("1");
    expect(out.headers.get("x-content-type-options")).toBe("nosniff");
    expect(out.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(out.headers.get("permissions-policy")).toContain("camera=()");
    expect(out.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("HSTS solo en https", () => {
    const out = withSecurityHeaders(new Response("x"), "http://localhost:3000/");
    expect(out.headers.has("strict-transport-security")).toBe(false);
  });

  it("la CSP va en modo informe y no bloquea Supabase ni las fuentes", () => {
    const out = withSecurityHeaders(new Response("x"), "https://orgrow.test/");
    expect(out.headers.has("content-security-policy")).toBe(false);
    expect(out.headers.get("content-security-policy-report-only")).toBe(CSP_VALUE);
    expect(CSP_VALUE).toContain("connect-src 'self' https://*.supabase.co");
    expect(CSP_VALUE).toContain("https://fonts.googleapis.com");
    expect(CSP_VALUE).toContain("object-src 'none'");
    expect(CSP_VALUE).not.toContain("frame-ancestors");
  });

  it("no pisa una cabecera que ya venía", () => {
    const out = withSecurityHeaders(
      new Response("x", { headers: { "Referrer-Policy": "no-referrer" } }),
      "https://orgrow.test/",
    );
    expect(out.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("httpsRedirect", () => {
  it("redirige http a https conservando ruta y parámetros", () => {
    const out = httpsRedirect("http://orgrow.example.com/habitos?x=1");
    expect(out?.status).toBe(308);
    expect(out?.headers.get("location")).toBe("https://orgrow.example.com/habitos?x=1");
  });

  it("no toca https ni el desarrollo local", () => {
    expect(httpsRedirect("https://orgrow.example.com/")).toBeNull();
    expect(httpsRedirect("http://localhost:3000/")).toBeNull();
    expect(httpsRedirect("http://127.0.0.1:3000/")).toBeNull();
    expect(httpsRedirect("http://app.localhost/")).toBeNull();
    expect(httpsRedirect("no es una url")).toBeNull();
  });
});
