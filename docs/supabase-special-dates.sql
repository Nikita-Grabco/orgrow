-- =============================================================================
-- Orgrow · Fechas importantes (cumpleaños, aniversarios…)
--
-- Aplicar a mano en el SQL Editor de Supabase. Es seguro repetirlo.
-- Cada fecha se repite todos los años: se guarda el mes y el día, y el año solo
-- si se quiere calcular la edad o los años cumplidos.
-- `remind_before_days` = días antes en que se avisa (0 = el mismo día, null = sin
-- aviso). `last_reminded_on` lo escribe solo la función `send-reminders` para no
-- avisar dos veces el mismo día.
-- =============================================================================

create table if not exists public.special_dates (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title              text not null check (char_length(btrim(title)) between 1 and 100),
  kind               text not null default 'cumpleanos'
                       check (kind in ('cumpleanos', 'aniversario', 'otra')),
  month              smallint not null check (month between 1 and 12),
  day                smallint not null check (day between 1 and 31),
  year               smallint check (year is null or year between 1 and 9999),
  remind_before_days smallint check (remind_before_days is null or remind_before_days between 0 and 30),
  last_reminded_on   date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- No existen el 30 de febrero ni el 31 de abril, junio, septiembre o noviembre.
  check (
    day <= case month
      when 2 then 29
      when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
      else 31
    end
  )
);

create index if not exists special_dates_user_idx on public.special_dates (user_id, month, day);

drop trigger if exists special_dates_set_updated_at on public.special_dates;
create trigger special_dates_set_updated_at
  before update on public.special_dates
  for each row execute function public.set_updated_at();

alter table public.special_dates enable row level security;

revoke all on public.special_dates from anon;
grant select, insert, update, delete on public.special_dates to authenticated;

drop policy if exists "special_dates: leer las propias" on public.special_dates;
create policy "special_dates: leer las propias"
  on public.special_dates for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "special_dates: crear las propias" on public.special_dates;
create policy "special_dates: crear las propias"
  on public.special_dates for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "special_dates: editar las propias" on public.special_dates;
create policy "special_dates: editar las propias"
  on public.special_dates for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "special_dates: borrar las propias" on public.special_dates;
create policy "special_dates: borrar las propias"
  on public.special_dates for delete to authenticated
  using (user_id = (select auth.uid()));

-- Comprobación (a mano): debe devolver una fila con relrowsecurity = true.
--   select relname, relrowsecurity from pg_class where relname = 'special_dates';
