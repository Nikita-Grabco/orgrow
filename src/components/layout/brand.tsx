import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface BrandProps {
  compact?: boolean;
  className?: string;
  /** `false` en pantallas donde no hay navegación (acceso, splash). */
  link?: boolean;
}

/** Único sitio donde vive la marca. Nunca dupliques este marcado. */
export function Brand({ compact = false, className, link = true }: BrandProps) {
  const content = (
    <>
      <img
        src="/icons/icon-192.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-xl shadow-soft"
      />
      {!compact && (
        <span className="font-display font-semibold text-2xl leading-none text-foreground">
          orgrow
        </span>
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
