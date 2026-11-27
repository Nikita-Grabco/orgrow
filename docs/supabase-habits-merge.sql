-- =============================================================================
-- Orgrow · Hábitos: "Tiempo" pasa a ser "Cantidad" con unidad "min"
--
-- La app ya no ofrece el tipo "Tiempo": un hábito de leer 1 h es una cantidad
-- (60 min, 1 h, 10 páginas…). Este script convierte los hábitos de tipo `time`
-- que ya existan. Sus registros (habit_logs) ya estaban en minutos, así que NO
-- hay que tocarlos y el progreso se conserva igual.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No se quita 'time' del CHECK de la tabla: así una copia antigua guardada en un
-- dispositivo sin conexión no falla al sincronizar.
-- =============================================================================

update public.habits
   set kind = 'count',
       unit = coalesce(unit, 'min')
 where kind = 'time';

-- Comprobación: debe devolver 0.
select count(*) as habitos_de_tiempo_que_quedan from public.habits where kind = 'time';
