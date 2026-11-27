import { WeatherWidget } from "@/components/dashboard/weather-widget";
import { useToday } from "@/hooks/use-today";
import { formatLongDate, getGreeting } from "@/lib/dates";
import { useAuth } from "@/store/auth-store";

export function GreetingHeader() {
  const { displayName } = useAuth();
  const today = useToday();

  return (
    <header className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="min-w-0">
        <h1 className="font-display font-semibold text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {today ? getGreeting(today.getHours()) : "Hola"},{" "}
          <em className="not-italic text-primary">{displayName}</em>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          <span className="inline-block min-h-[1em]">{today ? formatLongDate(today) : " "}</span>
        </p>
      </div>
      <WeatherWidget />
    </header>
  );
}
