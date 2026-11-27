import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeather } from "@/hooks/use-weather";
import { describeWeather, searchCities, type WeatherCity, type WeatherIcon } from "@/lib/weather";

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

function CityPicker({
  onPick,
  onCancel,
}: {
  onPick: (city: WeatherCity) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherCity[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchCities(query, controller.signal)
        .then(setResults)
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="w-full min-w-0 space-y-2 sm:w-64">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca tu ciudad"
          aria-label="Ciudad para el tiempo"
        />
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {failed && (
        <p className="text-xs text-muted-foreground">No se pudo buscar. Prueba de nuevo.</p>
      )}
      {results.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-border">
          {results.map((city) => (
            <li key={`${city.latitude},${city.longitude}`}>
              <button
                type="button"
                onClick={() => onPick(city)}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                {city.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tiempo y temperatura de la ciudad elegida (por dispositivo). */
export function WeatherWidget() {
  const { city, weather, status, hydrated, setCity } = useWeather();
  const [picking, setPicking] = useState(false);

  if (!hydrated) return <div className="h-14" aria-hidden="true" />;

  if (picking || !city) {
    if (!picking) {
      return (
        <Button variant="outline" onClick={() => setPicking(true)}>
          <MapPin />
          Añade tu ciudad para ver el tiempo
        </Button>
      );
    }
    return (
      <CityPicker
        onPick={(next) => {
          setCity(next);
          setPicking(false);
        }}
        onCancel={() => setPicking(false)}
      />
    );
  }

  const info = weather ? describeWeather(weather.code, weather.isDay) : null;
  const Icon = info ? ICONS[info.icon] : Cloud;

  return (
    <div className="flex items-center gap-3">
      <Icon className="size-10 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        {weather && info ? (
          <>
            <p className="text-2xl font-bold leading-none tabular-nums text-foreground">
              {weather.temperature}°C
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {info.label} · máx {weather.max}° mín {weather.min}°
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status === "error" ? "Tiempo no disponible" : "Cargando el tiempo…"}
          </p>
        )}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-0.5 flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <MapPin className="size-3" />
          <span className="truncate">{city.name}</span>
        </button>
      </div>
    </div>
  );
}
