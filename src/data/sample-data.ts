import type { Activity, Note, Task } from "@/types/planner";
import type { CategoryId, Priority } from "@/types/planner";
import { isoFromOffset } from "@/lib/dates";

/** Example data for the first run. Replace with real data sources later. */

interface TaskSeed {
  title: string;
  category: CategoryId;
  priority: Priority;
  /** Days from today, converted to a real `dueDate` when seeded. */
  offset: number;
  time?: string;
  completed?: boolean;
}

const SAMPLE_TASK_SEEDS: TaskSeed[] = [
  { title: "Revisar correos y priorizar el día", category: "trabajo", priority: "media", offset: 0, time: "08:30", completed: true },
  { title: "Llamada con el equipo de diseño", category: "trabajo", priority: "alta", offset: 0, time: "10:00", completed: true },
  { title: "Preparar la presentación del proyecto", category: "trabajo", priority: "alta", offset: 0, time: "12:00" },
  { title: "Pagar la factura de la luz", category: "hogar", priority: "alta", offset: 0 },
  { title: "Comprar fruta y verduras", category: "hogar", priority: "baja", offset: 0, time: "18:30" },
  { title: "Salir a correr 30 minutos", category: "salud", priority: "media", offset: 0, time: "19:30" },
  { title: "Llamar a mamá", category: "personal", priority: "media", offset: 0, time: "21:00" },
  { title: "Leer 20 páginas", category: "personal", priority: "baja", offset: 0, completed: true },
  { title: "Enviar el informe mensual", category: "trabajo", priority: "alta", offset: 1, time: "11:00" },
  { title: "Reservar mesa para el cumpleaños", category: "personal", priority: "media", offset: 1 },
  { title: "Estiramientos antes de dormir", category: "salud", priority: "baja", offset: 1, time: "22:30" },
  { title: "Regar las plantas", category: "hogar", priority: "baja", offset: 2 },
  { title: "Revisar presupuesto del mes", category: "personal", priority: "media", offset: 3, time: "20:00" },
  { title: "Actualizar el portfolio", category: "trabajo", priority: "baja", offset: 5 },
];

/** Builds the demo tasks with real dates, so they age like any other task. */
export function createSampleTasks(today: Date): Task[] {
  const now = Date.now();
  return SAMPLE_TASK_SEEDS.map((seed, index) => ({
    id: `t${index + 1}`,
    title: seed.title,
    category: seed.category,
    priority: seed.priority,
    dueDate: isoFromOffset(seed.offset, today),
    time: seed.time,
    completed: seed.completed ?? false,
    completedAt: seed.completed ? now : null,
    // Staggered so the seeded order stays stable before any edit.
    createdAt: now - (SAMPLE_TASK_SEEDS.length - index) * 60_000,
    updatedAt: now,
  }));
}

export const sampleActivities: Activity[] = [
  { id: "a1", title: "Reunión semanal del equipo", category: "trabajo", dayOffset: 0, start: "10:00", end: "11:00", location: "Sala Norte" },
  { id: "a2", title: "Comida con Laura", category: "personal", dayOffset: 0, start: "14:00", end: "15:30", location: "Café Central" },
  { id: "a3", title: "Clase de yoga", category: "salud", dayOffset: 0, start: "19:00", end: "20:00", location: "Estudio Om" },
  { id: "a4", title: "Cita con el dentista", category: "salud", dayOffset: 1, start: "09:30", end: "10:15", location: "Clínica Sonrisa" },
  { id: "a5", title: "Revisión de sprint", category: "trabajo", dayOffset: 1, start: "16:00", end: "17:00", location: "Videollamada" },
  { id: "a6", title: "Cumpleaños de Carlos", category: "personal", dayOffset: 2, start: "21:00", location: "Casa de Carlos" },
  { id: "a7", title: "Recoger paquete", category: "hogar", dayOffset: 3, start: "11:00", location: "Oficina de correos" },
  { id: "a8", title: "Taller de cerámica", category: "personal", dayOffset: 5, start: "18:00", end: "20:00", location: "Barro Studio" },
  { id: "a9", title: "Revisión anual médica", category: "salud", dayOffset: 6, start: "08:45", location: "Centro de salud" },
];

const now = 1_700_000_000_000;
const hour = 3_600_000;

export function createSampleNotes(): Note[] {
  return [
    { id: "n1", content: "Aprender a hacer pan de masa madre los domingos.", kind: "idea", pinned: true, createdAt: now - 2 * hour },
    { id: "n2", content: "Renovar el pasaporte antes del verano.", kind: "recordatorio", pinned: true, createdAt: now - 5 * hour },
    { id: "n3", content: "Planificar un viaje a Lisboa en primavera: barrio de Alfama, tranvía 28 y pasteles de Belém.", kind: "idea", pinned: false, createdAt: now - 26 * hour },
    { id: "n4", content: "Organizar el armario y donar la ropa que ya no uso.", kind: "por-hacer", pinned: false, createdAt: now - 30 * hour },
    { id: "n5", content: "Libro recomendado: «Hábitos atómicos».", kind: "idea", pinned: false, createdAt: now - 50 * hour },
    { id: "n6", content: "Cambiar el filtro del agua.", kind: "por-hacer", pinned: false, createdAt: now - 72 * hour },
    { id: "n7", content: "Preguntar a Ana por la receta del curry.", kind: "recordatorio", pinned: false, createdAt: now - 90 * hour },
  ];
}
