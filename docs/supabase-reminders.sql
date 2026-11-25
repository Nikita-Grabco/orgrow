-- =============================================================================
-- Orgrow · Recordatorios (Parte 8)
--
-- Se aplica DESPUÉS de docs/supabase-schema.sql, desde el SQL Editor de Supabase
-- (igual que aquel: AGENTS.md prohíbe añadir migraciones desde el repositorio).
-- Es seguro ejecutarlo más de una vez.
--
-- Cómo funciona
--   * Cada tarea o actividad guarda `remind_before_minutes` (cuánto antes avisar).
--   * Un trigger calcula `remind_at` (el instante exacto, en UTC) a partir de la
--     fecha y hora de la tarea y de la zona horaria del perfil. Así el cálculo es
--     correcto con el cambio de hora y no depende del dispositivo.
--   * La función programada `send-reminders` envía los avisos vencidos y marca
--     `reminded_at`, de modo que cada aviso se manda una sola vez.
--   * `push_subscriptions` guarda un registro por dispositivo con avisos activados.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Columnas de recordatorio
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column if not exists remind_before_minutes integer
    check (remind_before_minutes is null or remind_before_minutes between 0 and 10080),
  add column if not exists remind_at    timestamptz,
  add column if not exists reminded_at  timestamptz;

alter table public.activities
  add column if not exists remind_before_minutes integer
    check (remind_before_minutes is null or remind_before_minutes between 0 and 10080),
  add column if not exists remind_at    timestamptz,
  add column if not exists reminded_at  timestamptz;

-- Solo interesan los avisos que aún no se han enviado.
create index if not exists tasks_remind_idx
  on public.tasks (remind_at) where remind_at is not null and reminded_at is null;
create index if not exists activities_remind_idx
  on public.activities (remind_at) where remind_at is not null and reminded_at is null;


-- -----------------------------------------------------------------------------
-- remind_at lo calcula la base de datos
-- -----------------------------------------------------------------------------

-- Hora a la que se avisa una tarea que tiene fecha pero no hora.
create or replace function public.reminder_default_time()
returns time
language sql
immutable
as $$ select time '09:00' $$;

-- Instante (UTC) de un aviso: fecha + hora en la zona horaria del usuario, menos
-- el adelanto. `null` si falta algo para calcularlo.
create or replace function public.compute_remind_at(
  p_user_id uuid,
  p_day date,
  p_time time,
  p_before integer
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  tz text;
begin
  if p_before is null or p_day is null then
    return null;
  end if;

  select p.timezone into tz from public.profiles p where p.id = p_user_id;

  -- Una zona inválida no debe impedir guardar la tarea: se cae a Madrid.
  begin
    return ((p_day + coalesce(p_time, public.reminder_default_time())) at time zone coalesce(tz, 'Europe/Madrid'))
           - make_interval(mins => p_before);
  exception when others then
    return ((p_day + coalesce(p_time, public.reminder_default_time())) at time zone 'Europe/Madrid')
           - make_interval(mins => p_before);
  end;
end;
$$;

create or replace function public.tasks_set_remind_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Solo se recalcula si cambia algo que influye; así marcar `reminded_at` o
  -- cambiar la zona horaria más tarde no reabre avisos ya enviados.
  if tg_op = 'INSERT'
     or (new.due_date, new.due_time, new.completed, new.remind_before_minutes)
        is distinct from (old.due_date, old.due_time, old.completed, old.remind_before_minutes) then

    if new.completed then
      new.remind_at := null;
    else
      new.remind_at := public.compute_remind_at(new.user_id, new.due_date, new.due_time, new.remind_before_minutes);
    end if;

    if tg_op = 'UPDATE' then
      new.reminded_at := null; -- un aviso nuevo puede volver a enviarse
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.activities_set_remind_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or (new.date, new.start_time, new.remind_before_minutes)
        is distinct from (old.date, old.start_time, old.remind_before_minutes) then

    new.remind_at := public.compute_remind_at(new.user_id, new.date, new.start_time, new.remind_before_minutes);

    if tg_op = 'UPDATE' then
      new.reminded_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_remind_at on public.tasks;
create trigger tasks_set_remind_at
  before insert or update on public.tasks
  for each row execute function public.tasks_set_remind_at();

drop trigger if exists activities_set_remind_at on public.activities;
create trigger activities_set_remind_at
  before insert or update on public.activities
  for each row execute function public.activities_set_remind_at();

-- Las funciones de trigger no se llaman por la API, así que se les quita el permiso.
-- `compute_remind_at` NO se revoca: el trigger la ejecuta con los permisos de quien
-- guarda la tarea (el rol `authenticated`), y sin ellos guardar fallaría. No es un
-- riesgo: no es SECURITY DEFINER, así que solo puede leer el perfil propio por RLS.
revoke execute on function public.tasks_set_remind_at()      from public, anon, authenticated;
revoke execute on function public.activities_set_remind_at() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Dispositivos con avisos activados
-- -----------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- La URL del servicio de push del navegador: identifica al dispositivo.
  endpoint   text not null unique
    check (char_length(endpoint) <= 2000 and endpoint like 'https://%'),
  p256dh     text not null check (char_length(p256dh) between 1 and 200),
  auth       text not null check (char_length(auth) between 1 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

-- Leer y borrar las propias. Crear/actualizar solo pasa por la función de abajo.
grant select, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions: leer las propias" on public.push_subscriptions;
create policy "push_subscriptions: leer las propias"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions: borrar las propias" on public.push_subscriptions;
create policy "push_subscriptions: borrar las propias"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Registra el dispositivo actual para el usuario que ha iniciado sesión. Si ese
-- navegador ya estaba registrado por otra cuenta (se cerró sesión y entró otra
-- persona), pasa a ser de la cuenta actual: el dispositivo es de quien lo usa ahora.
create or replace function public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '28000';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id    = excluded.user_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant  execute on function public.register_push_subscription(text, text, text, text) to authenticated;


-- =============================================================================
-- Comprobaciones tras aplicarlo (ejecutar a mano, no forman parte de la migración).
-- Todo se deshace solo: termina con un error intencionado.
--
-- do $$
-- declare
--   a uuid := gen_random_uuid();
--   b uuid := gen_random_uuid();
--   t1 uuid;
--   t2 uuid;
--   n  int;
--   r  text := E'\n';
--   v  timestamptz;
-- begin
--   insert into auth.users (id, email) values (a, 'a-test@example.invalid'), (b, 'b-test@example.invalid');
--   update public.profiles set timezone = 'Europe/Madrid' where id = a;
--
--   -- 1) remind_at: 10:00 de Madrid en invierno (UTC+1) menos 60 min = 08:00 UTC
--   insert into public.tasks (user_id, title, category, priority, due_date, due_time, remind_before_minutes)
--     values (a, 'Invierno', 'personal', 'media', '2026-12-01', '10:00', 60) returning id into t1;
--   select remind_at into v from public.tasks where id = t1;
--   r := r || format('1) invierno 10:00 -60min = %s: %s', v, case when v = '2026-12-01 08:00:00+00' then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 2) en verano (UTC+2): 10:00 Madrid = 08:00 UTC, aviso a la hora
--   insert into public.tasks (user_id, title, category, priority, due_date, due_time, remind_before_minutes)
--     values (a, 'Verano', 'personal', 'media', '2026-07-01', '10:00', 0) returning id into t2;
--   select remind_at into v from public.tasks where id = t2;
--   r := r || format('2) verano 10:00 a la hora = %s: %s', v, case when v = '2026-07-01 08:00:00+00' then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 3) sin hora se avisa a las 09:00 locales (invierno = 08:00 UTC)
--   update public.tasks set due_time = null, due_date = '2026-12-02', remind_before_minutes = 0 where id = t1;
--   select remind_at into v from public.tasks where id = t1;
--   r := r || format('3) sin hora (09:00 local) = %s: %s', v, case when v = '2026-12-02 08:00:00+00' then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 4) editar solo el título no reabre un aviso ya enviado
--   update public.tasks set reminded_at = now() where id = t2;
--   update public.tasks set title = 'Verano (editada)' where id = t2;
--   select count(*) into n from public.tasks where id = t2 and reminded_at is not null;
--   r := r || format('4) cambiar el título conserva reminded_at: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 5) cambiar la hora sí lo reabre
--   update public.tasks set due_time = '11:00' where id = t2;
--   select count(*) into n from public.tasks where id = t2 and reminded_at is null;
--   r := r || format('5) cambiar la hora reabre el aviso: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 6) completar la tarea cancela el aviso; sin recordatorio no hay remind_at
--   update public.tasks set completed = true where id = t2;
--   select count(*) into n from public.tasks where id = t2 and remind_at is null;
--   r := r || format('6) completada => sin aviso: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--   update public.tasks set completed = false, remind_before_minutes = null where id = t2;
--   select count(*) into n from public.tasks where id = t2 and remind_at is null;
--   r := r || format('7) sin recordatorio => remind_at nulo: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 7b) guardar COMO USUARIO (rol authenticated, no como postgres) también calcula
--   --     remind_at: si faltara algún permiso, este insert fallaría
--   set local role authenticated;
--   perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
--   insert into public.tasks (title, category, priority, due_date, due_time, remind_before_minutes)
--     values ('Como usuario', 'personal', 'media', '2026-12-01', '10:00', 10);
--   select count(*) into n from public.tasks where title = 'Como usuario' and remind_at = '2026-12-01 08:50:00+00';
--   r := r || format('7b) insertar como usuario calcula remind_at: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 8) un dispositivo registrado por A pasa a B si B inicia sesión en él
--   perform public.register_push_subscription('https://push.example.invalid/abc', 'k', 'a', 'test');
--   perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
--   select count(*) into n from public.push_subscriptions;
--   r := r || format('8a) B no ve la suscripcion de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
--   perform public.register_push_subscription('https://push.example.invalid/abc', 'k2', 'a2', 'test');
--   select count(*) into n from public.push_subscriptions;
--   r := r || format('8b) al registrarla B pasa a ser suya: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 9) sin sesión (anon) no se puede registrar nada
--   reset role;
--   set local role anon;
--   begin
--     perform public.register_push_subscription('https://push.example.invalid/x', 'k', 'a', 'test');
--     r := r || E'9) anon no puede registrar: FALLO\n';
--   exception when others then
--     r := r || E'9) anon no puede registrar: OK\n';
--   end;
--   reset role;
--
--   raise exception 'RESULTADO (error intencionado para deshacerlo todo):%', r;
-- end;
-- $$;
-- =============================================================================
