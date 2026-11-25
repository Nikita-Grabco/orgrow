import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface BrandProps {
  compact?: boolean;
  className?: string;
  /** `false` en pantallas donde no hay navegación (acceso, splash). */
  link?: boolean;
  /** Color del borde del punto: el fondo sobre el que se apoya la marca. */
  surface?: "sidebar" | "background";
}

/** Único sitio donde vive la marca. Nunca dupliques este marcado. */
export function Brand({ compact = false, className, link = true, surface = "sidebar" }: BrandProps) {
  const content = (
    <>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <span className="font-display font-semibold text-xl leading-none">o</span>
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 bg-personal",
            surface === "sidebar" ? "border-sidebar" : "border-background",
          )}
        />
      </span>
      {!compact && (
        <span className="font-display font-semibold text-2xl leading-none text-foreground">orgrow</span>
      )}
    </>
  );

  if (!link) {
    return (
      <span className={cn("flex items-center gap-2.5", className)} aria-label="Orgrow">
        {content}
      </span>
    );
  }

  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="Orgrow, inicio">
      {content}
    </Link>
  );
}
