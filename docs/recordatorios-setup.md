# Puesta en marcha de los recordatorios (Parte 8)

El código de la app ya está. Para que lleguen los avisos hay que preparar tu proyecto de
Supabase y las claves. **Hasta que lo hagas, la app funciona igual que antes** (los
recordatorios simplemente no aparecen).

Orden: 1 SQL → 2 claves → 3 función → 4 programarla → 5 variable en el hosting → 6 probar.

> Nunca pegues la clave privada, `CRON_SECRET` ni la *service role key* en el repositorio,
> en un chat ni en una captura. La única clave que va al navegador es la pública (`VITE_VAPID_PUBLIC_KEY`).

---

## 1. Aplicar el SQL

1. Supabase → **SQL Editor** → **New query**.
2. Pega todo `docs/supabase-reminders.sql` y pulsa **Run**. Se puede ejecutar más de una vez.
3. Pega y ejecuta el bloque de comprobaciones que está comentado al final del mismo archivo
   (quita los `-- ` del principio de cada línea). Debe salir un error que empieza por
   `RESULTADO` con todas las líneas en `OK`. Si alguna sale `FALLO`, no sigas: pásamela.

## 2. Generar las claves

En la carpeta del proyecto:

```powershell
node scripts/generate-vapid-keys.mjs
```

Imprime tres cosas. **No se guarda nada en disco**; copia cada valor donde corresponde:

| Valor | Dónde va |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | `.env.local` (y el paso 5). Es pública. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` | Solo como **secretos de Supabase** (paso 3). |
| `VAPID_SUBJECT` | `mailto:` + un email de contacto tuyo. Solo lo ve el servicio de push. |

Guarda la clave privada en tu gestor de contraseñas. Si la pierdes hay que generar otro par
y volver a activar los avisos en cada dispositivo.

## 3. Desplegar la función

La función está en `docs/supabase-functions/send-reminders/` (`index.ts` + `logic.ts`).
Se despliega **desde una carpeta temporal fuera del repositorio**, para no crear una carpeta
`supabase/` en el proyecto (que está conectado a Lovable):

```powershell
$work = Join-Path $env:TEMP "orgrow-functions"
New-Item -ItemType Directory -Force "$work\supabase\functions\send-reminders" | Out-Null
Copy-Item docs\supabase-functions\send-reminders\* "$work\supabase\functions\send-reminders\"
Set-Location $work

npx supabase login
```

Sustituye `TU_REF` por el identificador de tu proyecto (lo que va antes de `.supabase.co`) y los
valores por los que imprimió el script:

```powershell
npx supabase secrets set --project-ref TU_REF `
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@email CRON_SECRET=...

npx supabase functions deploy send-reminders --project-ref TU_REF --no-verify-jwt --use-api
```

- `--no-verify-jwt`: quien la llama es el planificador de la base de datos, no un usuario. Se
  protege con `CRON_SECRET` (la función responde 401 sin él).
- `--use-api`: despliega sin necesitar Docker.

Comprobación rápida (debe responder **401**, porque no lleva el secreto):

```powershell
curl.exe -i -X POST https://TU_REF.supabase.co/functions/v1/send-reminders
```

## 4. Programarla cada minuto

En el **SQL Editor**, sustituyendo `TU_REF` y `TU_CRON_SECRET` (el mismo valor del paso 2):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://TU_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'TU_CRON_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);
```

El secreto queda en el texto de la tarea programada (solo lo lee el rol `postgres`). Para pausar
los avisos: `select cron.unschedule('send-reminders');`.

## 5. Variable en el hosting

Añade `VITE_VAPID_PUBLIC_KEY` (solo la **pública**) a las variables de entorno de donde se
despliega la app y vuelve a desplegar. Sin ella, el despliegue no mostrará los recordatorios.
En local ponla también en `.env.local`.

## 6. Probar

1. Abre la app **desplegada** (los avisos no funcionan con `npm run dev`: no hay service worker).
   En iPhone/iPad, instálala en la pantalla de inicio y ábrela desde ahí.
2. En el inicio pulsa **Activar avisos** y acepta el permiso.
3. Crea una tarea para hoy, con una hora dentro de 3 minutos y **Avisarme → A la hora**.
4. Espera. Debe llegar la notificación; al pulsarla abre la app.

Si no llega, mira por este orden:

```sql
-- ¿se está ejecutando el planificador?
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;

-- ¿qué respondió la función?
select status_code, content, created from net._http_response order by created desc limit 5;

-- ¿el aviso tiene remind_at y aún no se envió? ¿hay dispositivo registrado?
select title, remind_at, reminded_at from public.tasks where remind_at is not null order by remind_at desc limit 5;
select user_id, left(endpoint, 40) as endpoint, created_at from public.push_subscriptions;
```

| Síntoma | Causa probable |
|---|---|
| La función responde 401 | `CRON_SECRET` distinto entre el secreto de Supabase y la tarea programada |
| 500 con "Falta el secreto …" | Falta algún `supabase secrets set` del paso 3 |
| `remind_at` vacío | El SQL del paso 1 no se aplicó, o la tarea no tiene fecha |
| `reminded_at` relleno pero sin notificación | Mira los logs de la función; un 403 suele ser clave VAPID distinta entre la app y el servidor |
| No hay filas en `push_subscriptions` | Pulsaste "Activar avisos" en `npm run dev` o sin la clave pública en el build |

## Cómo funciona (resumen)

- Cada tarea o actividad guarda **cuánto antes avisar**. La base de datos calcula el instante
  exacto (`remind_at`) con la fecha, la hora y **la zona horaria del perfil**, así que es correcta
  con el cambio de hora. Una tarea con fecha pero sin hora se avisa a las 09:00 locales.
- La zona horaria del perfil se actualiza con la del dispositivo al activar los avisos. Si viajas o
  la cambias, los avisos **ya creados** conservan su hora; los nuevos o editados usan la nueva.
- Completar una tarea cancela su aviso. Cambiar fecha, hora o adelanto lo reabre.
- Cada aviso se envía **una sola vez**. Si el servicio de push falla de forma pasajera se reintenta
  cada minuto; los avisos con más de 24 h de retraso se descartan.
- Cerrar sesión da de baja los avisos de ese dispositivo.
