import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * Invita a instalar Orgrow como app. Solo aparece si se puede instalar y aún no
 * se ha hecho ni descartado; en iPhone/iPad explica los pasos porque Safari no
 * ofrece un botón.
 */
export function InstallCard() {
  const { mode, install, dismiss } = useInstallPrompt();
  if (mode === "hidden") return null;

  return (
    <section className="surface relative flex items-start gap-4 p-4 pr-12 sm:items-center sm:p-5 sm:pr-14">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Download className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-foreground">Instala Orgrow en este dispositivo</h2>
        {mode === "prompt" ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Se abre como una app, más rápida y también sin conexión.
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pulsa <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Compartir" /> y
            elige <SquarePlus className="mx-0.5 inline size-4 align-text-bottom" aria-hidden />{" "}
            <strong className="font-semibold text-foreground">Añadir a pantalla de inicio</strong>.
          </p>
        )}
      </div>

      {mode === "prompt" && (
        <Button size="sm" onClick={() => void install()} className="shrink-0">
          Instalar
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="No volver a mostrar"
        className="absolute right-2 top-2"
        onClick={dismiss}
      >
        <X />
      </Button>
    </section>
  );
}
