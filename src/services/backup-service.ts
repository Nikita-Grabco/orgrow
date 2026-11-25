import { backupFileName, type BackupFile } from "@/lib/backup";
import { getSupabaseClient } from "@/services/supabase-client";
import { importPlannerData, type ImportPayload } from "@/services/supabase-repositories";

/** Descarga la copia como archivo .json (sin pasar por ningún servidor). */
export function downloadBackup(file: BackupFile, now: Date = new Date()): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName(now);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Se libera después del clic para que el navegador alcance a iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Sube los datos de una copia ya validada. Necesita conexión. Devuelve un mensaje si falla. */
export async function restoreBackup(payload: ImportPayload): Promise<string | null> {
  try {
    await importPlannerData(getSupabaseClient(), payload);
    return null;
  } catch (error) {
    console.error("[orgrow] No se pudo importar la copia", error);
    return "No se pudo importar la copia. Comprueba tu conexión e inténtalo de nuevo.";
  }
}
