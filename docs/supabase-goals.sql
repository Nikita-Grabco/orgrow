-- =============================================================================
-- Orgrow · Objetivos a largo plazo (Productividad)
--
-- Aplicar a mano en el SQL Editor de Supabase. Es seguro repetirlo.
-- Los hitos de cada objetivo viajan dentro de la propia fila, en `milestones`
-- (jsonb): [{ id, title, done, link? }] donde `link` es
--   { "type": "task",  "taskId": "<uuid>" }  o  { "type": "habit", "habitId": "<uuid>", "days": 30 }
-- El progreso se calcula en la app a partir de las tareas y hábitos enlazados.
-- `start_date` es el día desde el que se cuentan los días de los hitos de hábito.
-- =============================================================================

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  category    text not null check (category in ('trabajo', 'personal', 'salud', 'hogar')),
  due_date    date,
  start_date  date not null default current_date,
  achieved_at timestamptz,
  milestones  jsonb not null default '[]'::jsonb
                check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 50),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id, due_date);

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

revoke all on public.goals from anon;
grant select, insert, update, delete on public.goals to authenticated;

drop policy if exists "goals: leer las propias" on public.goals;
create policy "goals: leer las propias"
  on public.goals for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "goals: crear las propias" on public.goals;
create policy "goals: crear las propias"
  on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "goals: editar las propias" on public.goals;
create policy "goals: editar las propias"
  on public.goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "goals: borrar las propias" on public.goals;
create policy "goals: borrar las propias"
  on public.goals for delete to authenticated
  using (user_id = (select auth.uid()));

-- Comprobación (a mano): debe devolver una fila con relrowsecurity = true.
--   select relname, relrowsecurity from pg_class where relname = 'goals';
