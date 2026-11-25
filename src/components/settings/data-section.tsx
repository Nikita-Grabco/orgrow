import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { MAX_BACKUP_CHARS, assignBackupIds, createBackup, parseBackup } from "@/lib/backup";
import { downloadBackup, restoreBackup } from "@/services/backup-service";
import { useAuth } from "@/store/auth-store";
import { usePlanner } from "@/store/planner-store";

export function DataSection() {
  const { user } = useAuth();
  const { tasks, notes, activities, habits, habitLogs, reloadData } = usePlanner();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function exportData() {
    const file = createBackup({ tasks, notes, activities, habits, habitLogs }, user?.id ?? null, new Date());
    downloadBackup(file);
    toast.success("Copia descargada", { description: "Guárdala en un lugar seguro: contiene todos tus datos." });
  }

  async function importFile(file: File) {
    if (!user) return;
    if (file.size > MAX_BACKUP_CHARS) {
      toast.error("El archivo es demasiado grande.");
      return;
    }

    setImporting(true);
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }

      const payload = assignBackupIds(parsed.backup, user.id);
      const total = payload.tasks.length + payload.notes.length + payload.activities.length + payload.habits.length;
      if (total === 0) {
        toast.error("La copia no contiene datos que importar.");
        return;
      }

      const error = await restoreBackup(payload);
      if (error) {
        toast.error(error);
        return;
      }
      await reloadData();

      const skipped = parsed.backup.skipped;
      toast.success(`Importados ${total} elementos`, {
        ...(skipped > 0 ? { description: `${skipped} no eran válidos y se omitieron.` } : {}),
      });
    } catch (error) {
      console.error("[orgrow] Error al importar", error);
      toast.error("No se pudo leer el archivo.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <SettingsSection
      title="Tus datos"
      description="Descarga una copia de todo (tareas, agenda, hábitos y notas) o restáurala desde un archivo."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportData}>
          <Download /> Exportar copia
        </Button>
        <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
          <Upload /> {importing ? "Importando…" : "Importar copia"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Archivo de copia de seguridad"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Importar añade o actualiza elementos; no borra nada de lo que ya tienes. Importar el mismo archivo
        dos veces no duplica datos.
      </p>
    </SettingsSection>
  );
}
