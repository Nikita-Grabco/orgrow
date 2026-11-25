/** Lee un adelanto de aviso guardado (minutos enteros ≥ 0); cualquier otra cosa es "sin dato". */
export function readRemindBefore(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}
