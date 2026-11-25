import { CornerDownLeft } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { NOTE_KIND_IDS, NOTE_KINDS } from "@/config/categories";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { NoteKind } from "@/types/planner";

/** Quick capture for undated ideas. `compact` hides the type selector. */
export function NoteComposer({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { addNote } = usePlanner();
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<NoteKind>("idea");

  function save(e?: FormEvent) {
    e?.preventDefault();
    const clean = content.trim();
    if (!clean) return;
    addNote({ content: clean, kind });
    setContent("");
    toast.success("Nota guardada");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  }

  return (
    <form
      onSubmit={save}
      className={cn(
        "rounded-2xl border border-border bg-card p-3 transition-shadow focus-within:shadow-soft focus-within:border-primary/40",
        className,
      )}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={onKeyDown}
        rows={compact ? 2 : 3}
        placeholder="Apunta una idea, algo pendiente… sin fecha."
        aria-label="Nueva nota"
        className="w-full resize-none bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        {compact ? (
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground pointer-fine:inline-flex">
            <CornerDownLeft className="size-3" /> Enter para guardar
          </span>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto">
            {NOTE_KIND_IDS.map((id) => {
              const Icon = NOTE_KINDS[id].icon;
              return (
                <Chip key={id} selected={kind === id} onClick={() => setKind(id)}>
                  <Icon className="size-3" />
                  {NOTE_KINDS[id].label}
                </Chip>
              );
            })}
          </div>
        )}
        <Button type="submit" size="sm" disabled={!content.trim()} className="ml-auto">
          Guardar
        </Button>
      </div>
    </form>
  );
}
