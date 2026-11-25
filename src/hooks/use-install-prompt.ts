import { useCallback, useEffect, useState } from "react";

import {
  detectIOS,
  detectSafari,
  INSTALL_DISMISSED_KEY,
  installMode,
  type InstallMode,
} from "@/lib/install";

/** El evento no está en los tipos de TypeScript porque no es estándar. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Estado para ofrecer instalar la app. Empieza en "hidden" (también en el
 * servidor) y se resuelve tras montar, para no desajustar la hidratación.
 */
export function useInstallPrompt(): {
  mode: InstallMode;
  install: () => Promise<void>;
  dismiss: () => void;
} {
  const [mode, setMode] = useState<InstallMode>("hidden");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // Evita el mini-aviso del navegador: lo ofrecemos nosotros.
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    setMode(
      installMode({
        standalone: isStandalone(),
        hasInstallPrompt: promptEvent !== null,
        isIOS: detectIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
        isSafari: detectSafari(navigator.userAgent),
        dismissed,
      }),
    );
  }, [promptEvent, dismissed]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Sin almacenamiento solo se oculta hasta recargar.
    }
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    if (outcome === "dismissed") dismiss();
  }, [promptEvent, dismiss]);

  return { mode, install, dismiss };
}
