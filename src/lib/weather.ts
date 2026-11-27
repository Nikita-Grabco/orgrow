/**
 * Tiempo actual con Open-Meteo (gratis, sin clave). La ciudad se guarda por
 * dispositivo en localStorage; no se usa geolocalización del navegador (la
 * política de permisos de la app la bloquea).
 */

export interface WeatherCity {
  name: string;
  latitude: number;
  longitude: number;
}

export interface WeatherNow {
  temperature: number;
  min: number;
  max: number;
  /** Código WMO del tiempo actual. */
  code: number;
  isDay: boolean;
  /** Epoch millis en que se obtuvo. */
  fetchedAt: number;
}

export type WeatherIcon =
  "sun" | "moon" | "cloud-sun" | "cloud" | "fog" | "rain" | "snow" | "storm";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export const WEATHER_CITY_KEY = "orgrow:weather-city";
export const WEATHER_CACHE_KEY = "orgrow:weather-cache";
/** Pasado este tiempo el dato guardado se vuelve a pedir. */
export const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;

/** Descripción corta y icono de un código WMO. */
export function describeWeather(
  code: number,
  isDay: boolean,
): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "Despejado", icon: isDay ? "sun" : "moon" };
  if (code === 1 || code === 2)
    return { label: "Poco nublado", icon: isDay ? "cloud-sun" : "cloud" };
  if (code === 3) return { label: "Nublado", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Niebla", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Llovizna", icon: "rain" };
  if (code >= 61 && code <= 67) return { label: "Lluvia", icon: "rain" };
  if (code >= 71 && code <= 77) return { label: "Nieve", icon: "snow" };
  if (code >= 80 && code <= 82) return { label: "Chubascos", icon: "rain" };
  if (code === 85 || code === 86) return { label: "Nieve", icon: "snow" };
  if (code >= 95 && code <= 99) return { label: "Tormenta", icon: "storm" };
  return { label: "Variable", icon: "cloud" };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Convierte la respuesta de Open-Meteo; `null` si no tiene la forma esperada. */
export function parseForecast(data: unknown, now: number): WeatherNow | null {
  if (!isRecord(data) || !isRecord(data["current"]) || !isRecord(data["daily"])) return null;
  const { temperature_2m, weather_code, is_day } = data["current"];
  const max = Array.isArray(data["daily"]["temperature_2m_max"])
    ? data["daily"]["temperature_2m_max"][0]
    : null;
  const min = Array.isArray(data["daily"]["temperature_2m_min"])
    ? data["daily"]["temperature_2m_min"][0]
    : null;
  if (!isNum(temperature_2m) || !isNum(weather_code) || !isNum(max) || !isNum(min)) return null;
  return {
    temperature: Math.round(temperature_2m),
    min: Math.round(min),
    max: Math.round(max),
    code: weather_code,
    isDay: is_day !== 0,
    fetchedAt: now,
  };
}

/** Convierte la respuesta del buscador de ciudades. */
export function parseCities(data: unknown): WeatherCity[] {
  if (!isRecord(data) || !Array.isArray(data["results"])) return [];
  const cities: WeatherCity[] = [];
  for (const item of data["results"]) {
    if (!isRecord(item)) continue;
    const { name, latitude, longitude, admin1, country } = item;
    if (typeof name !== "string" || !isNum(latitude) || !isNum(longitude)) continue;
    const extra = [admin1, country].filter((v): v is string => typeof v === "string" && v !== "");
    cities.push({
      name: extra.length > 0 ? `${name}, ${extra[0]}` : name,
      latitude,
      longitude,
    });
  }
  return cities;
}

export async function fetchWeather(city: WeatherCity, signal?: AbortSignal): Promise<WeatherNow> {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Tiempo no disponible (${response.status})`);
  const parsed = parseForecast(await response.json(), Date.now());
  if (!parsed) throw new Error("Respuesta del tiempo no válida");
  return parsed;
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<WeatherCity[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({ name: text, count: "5", language: "es", format: "json" });
  const response = await fetch(`${GEOCODING_URL}?${params}`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Búsqueda no disponible (${response.status})`);
  return parseCities(await response.json());
}

/* ---- Persistencia por dispositivo (todo con try/catch: puede no haber storage) ---- */

export function loadCity(): WeatherCity | null {
  try {
    const raw = window.localStorage.getItem(WEATHER_CITY_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      isRecord(value) &&
      typeof value["name"] === "string" &&
      isNum(value["latitude"]) &&
      isNum(value["longitude"])
    ) {
      return { name: value["name"], latitude: value["latitude"], longitude: value["longitude"] };
    }
  } catch {
    // sin storage o JSON roto: se trata como "sin ciudad"
  }
  return null;
}

export function saveCity(city: WeatherCity | null): void {
  try {
    if (city) window.localStorage.setItem(WEATHER_CITY_KEY, JSON.stringify(city));
    else window.localStorage.removeItem(WEATHER_CITY_KEY);
    window.localStorage.removeItem(WEATHER_CACHE_KEY);
  } catch {
    // sin storage: la ciudad solo dura esta sesión
  }
}

export function loadCachedWeather(): WeatherNow | null {
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && isNum(value["fetchedAt"])
      ? parseForecast(
          {
            current: {
              temperature_2m: value["temperature"],
              weather_code: value["code"],
              is_day: value["isDay"] ? 1 : 0,
            },
            daily: { temperature_2m_max: [value["max"]], temperature_2m_min: [value["min"]] },
          },
          value["fetchedAt"],
        )
      : null;
  } catch {
    return null;
  }
}

export function saveCachedWeather(weather: WeatherNow): void {
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather));
  } catch {
    // no pasa nada: solo se pierde la copia sin conexión
  }
}

export function isFresh(weather: WeatherNow, now: number): boolean {
  return now - weather.fetchedAt < WEATHER_MAX_AGE_MS;
}
