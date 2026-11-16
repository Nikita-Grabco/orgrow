import { useAuth } from "@/store/auth-store";
import { cn } from "@/lib/utils";

export function UserAvatar({ className }: { className?: string }) {
  const { displayName, initials } = useAuth();
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground",
        className,
      )}
      aria-label={displayName}
      title={displayName}
    >
      {initials}
    </span>
  );
}
