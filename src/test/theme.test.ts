import { beforeEach, describe, expect, it } from "vitest";

import {
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  parseTheme,
  readThemePreference,
  resolveTheme,
} from "@/lib/theme";

function stubMatchMedia(prefersLight: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("light") ? prefersLight : !prefersLight,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe("tema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    document.head.innerHTML = '<meta name="theme-color" content="#0b0d12">';
  });

  it("parseTheme solo acepta valores conocidos", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("azul")).toBe("dark");
    expect(parseTheme(null)).toBe("dark");
  });

  it("resolveTheme sigue al sistema solo en 'sistema'", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("readThemePreference tolera un almacenamiento que falla", () => {
    expect(
      readThemePreference({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).toBe("dark");
    expect(readThemePreference(null)).toBe("dark");
  });

  it("applyTheme pone la clase, el color-scheme y el theme-color", () => {
    applyTheme("light", document);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      THEME_COLORS.light,
    );

    applyTheme("dark", document);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      THEME_COLORS.dark,
    );
  });

  describe("script de arranque (antes de pintar)", () => {
    const run = () => new Function(THEME_INIT_SCRIPT)();

    it("elegido claro: activa el claro", () => {
      stubMatchMedia(false);
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
      run();
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    it("elegido oscuro: no toca nada aunque el sistema sea claro", () => {
      stubMatchMedia(true);
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      run();
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });

    it("sin preferencia (primera visita) es oscuro aunque el sistema sea claro", () => {
      stubMatchMedia(true);
      run();
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });

    it("elegido sistema sigue al sistema", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      stubMatchMedia(true);
      run();
      expect(document.documentElement.classList.contains("light")).toBe(true);
      document.documentElement.className = "";
      stubMatchMedia(false);
      run();
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });
  });
});
