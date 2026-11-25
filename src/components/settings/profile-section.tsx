import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deviceTimeZone } from "@/lib/push";
import { useAuth } from "@/store/auth-store";

const FALLBACK_ZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Mexico_City",
  "America/Bogota",
  "America/Argentina/Buenos_Aires",
  "UTC",
];

function timeZones(current: string): string[] {
  let zones = FALLBACK_ZONES;
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf;
    zones = supported?.("timeZone") ?? FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

export function ProfileSection() {
  const { email, profileName, displayName, timezone, updateProfile } = useAuth();

  const [name, setName] = useState(profileName);
  const [zone, setZone] = useState(timezone ?? deviceTimeZone() ?? "Europe/Madrid");
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => timeZones(zone), [zone]);
  const device = deviceTimeZone();

  const dirty = name.trim() !== profileName.trim() || zone !== (timezone ?? "");

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const error = await updateProfile({ displayName: name, timezone: zone });
    setSaving(false);
    if (error) toast.error(error);
    else toast.success("Perfil guardado");
  }

  return (
    <SettingsSection
      title="Perfil"
      description="Cómo te llamamos y en qué zona horaria están tus avisos."
    >
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="eyebrow">Nombre</span>
          <Input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder={displayName}
            aria-label="Nombre"
            className="h-10 rounded-xl"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="eyebrow">Zona horaria</span>
          <select
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            aria-label="Zona horaria"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {zones.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {device && device !== zone && (
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setZone(device)}
            >
              Usar la de este dispositivo ({device})
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Los avisos ya programados conservan su hora; los nuevos o editados usan esta zona.
          </p>
        </label>

        {email && <p className="text-xs text-muted-foreground">Cuenta: {email}</p>}

        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </SettingsSection>
  );
}
