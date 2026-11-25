import type { ReactNode } from "react";

/** Bloque con título para la página de ajustes. */
export function SettingsSection({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={
        tone === "danger"
          ? "surface space-y-4 border-destructive/40 p-5 sm:p-6"
          : "surface space-y-4 p-5 sm:p-6"
      }
    >
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
