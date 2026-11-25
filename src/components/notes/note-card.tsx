import { Check, ListPlus, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { NOTE_KIND_IDS, NOTE_KINDS } from "@/config/categories";
import { cn } from "@/lib/utils";
import { usePlanner } from "@/store/planner-store";
import type { Note, NoteKind } from "@/types/planner";

export function NoteCard({ note, compact = false }: { note: Note; compact?: boolean }) {
  const { togglePinNote, deleteNote, convertNoteToTask, editNote } = usePlanner();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [draftKind, setDraftKind] = useState<NoteKind>(note.kind);

  const kind = NOTE_KINDS[note.kind];
  const Icon = kind.icon;

  function startEditing() {
    // Siempre se parte de lo guardado: un borrador abandonado no reaparece.
    setDraft(note.content);
    setDraftKind(note.kind);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    if (!draft.trim()) return;
    const changed = draft.trim() !== note.content || draftKind !== note.kind;
    if (!changed) {
      setEditing(false);
      return;
    }
    if (editNote(note.id, { content: draft, kind: draftKind })) {
      setEditing(false);
      toast.success("Nota actualizada");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing && !compact) {
    return (
      <article className="mb-4 break-inside-avoid rounded-2xl border border-primary/40 bg-card p-4 shadow-soft sm:p-5">
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={4}
          aria-label="Editar nota"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground focus:outline-none"
        />
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {NOTE_KIND_IDS.map((id) => {
            const KindIcon = NOTE_KINDS[id].icon;
            return (
              <Chip key={id} selected={draftKind === id} onClick={() => setDraftKind(id)}>
                <KindIcon className="size-3" />
                {NOTE_KINDS[id].label}
              </Chip>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={cancel}>
            <X /> Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!draft.trim()}>
            <Check /> Guardar
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group relative break-inside-avoid rounded-2xl border border-border/60 transition-shadow hover:shadow-soft",
        kind.soft,
        compact ? "p-3.5" : "mb-4 p-4 sm:p-5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider", kind.ink)}>
          <Icon className="size-3.5" />
          {kind.label}
        </span>
        {note.pinned && <Pin className={cn("size-3.5 fill-current", kind.ink)} aria-label="Fijada" />}
      </div>
      <p className={cn("mt-2 whitespace-pre-line text-foreground", compact ? "line-clamp-2 text-sm" : "text-[15px] leading-relaxed")}>
        {note.content}
      </p>

      {!compact && (
        <div className="mt-4 flex items-center gap-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              convertNoteToTask(note.id);
              toast.success("Convertida en tarea para hoy");
            }}
          >
            <ListPlus /> A tarea
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Editar nota" onClick={startEditing}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={note.pinned ? "Desfijar nota" : "Fijar nota"}
            onClick={() => togglePinNote(note.id)}
          >
            {note.pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar nota"
            className="ml-auto"
            onClick={() => {
              deleteNote(note.id);
              toast("Nota eliminada");
            }}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </article>
  );
}
