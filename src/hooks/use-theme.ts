import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Preferencia de tema de este dispositivo; "sistema" sigue al sistema en vivo. */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    setPreferenceState(readThemePreference(window.localStorage));
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => applyTheme(resolveTheme(preference, media.matches), document);
    sync();
    if (preference !== "system") return;
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* sin almacenamiento: el cambio vale solo hasta recargar */
    }
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
