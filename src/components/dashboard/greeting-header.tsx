import { WeatherWidget } from "@/components/dashboard/weather-widget";
import { useToday } from "@/hooks/use-today";
import { formatLongDate, getGreeting } from "@/lib/dates";
import { verseForDate } from "@/lib/verses";
import { useAuth } from "@/store/auth-store";

export function GreetingHeader() {
  const { displayName } = useAuth();
  const today = useToday();
  const verse = today ? verseForDate(today) : null;

  return (
    <header className="surface animate-in fade-in slide-in-from-bottom-2 p-5 duration-500 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display font-semibold text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            {today ? getGreeting(today.getHours()) : "Hola"},{" "}
            <em className="not-italic text-primary">{displayName}</em>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            <span className="inline-block min-h-[1em]">{today ? formatLongDate(today) : " "}</span>
          </p>
        </div>
        <WeatherWidget />
      </div>

      {verse && (
        <figure className="mt-4 border-t border-border pt-4">
          <blockquote className="font-display text-base italic leading-snug text-foreground sm:text-lg">
            “{verse.text}”
          </blockquote>
          <figcaption className="mt-1 text-xs font-semibold text-muted-foreground">
            {verse.reference} · RV1909
          </figcaption>
        </figure>
      )}
    </header>
  );
}
