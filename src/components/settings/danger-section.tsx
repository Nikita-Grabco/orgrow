import { useState } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/settings/settings-section";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/store/auth-store";

export const DELETE_CONFIRMATION = "ELIMINAR";

export function DangerSection() {
  const { deleteAccount, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const error = await deleteAccount();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    // La cuenta ya no existe: la puerta de acceso te lleva a /acceso.
    setOpen(false);
  }

  return (
    <SettingsSection
      tone="danger"
      title="Zona de peligro"
      description="Borrar la cuenta elimina para siempre tu perfil y todos tus datos del servidor. No se puede deshacer."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>

        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (busy) return;
            setOpen(next);
            if (!next) setTyped("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Borrar mi cuenta</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar tu cuenta?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán tus tareas, agenda, hábitos, notas y avisos. Te recomendamos exportar una copia
                antes. Para confirmar escribe <strong>{DELETE_CONFIRMATION}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-label="Escribe ELIMINAR para confirmar"
              autoComplete="off"
              className="h-10 rounded-xl"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={busy || typed.trim() !== DELETE_CONFIRMATION}
                onClick={() => void confirm()}
              >
                {busy ? "Borrando…" : "Borrar para siempre"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsSection>
  );
}
