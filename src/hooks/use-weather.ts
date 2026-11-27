import { useCallback, useEffect, useState } from "react";

import {
  fetchWeather,
  isFresh,
  loadCachedWeather,
  loadCity,
  saveCachedWeather,
  saveCity,
  type WeatherCity,
  type WeatherNow,
} from "@/lib/weather";

export type WeatherStatus = "idle" | "loading" | "ready" | "error";

/**
 * Tiempo de la ciudad elegida. Lee el storage tras hidratar (no en el render
 * del servidor) y, si no hay red, enseña el último dato guardado.
 */
export function useWeather() {
  const [city, setCityState] = useState<WeatherCity | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCityState(loadCity());
    setWeather(loadCachedWeather());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!city) return;
    const cached = loadCachedWeather();
    if (cached && isFresh(cached, Date.now())) {
      setWeather(cached);
      setStatus("ready");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetchWeather(city, controller.signal)
      .then((next) => {
        saveCachedWeather(next);
        setWeather(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [city]);

  const setCity = useCallback((next: WeatherCity | null) => {
    saveCity(next);
    setWeather(null);
    setStatus("idle");
    setCityState(next);
  }, []);

  return { city, weather, status, hydrated, setCity };
}
