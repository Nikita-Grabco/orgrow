-- =============================================================================
-- Orgrow · Esquema de base de datos (Parte 3)
--
-- Propuesta completa, lista para aplicar. NO es una migración del repositorio:
-- AGENTS.md prohíbe añadir archivos a supabase/migrations/ desde aquí, así que
-- este archivo se aplica desde Lovable (que crea la migración) o, si el
-- proyecto de Supabase es propio, desde su SQL Editor.
--
-- Principios
--   * Todo es privado por usuario: RLS activada en TODAS las tablas.
--   * `user_id` lo rellena el servidor (default auth.uid()); el cliente nunca
--     decide de quién es una fila, y las políticas lo impiden igualmente.
--   * Las fechas de calendario son `date` (sin zona horaria), igual que el
--     "YYYY-MM-DD" de la app; las horas son `time`.
--   * Restricciones CHECK que reflejan lo que ya valida el cliente, por si
--     alguien escribe directamente contra la API.
--   * Los ids son uuid. El cliente los generará (crypto.randomUUID) en la
--     Parte 4; al importar los datos locales ("t-ab12…") se les asigna uno nuevo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- profiles: una fila por usuario de auth.users
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  -- Zona horaria IANA; la usarán los recordatorios (Parte 8).
  timezone     text not null default 'Europe/Madrid',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrarse. El nickname del formulario viaja en
-- raw_user_meta_data->>'full_name' (ver src/store/auth-store.tsx).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo la dispara el trigger; nadie debe poder llamarla por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían antes de este esquema.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), ''), 60)
from auth.users u
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  category     text not null check (category in ('trabajo', 'personal', 'salud', 'hogar')),
  priority     text not null check (priority in ('alta', 'media', 'baja')),
  due_date     date,                -- null = sin fecha
  due_time     time,                -- opcional
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- completed_at solo tiene sentido en tareas completadas.
  check (completed or completed_at is null)
);

create index tasks_user_due_idx       on public.tasks (user_id, due_date);
create index tasks_user_completed_idx on public.tasks (user_id, completed);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- notes
-- -----------------------------------------------------------------------------

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content    text not null check (char_length(btrim(content)) between 1 and 4000),
  kind       text not null check (kind in ('idea', 'por-hacer', 'recordatorio')),
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_created_idx on public.notes (user_id, created_at desc);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- activities (agenda)
-- -----------------------------------------------------------------------------

create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  category   text not null check (category in ('trabajo', 'personal', 'salud', 'hogar')),
  date       date not null,
  start_time time not null,
  end_time   time,
  location   text check (location is null or char_length(location) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Igual que el formulario: el fin debe ser posterior al inicio.
  check (end_time is null or end_time > start_time)
);

create index activities_user_date_idx on public.activities (user_id, date, start_time);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- habits
-- -----------------------------------------------------------------------------

create table public.habits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  -- check = sí/no · count = cantidad con meta · time = minutos con meta
  kind            text not null check (kind in ('check', 'count', 'time')),
  target          numeric(10, 2) not null check (target > 0),   -- meta diaria
  step            numeric(10, 2) not null check (step > 0),     -- lo que suma cada toque
  unit            text check (unit is null or char_length(unit) <= 20),  -- solo kind = 'count'
  -- Frecuencia: daily | weekdays (días 0 = lunes … 6 = domingo) | weekly (X veces)
  frequency_type  text not null check (frequency_type in ('daily', 'weekdays', 'weekly')),
  frequency_days  smallint[],
  frequency_times smallint check (frequency_times is null or frequency_times between 1 and 7),
  category        text not null check (category in ('trabajo', 'personal', 'salud', 'hogar')),
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Hace falta para la clave foránea compuesta de habit_logs.
  unique (id, user_id),

  check (kind <> 'check' or (target = 1 and step = 1)),
  check (kind = 'count' or unit is null),
  check (
    (frequency_type = 'daily'    and frequency_days is null and frequency_times is null) or
    (frequency_type = 'weekly'   and frequency_days is null and frequency_times is not null) or
    (frequency_type = 'weekdays' and frequency_times is null
       and frequency_days is not null
       and cardinality(frequency_days) between 1 and 7
       and frequency_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  )
);

create index habits_user_idx on public.habits (user_id) where not archived;

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- habit_logs: progreso de un hábito en un día (como mucho una fila por día)
-- -----------------------------------------------------------------------------

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid not null,
  log_date   date not null,
  -- Un valor 0 significa "sin registro": la app borra la fila en vez de guardarlo.
  value      numeric(10, 2) not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (habit_id, log_date),

  -- Clave compuesta: un registro solo puede apuntar a un hábito del MISMO usuario.
  -- Así ni siquiera con un id ajeno adivinado se puede colgar datos de otra cuenta.
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
--
-- Todas las tablas: solo el usuario autenticado, solo sus filas. `anon` no
-- tiene acceso. `(select auth.uid())` permite a Postgres evaluarlo una vez por
-- consulta en lugar de una vez por fila.
-- -----------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.tasks       enable row level security;
alter table public.notes       enable row level security;
alter table public.activities  enable row level security;
alter table public.habits      enable row level security;
alter table public.habit_logs  enable row level security;

revoke all on public.profiles, public.tasks, public.notes,
              public.activities, public.habits, public.habit_logs from anon;

-- profiles: el perfil lo crea el trigger, así que no hay política de insert.
-- El borrado se hace borrando la cuenta (cascade desde auth.users).
grant select, update on public.profiles to authenticated;

create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: actualizar el propio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tablas de datos: las mismas cuatro políticas, generadas para no repetirse.
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'notes', 'activities', 'habits', 'habit_logs']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || ': leer las propias', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || ': crear las propias', t);

    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || ': editar las propias', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || ': borrar las propias', t);
  end loop;
end;
$$;


-- =============================================================================
-- Comprobaciones tras aplicarlo (ejecutar a mano, no forman parte de la migración)
--
-- 1) Todas las tablas con RLS activada (debe devolver 6 filas, todas true):
--      select relname, relrowsecurity from pg_class
--      where relnamespace = 'public'::regnamespace
--        and relname in ('profiles','tasks','notes','activities','habits','habit_logs');
--
-- 2) Aislamiento entre usuarios, con dos cuentas A y B:
--      - Como A: insertar una tarea y un hábito.
--      - Como B: `select * from tasks` debe devolver 0 filas; actualizar o
--        borrar la tarea de A debe afectar a 0 filas.
--      - Como B: insertar un habit_logs con el habit_id de A debe fallar
--        (clave foránea compuesta) y con user_id de A debe fallar (RLS).
--
-- 3) Sin sesión (rol anon): cualquier select debe fallar con "permission denied".
--
-- 4) Registrar un usuario nuevo con nickname y ver que aparece su fila en
--    profiles con display_name = nickname.
-- =============================================================================
