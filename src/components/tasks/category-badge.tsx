import { CATEGORIES } from "@/config/categories";
import { cn } from "@/lib/utils";
import type { CategoryId } from "@/types/planner";

export function CategoryBadge({
  category,
  className,
}: {
  category: CategoryId;
  className?: string;
}) {
  const c = CATEGORIES[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        c.soft,
        c.ink,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
