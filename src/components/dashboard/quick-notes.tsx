import { Link } from "@tanstack/react-router";
import { ArrowRight, NotebookPen } from "lucide-react";

import { SectionCard } from "@/components/common/section-card";
import { NoteCard } from "@/components/notes/note-card";
import { NoteComposer } from "@/components/notes/note-composer";
import { sortNotes } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";

export function QuickNotes() {
  const { notes } = usePlanner();
  const latest = sortNotes(notes).slice(0, 3);

  return (
    <SectionCard
      title="Ideas y notas"
      icon={<NotebookPen />}
      action={
        <Link
          to="/notas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver todas <ArrowRight className="size-3" />
        </Link>
      }
    >
      <NoteComposer compact />
      <div className="mt-3 flex flex-col gap-2.5">
        {latest.map((n) => (
          <NoteCard key={n.id} note={n} compact />
        ))}
      </div>
    </SectionCard>
  );
}
