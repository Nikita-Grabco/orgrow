/**
 * Orgrow · función programada `send-reminders` (Supabase Edge Function, Deno).
 *
 * pg_cron la invoca cada minuto. Busca los avisos vencidos de tareas y
 * actividades y los envía por Web Push a los dispositivos de cada usuario.
 *
 * Garantías
 *  - Cada aviso se envía como mucho una vez: primero se "reclama" (reminded_at) con una
 *    actualización condicional y solo se envía lo que esta ejecución consiguió reclamar,
 *    así dos ejecuciones solapadas no duplican avisos.
 *  - Si todos los envíos de un aviso fallan por un problema pasajero (red, 429, 5xx), se
 *    libera para reintentarlo en la siguiente ejecución.
 *  - Las suscripciones que el navegador da por muertas (404/410) se borran.
 *
 * Secretos necesarios (supabase secrets set …); SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * los pone Supabase solo:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), CRON_SECRET
 *
 * Se despliega con --no-verify-jwt: quien la llama es pg_cron (no un usuario) y se
 * autentica con la cabecera `x-cron-secret`. Ver docs/recordatorios-setup.md.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

import {
  BATCH_LIMIT,
  buildPayload,
  buildSpecialDatePayload,
  classifyPushFailure,
  dueWindow,
  groupByUser,
  isSpecialDateDue,
  localParts,
  safeEqual,
  type DueRow,
  type ReminderKind,
  type SpecialDateDueRow,
} from "./logic.ts";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta el secreto ${name}`);
  return value;
}

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  requireEnv("VAPID_SUBJECT"),
  requireEnv("VAPID_PUBLIC_KEY"),
  requireEnv("VAPID_PRIVATE_KEY"),
);

const CRON_SECRET = requireEnv("CRON_SECRET");

interface Source {
  kind: ReminderKind;
  table: "tasks" | "activities";
  /** Columna con la hora: tasks.due_time, activities.start_time. */
  timeColumn: "due_time" | "start_time";
  extra: string;
}

const SOURCES: Source[] = [
  { kind: "task", table: "tasks", timeColumn: "due_time", extra: "" },
  { kind: "activity", table: "activities", timeColumn: "start_time", extra: ", location" },
];

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

interface Summary {
  due: number;
  claimed: number;
  sent: number;
  released: number;
  removedSubscriptions: number;
}

async function processSource(source: Source, now: Date, summary: Summary): Promise<void> {
  const { from, to } = dueWindow(now);

  const { data, error } = await supabase
    .from(source.table)
    .select(`id, user_id, title, remind_before_minutes, ${source.timeColumn}${source.extra}`)
    .not("remind_at", "is", null)
    .is("reminded_at", null)
    .gte("remind_at", from)
    .lte("remind_at", to)
    .order("remind_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) throw error;

  const rows: DueRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row["id"] as string,
    user_id: row["user_id"] as string,
    title: row["title"] as string,
    remind_before_minutes: (row["remind_before_minutes"] as number | null) ?? null,
    time: (row[source.timeColumn] as string | null) ?? null,
    location: (row["location"] as string | null | undefined) ?? null,
  }));
  summary.due += rows.length;
  if (rows.length === 0) return;

  // Solo se atienden usuarios con algún dispositivo: sin él el aviso se queda
  // pendiente (hasta 24 h) por si activa los avisos en ese tiempo.
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);
  if (subsError) throw subsError;

  const subscriptionsByUser = groupByUser((subs ?? []) as Subscription[]);
  const reachable = rows.filter((row) => subscriptionsByUser.has(row.user_id));
  if (reachable.length === 0) return;

  // Reclamar: solo se envía lo que esta ejecución marcó. Si otra se adelantó, `returning` no lo devuelve.
  const { data: claimedRows, error: claimError } = await supabase
    .from(source.table)
    .update({ reminded_at: now.toISOString() })
    .in(
      "id",
      reachable.map((row) => row.id),
    )
    .is("reminded_at", null)
    .select("id");
  if (claimError) throw claimError;

  const claimedIds = new Set((claimedRows ?? []).map((row: { id: string }) => row.id));
  const toSend = reachable.filter((row) => claimedIds.has(row.id));
  summary.claimed += toSend.length;

  const gone = new Set<string>();
  const toRelease: string[] = [];

  for (const row of toSend) {
    const payload = JSON.stringify(buildPayload(source.kind, row));
    const devices = subscriptionsByUser.get(row.user_id) ?? [];

    const results = await Promise.allSettled(
      devices.map((device) =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: 60 * 60, urgency: "high" },
        ),
      ),
    );

    let delivered = 0;
    let transient = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        delivered += 1;
        return;
      }
      const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      const failure = classifyPushFailure(statusCode);
      if (failure === "gone") gone.add(devices[index]!.endpoint);
      if (failure === "retry") transient += 1;
      console.error(`push ${row.id} → ${statusCode ?? "sin respuesta"} (${failure})`);
    });

    summary.sent += delivered;
    // Nadie lo recibió y el motivo es pasajero: se libera para reintentarlo.
    if (delivered === 0 && transient > 0) toRelease.push(row.id);
  }

  if (toRelease.length > 0) {
    const { error: releaseError } = await supabase
      .from(source.table)
      .update({ reminded_at: null })
      .in("id", toRelease);
    if (releaseError) console.error("No se pudo liberar un aviso", releaseError);
    summary.released += toRelease.length;
  }

  if (gone.size > 0) {
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", [...gone]);
    if (deleteError) console.error("No se pudieron borrar suscripciones caducadas", deleteError);
    summary.removedSubscriptions += gone.size;
  }
}

/**
 * Fechas importantes (cumpleaños…): se repiten cada año, así que no usan `remind_at`.
 * Cada minuto se mira, en la zona horaria de cada usuario, si hoy toca avisar
 * (a partir de las 9:00) y se anota `last_reminded_on` para no repetir el día.
 * Si la tabla aún no existe (docs/supabase-special-dates.sql) se omite sin fallar.
 */
async function processSpecialDates(now: Date, summary: Summary): Promise<void> {
  const { data, error } = await supabase
    .from("special_dates")
    .select("id, user_id, title, kind, month, day, year, remind_before_days, last_reminded_on")
    .not("remind_before_days", "is", null)
    .limit(2000);
  if (error) {
    // 42P01 = la tabla no existe todavía.
    if (error.code === "42P01" || error.code === "PGRST205") return;
    throw error;
  }
  const rows = (data ?? []) as SpecialDateDueRow[];
  if (rows.length === 0) return;

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds);
  if (profilesError) throw profilesError;
  const zones = new Map(
    (profiles ?? []).map((p: { id: string; timezone: string }) => [p.id, p.timezone]),
  );

  const due: { row: SpecialDateDueRow; today: string }[] = [];
  for (const row of rows) {
    const { date, hour } = localParts(now, zones.get(row.user_id) ?? "UTC");
    if (isSpecialDateDue(row, date, hour)) due.push({ row, today: date });
  }
  summary.due += due.length;
  if (due.length === 0) return;

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...new Set(due.map((item) => item.row.user_id))]);
  if (subsError) throw subsError;
  const subscriptionsByUser = groupByUser((subs ?? []) as Subscription[]);

  const gone = new Set<string>();

  for (const { row, today } of due) {
    const devices = subscriptionsByUser.get(row.user_id);
    if (!devices) continue;

    // Reclamar: solo envía quien consiga anotar el día; una ejecución solapada no duplica.
    const { data: claimed, error: claimError } = await supabase
      .from("special_dates")
      .update({ last_reminded_on: today })
      .eq("id", row.id)
      .or(`last_reminded_on.is.null,last_reminded_on.neq.${today}`)
      .select("id");
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) continue;
    summary.claimed += 1;

    const payload = JSON.stringify(buildSpecialDatePayload(row, today));
    const results = await Promise.allSettled(
      devices.map((device) =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: 60 * 60, urgency: "normal" },
        ),
      ),
    );

    let delivered = 0;
    let transient = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        delivered += 1;
        return;
      }
      const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      const failure = classifyPushFailure(statusCode);
      if (failure === "gone") gone.add(devices[index]!.endpoint);
      if (failure === "retry") transient += 1;
      console.error(`push fecha ${row.id} → ${statusCode ?? "sin respuesta"} (${failure})`);
    });
    summary.sent += delivered;

    // Nadie lo recibió y el motivo es pasajero: se libera para reintentar en el siguiente minuto.
    if (delivered === 0 && transient > 0) {
      const { error: releaseError } = await supabase
        .from("special_dates")
        .update({ last_reminded_on: row.last_reminded_on })
        .eq("id", row.id);
      if (releaseError) console.error("No se pudo liberar un aviso de fecha", releaseError);
      summary.released += 1;
    }
  }

  if (gone.size > 0) {
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", [...gone]);
    if (deleteError) console.error("No se pudieron borrar suscripciones caducadas", deleteError);
    summary.removedSubscriptions += gone.size;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!safeEqual(provided, CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

  const summary: Summary = { due: 0, claimed: 0, sent: 0, released: 0, removedSubscriptions: 0 };
  const now = new Date();

  try {
    for (const source of SOURCES) await processSource(source, now, summary);
    await processSpecialDates(now, summary);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("send-reminders falló", error);
    return Response.json({ ok: false, ...summary, error: "Error interno" }, { status: 500 });
  }
});
