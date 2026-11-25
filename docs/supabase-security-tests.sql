-- =============================================================================
-- Orgrow · Parte 10 — pruebas de seguridad de la base de datos (RLS y permisos)
--
-- Ejecutar en Supabase → SQL Editor. NO deja datos: crea dos usuarios de prueba
-- y termina con un error a propósito para deshacerlo todo.
-- Requiere haber aplicado supabase-schema.sql, supabase-reminders.sql y
-- supabase-account.sql (si falta alguno, esa comprobación saldrá FALLO).
--
-- Debe salir un error que empieza por "RESULTADO" con TODAS las líneas en OK.
-- Si alguna dice FALLO, no despliegues: pásame el texto completo.
--
-- Qué demuestra: un usuario (B) con sesión NO puede leer, cambiar, borrar ni crear
-- datos de otro (A) en ninguna tabla; un anónimo no puede tocar nada; los datos
-- inválidos los rechaza la propia base de datos aunque se salte la app.
-- =============================================================================

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_task uuid; a_note uuid; a_act uuid; a_habit uuid; a_log uuid; a_push uuid;
  t text;
  n int;
  r text := '';
  ok boolean;
  tables text[] := array['profiles', 'tasks', 'notes', 'activities', 'habits', 'habit_logs', 'push_subscriptions'];
begin
  -- Preparación (como administrador): dos usuarios y datos de A.
  insert into auth.users (id, email) values (a, 'a-sec@example.invalid'), (b, 'b-sec@example.invalid');

  insert into public.tasks (user_id, title, category, priority) values (a, 'tarea de A', 'personal', 'media') returning id into a_task;
  insert into public.notes (user_id, content, kind) values (a, 'nota de A', 'idea') returning id into a_note;
  insert into public.activities (user_id, title, category, date, start_time) values (a, 'cita de A', 'salud', '2026-12-01', '10:00') returning id into a_act;
  insert into public.habits (user_id, name, kind, target, step, frequency_type, category) values (a, 'hábito de A', 'check', 1, 1, 'daily', 'salud') returning id into a_habit;
  insert into public.habit_logs (user_id, habit_id, log_date, value) values (a, a_habit, '2026-12-01', 1) returning id into a_log;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (a, 'https://push.example.invalid/a', 'k', 'a') returning id into a_push;

  -- 1) RLS activada en todas las tablas
  foreach t in array tables loop
    select c.relrowsecurity into ok from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relname = t;
    r := r || format('1) RLS activada en %s: %s', t, case when ok then 'OK' else 'FALLO' end) || E'\n';
  end loop;

  -- 2) Un anónimo no puede ni leer
  set local role anon;
  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      r := r || format('2) anon no lee %s: FALLO', t) || E'\n';
    exception when others then
      r := r || format('2) anon no lee %s: OK', t) || E'\n';
    end;
  end loop;
  reset role;

  -- 3) B (con sesión) no ve nada de A
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tasks;
  r := r || format('3) B no ve tareas de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.notes;
  r := r || format('3) B no ve notas de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.activities;
  r := r || format('3) B no ve actividades de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.habits;
  r := r || format('3) B no ve hábitos de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.habit_logs;
  r := r || format('3) B no ve registros de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.push_subscriptions;
  r := r || format('3) B no ve dispositivos de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.profiles where id = a;
  r := r || format('3) B no ve el perfil de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';

  -- 4) B no puede cambiar ni borrar lo de A (0 filas afectadas)
  update public.tasks set title = 'hackeada' where id = a_task;
  get diagnostics n = row_count;
  r := r || format('4) B no edita tareas de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  delete from public.tasks where id = a_task;
  get diagnostics n = row_count;
  r := r || format('4) B no borra tareas de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  update public.notes set content = 'hackeada' where id = a_note;
  get diagnostics n = row_count;
  r := r || format('4) B no edita notas de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  delete from public.activities where id = a_act;
  get diagnostics n = row_count;
  r := r || format('4) B no borra actividades de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  update public.habits set name = 'hackeado' where id = a_habit;
  get diagnostics n = row_count;
  r := r || format('4) B no edita hábitos de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  delete from public.habit_logs where id = a_log;
  get diagnostics n = row_count;
  r := r || format('4) B no borra registros de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  update public.profiles set display_name = 'hackeado' where id = a;
  get diagnostics n = row_count;
  r := r || format('4) B no edita el perfil de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';
  delete from public.push_subscriptions where id = a_push;
  get diagnostics n = row_count;
  r := r || format('4) B no borra dispositivos de A: %s', case when n = 0 then 'OK' else 'FALLO' end) || E'\n';

  -- 5) B no puede crear filas a nombre de A
  begin
    insert into public.tasks (user_id, title, category, priority) values (a, 'suplantada', 'personal', 'media');
    r := r || E'5) B no crea tareas a nombre de A: FALLO\n';
  exception when others then
    r := r || E'5) B no crea tareas a nombre de A: OK\n';
  end;
  begin
    insert into public.notes (user_id, content, kind) values (a, 'suplantada', 'idea');
    r := r || E'5) B no crea notas a nombre de A: FALLO\n';
  exception when others then
    r := r || E'5) B no crea notas a nombre de A: OK\n';
  end;

  -- 6) B no puede colgar un registro del hábito de A (clave foránea compuesta)
  begin
    insert into public.habit_logs (user_id, habit_id, log_date, value) values (b, a_habit, '2026-12-02', 1);
    r := r || E'6) B no registra progreso en un hábito de A: FALLO\n';
  exception when others then
    r := r || E'6) B no registra progreso en un hábito de A: OK\n';
  end;

  -- 7) push_subscriptions: no hay insert directo (solo la función)
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (b, 'https://push.example.invalid/b', 'k', 'a');
    r := r || E'7) B no inserta dispositivos directamente: FALLO\n';
  exception when others then
    r := r || E'7) B no inserta dispositivos directamente: OK\n';
  end;

  -- 8) La base de datos rechaza datos inválidos aunque se salte la app
  begin
    insert into public.tasks (title, category, priority) values ('', 'personal', 'media');
    r := r || E'8) título vacío rechazado: FALLO\n';
  exception when others then
    r := r || E'8) título vacío rechazado: OK\n';
  end;
  begin
    insert into public.tasks (title, category, priority) values ('x', 'inventada', 'media');
    r := r || E'8) categoría inventada rechazada: FALLO\n';
  exception when others then
    r := r || E'8) categoría inventada rechazada: OK\n';
  end;
  begin
    insert into public.notes (content, kind) values (repeat('x', 4001), 'idea');
    r := r || E'8) nota de más de 4000 caracteres rechazada: FALLO\n';
  exception when others then
    r := r || E'8) nota de más de 4000 caracteres rechazada: OK\n';
  end;
  begin
    insert into public.activities (title, category, date, start_time, end_time) values ('x', 'salud', '2026-12-01', '10:00', '09:00');
    r := r || E'8) actividad que termina antes de empezar rechazada: FALLO\n';
  exception when others then
    r := r || E'8) actividad que termina antes de empezar rechazada: OK\n';
  end;
  begin
    insert into public.tasks (title, category, priority, remind_before_minutes) values ('x', 'personal', 'media', -5);
    r := r || E'8) aviso con minutos negativos rechazado: FALLO\n';
  exception when others then
    r := r || E'8) aviso con minutos negativos rechazado: OK\n';
  end;

  -- 9) B sí puede crear lo suyo (la protección no bloquea el uso normal)
  insert into public.tasks (title, category, priority) values ('tarea de B', 'personal', 'media');
  select count(*) into n from public.tasks;
  r := r || format('9) B crea y ve sus propias tareas: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
  reset role;

  -- 10) Funciones sensibles: ni anónimos ni nadie desde la API pueden usarlas mal
  set local role anon;
  begin
    perform public.delete_own_account();
    r := r || E'10) anon no puede borrar cuentas: FALLO\n';
  exception when others then
    r := r || E'10) anon no puede borrar cuentas: OK\n';
  end;
  begin
    perform public.register_push_subscription('https://push.example.invalid/x', 'k', 'a', 'test');
    r := r || E'10) anon no puede registrar dispositivos: FALLO\n';
  exception when others then
    r := r || E'10) anon no puede registrar dispositivos: OK\n';
  end;
  reset role;

  -- (la función del trigger no debe poder ejecutarla nadie desde la API)
  r := r || format('10) handle_new_user no es ejecutable por authenticated/anon: %s',
    case when not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
          and not has_function_privilege('anon', 'public.handle_new_user()', 'execute')
         then 'OK' else 'FALLO' end) || E'
';

  -- 11) Los datos de A siguen intactos tras todos los intentos de B
  select count(*) into n from public.tasks where id = a_task and title = 'tarea de A';
  r := r || format('11) la tarea de A sigue intacta: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.profiles p where p.id = a and p.display_name <> 'hackeado';
  r := r || format('11) el perfil de A sigue intacto: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';
  select count(*) into n from public.push_subscriptions where id = a_push;
  r := r || format('11) el dispositivo de A sigue registrado: %s', case when n = 1 then 'OK' else 'FALLO' end) || E'\n';

  raise exception 'RESULTADO (error intencionado para deshacerlo todo):%', E'\n' || r;
end;
$$;
