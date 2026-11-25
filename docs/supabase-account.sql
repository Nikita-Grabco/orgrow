-- =============================================================================
-- Orgrow · Parte 9 — borrar la propia cuenta
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- Requiere haber aplicado antes supabase-schema.sql (y, si lo usas,
-- supabase-reminders.sql: sus suscripciones push también se borran).
--
-- Cómo funciona: el navegador solo tiene la clave pública, que NO puede borrar
-- usuarios de auth.users. Esta función (security definer) borra únicamente al
-- usuario que la llama (auth.uid()); el resto lo hace `on delete cascade`:
-- perfil, tareas, notas, actividades, hábitos, registros y suscripciones push.
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '28000';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Solo usuarios con sesión; nunca anónimos.
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;


-- =============================================================================
-- VERIFICACIÓN (opcional, no deja nada: acaba en error a propósito y deshace todo)
-- Quita los "-- " del principio de cada línea, pega y ejecuta.
-- Debe salir un error que empieza por RESULTADO con todas las líneas en OK.
-- =============================================================================
-- do $$
-- declare
--   a uuid := gen_random_uuid();
--   b uuid := gen_random_uuid();
--   n int;
--   r text := '';
-- begin
--   insert into auth.users (id, email) values (a, 'a-test@example.invalid'), (b, 'b-test@example.invalid');
--   insert into public.tasks (user_id, title, category, priority) values (a, 'de A', 'personal', 'media'), (b, 'de B', 'personal', 'media');
--   insert into public.notes (user_id, content, kind) values (a, 'nota de A', 'idea');
--
--   -- 1) un usuario autenticado borra su cuenta
--   set local role authenticated;
--   perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
--   perform public.delete_own_account();
--   reset role;
--
--   select count(*) into n from auth.users where id = a;
--   r := r || format('1) su usuario desaparece: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
--   select count(*) into n from public.tasks where user_id = a;
--   r := r || format('2) sus tareas se borran en cascada: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
--   select count(*) into n from public.notes where user_id = a;
--   r := r || format('3) sus notas se borran en cascada: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
--   select count(*) into n from public.profiles where id = a;
--   r := r || format('4) su perfil se borra: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 2) el otro usuario no se toca
--   select count(*) into n from auth.users where id = b;
--   r := r || format('5) el usuario B sigue existiendo: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--   select count(*) into n from public.tasks where user_id = b;
--   r := r || format('6) las tareas de B siguen: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
--
--   -- 3) un anónimo no puede ejecutarla
--   set local role anon;
--   begin
--     perform public.delete_own_account();
--     r := r || E'7) anon no puede ejecutarla: FALLO\n';
--   exception when others then
--     r := r || E'7) anon no puede ejecutarla: OK\n';
--   end;
--   reset role;
--
--   raise exception 'RESULTADO (error intencionado para deshacerlo todo):%', E'\n' || r;
-- end;
-- $$;
