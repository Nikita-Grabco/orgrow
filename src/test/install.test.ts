import { describe, expect, it } from "vitest";

import { detectIOS, detectSafari, installMode, type InstallContext } from "@/lib/install";

const base: InstallContext = {
  standalone: false,
  hasInstallPrompt: false,
  isIOS: false,
  isSafari: false,
  dismissed: false,
};

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

describe("installMode", () => {
  it("ofrece el botón cuando el navegador lo permite", () => {
    expect(installMode({ ...base, hasInstallPrompt: true })).toBe("prompt");
  });

  it("en Safari de iPhone/iPad explica los pasos", () => {
    expect(installMode({ ...base, isIOS: true, isSafari: true })).toBe("ios");
  });

  it("no molesta si ya está instalada o se descartó", () => {
    expect(installMode({ ...base, hasInstallPrompt: true, standalone: true })).toBe("hidden");
    expect(installMode({ ...base, hasInstallPrompt: true, dismissed: true })).toBe("hidden");
    expect(installMode({ ...base, isIOS: true, isSafari: true, dismissed: true })).toBe("hidden");
  });

  it("no ofrece nada donde no se puede instalar", () => {
    expect(installMode(base)).toBe("hidden");
    // Chrome en iOS no tiene "Añadir a pantalla de inicio" como Safari.
    expect(installMode({ ...base, isIOS: true, isSafari: false })).toBe("hidden");
  });
});

describe("detección de navegador", () => {
  it("reconoce iPhone, iPad y iPadOS que se hace pasar por Mac", () => {
    expect(detectIOS(IPHONE_SAFARI, "iPhone", 5)).toBe(true);
    expect(detectIOS(IPAD_AS_MAC, "MacIntel", 5)).toBe(true);
    expect(detectIOS(IPAD_AS_MAC, "MacIntel", 0)).toBe(false); // un Mac de verdad
    expect(detectIOS("Mozilla/5.0 (Windows NT 10.0)", "Win32", 0)).toBe(false);
  });

  it("distingue Safari de Chrome en iOS", () => {
    expect(detectSafari(IPHONE_SAFARI)).toBe(true);
    expect(detectSafari(IPHONE_CHROME)).toBe(false);
  });
});
