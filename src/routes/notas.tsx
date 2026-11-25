import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen, Search, SearchX, X } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/common/chip";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NoteCard } from "@/components/notes/note-card";
import { NoteComposer } from "@/components/notes/note-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_KIND_IDS, NOTE_KINDS } from "@/config/categories";
import { filterNotes, sortNotes } from "@/lib/planner";
import { usePlanner } from "@/store/planner-store";
import type { NoteKind } from "@/types/planner";

export const Route = createFileRoute("/notas")({
  head: () => ({
    meta: [
      { title: "Notas e ideas — Orgrow" },
      {
        name: "description",
        content:
          "Apunta ideas y cosas que quieres hacer algún día, sin fecha, para que no se te olviden.",
      },
      { property: "og:title", content: "Notas e ideas — Orgrow" },
      {
        property: "og:description",
        content: "Ideas y pendientes sin fecha, para que no se te olviden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { notes } = usePlanner();
  const [filter, setFilter] = useState<NoteKind | "todas">("todas");
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 0;
  // Los contadores de los chips respetan la búsqueda: muestran cuántas notas verás al elegirlos.
  const matching = filterNotes(notes, { query });
  const visible = sortNotes(filterNotes(notes, { kind: filter, query }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Sin fecha"
        title="Notas e ideas"
        description="Lo que tienes en mente para algún día. Conviértelo en tarea cuando llegue el momento."
      />

      <NoteComposer className="max-w-2xl" />

      <div className="relative max-w-2xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setQuery("")}
          placeholder="Buscar en tus notas…"
          aria-label="Buscar notas"
          className="h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Borrar búsqueda"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => setQuery("")}
          >
            <X />
          </Button>
        )}
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <Chip selected={filter === "todas"} onClick={() => setFilter("todas")}>
          Todas <span className="opacity-70">{matching.length}</span>
        </Chip>
        {NOTE_KIND_IDS.map((id) => {
          const Icon = NOTE_KINDS[id].icon;
          return (
            <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>
              <Icon className="size-3" />
              {NOTE_KINDS[id].label}
              <span className="opacity-70">{matching.filter((n) => n.kind === id).length}</span>
            </Chip>
          );
        })}
      </div>

      {visible.length ? (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      ) : searching ? (
        <EmptyState
          icon={<SearchX />}
          title="Sin resultados"
          description={`Ninguna nota contiene "${query.trim()}"${filter === "todas" ? "" : " en este tipo"}.`}
        />
      ) : (
        <EmptyState
          icon={<NotebookPen />}
          title="Aún no hay notas aquí"
          description="Escribe arriba tu primera idea."
        />
      )}
    </div>
  );
}
