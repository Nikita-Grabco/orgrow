import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/page-header";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DangerSection } from "@/components/settings/danger-section";
import { DataSection } from "@/components/settings/data-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { useAuth } from "@/store/auth-store";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Orgrow" },
      { name: "description", content: "Tu perfil, avisos, copia de seguridad y cuenta." },
      { property: "og:title", content: "Ajustes — Orgrow" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profileName, timezone } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Cuenta" title="Ajustes" description="Perfil, avisos y tus datos." />
      {/* El formulario toma sus valores iniciales del perfil: se vuelve a montar cuando este carga. */}
      <ProfileSection key={`${profileName}:${timezone ?? ""}`} />
      <AppearanceSection />
      <NotificationsSection />
      <DataSection />
      <DangerSection />
    </div>
  );
}
