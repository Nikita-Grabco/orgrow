import { Chip } from "@/components/common/chip";
import { SettingsSection } from "@/components/settings/settings-section";
import { useTheme } from "@/hooks/use-theme";
import { THEME_OPTIONS } from "@/lib/theme";

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <SettingsSection
      title="Apariencia"
      description="Claro, oscuro o el que use tu dispositivo. Se guarda en este dispositivo."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tema">
        {THEME_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            selected={preference === option.value}
            onClick={() => setPreference(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </SettingsSection>
  );
}
