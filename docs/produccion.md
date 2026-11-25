# Producción (Parte 11)

Guía para publicar Orgrow y mantenerla. Lo que requiere una cuenta o un panel (hosting, dominio,
Supabase) lo haces tú; aquí está el orden y la lista de comprobación.

## 1. Entornos

Usa **dos proyectos de Supabase**, para no probar sobre tus datos reales:

| Entorno | Para qué | Variables |
|---|---|---|
| Desarrollo / pruebas | `npm run dev`, cuentas desechables, probar SQL | `.env.local` con el proyecto de pruebas |
| Producción | Tus datos reales | Variables del hosting con el proyecto de producción |

En **cada** proyecto aplica, por este orden, en el SQL Editor: `supabase-schema.sql`,
`supabase-reminders.sql`, `supabase-account.sql`, y ejecuta `supabase-security-tests.sql`
(todas las líneas en OK) antes de abrirlo a nadie.

Variables del hosting (solo estas; todas públicas por diseño):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=        # opcional: sin ella no hay recordatorios
```

Las claves secretas (service role, VAPID privada, `CRON_SECRET`) **no** van en el hosting: solo como
secretos de Supabase (ver `recordatorios-setup.md`).

## 2. Hosting y dominio

El build usa Nitro con destino Cloudflare (ver `vite.config.ts`) y el proyecto está conectado a
Lovable, que puede publicarlo. Con cualquiera de los dos caminos:

1. Define las variables anteriores en el panel del hosting.
2. Publica y comprueba que carga por **HTTPS** (imprescindible para PWA y avisos).
3. Dominio propio: añádelo en el hosting y espera a que emita el certificado.

## 3. Supabase Auth (obligatorio al tener dominio)

En Supabase → Authentication → URL Configuration:

- **Site URL:** la URL de producción (`https://tu-dominio`).
- **Redirect URLs:** la de producción y, si quieres, `http://localhost:5173` para desarrollo.
  Sin esto los enlaces de confirmación de email apuntan a un sitio equivocado.
- En Authentication → Rate Limits y Policies: deja los límites de intentos activados y exige
  contraseñas de al menos 8 caracteres.
- Para enviar muchos emails de confirmación necesitarás un SMTP propio; el integrado tiene tope bajo.

## 4. CSP obligatoria

Hoy la política va en modo informe (`Content-Security-Policy-Report-Only`). Para activarla:

1. Con el sitio ya en el dominio real, abre cada pantalla con la consola del navegador abierta
   (inicio, tareas, agenda, hábitos, notas, ajustes, acceso) y mira si aparece algún aviso
   "Content-Security-Policy-Report-Only … would block".
2. Si no hay avisos, en `src/lib/security-headers.ts` cambia la cabecera
   `Content-Security-Policy-Report-Only` por `Content-Security-Policy` (y el test correspondiente).
3. Decide si añadir `frame-ancestors 'none'`: protege de incrustaciones, pero **rompe la vista
   previa del editor de Lovable**. Hazlo solo cuando dejes de usar esa vista.

## 5. Copias de seguridad

- **Base de datos:** Supabase hace copias diarias en los planes de pago; en el gratuito **no**
  hay. Con el plan gratuito, descarga una copia tú de vez en cuando (`pg_dump` desde la cadena de
  conexión de Supabase, o Database → Backups si está disponible) y guárdala fuera.
- **Por usuario:** `Ajustes → Exportar copia` descarga todos sus datos en JSON.
- **Prueba de restauración:** una copia que nunca has restaurado no cuenta. Cada cierto tiempo,
  restaura en el proyecto de pruebas y comprueba que los datos están.
- Guarda aparte (gestor de contraseñas) la clave privada VAPID y `CRON_SECRET`; si se pierden hay
  que generar otras y reactivar los avisos en cada dispositivo.

## 6. Monitorización

| Qué vigilar | Dónde |
|---|---|
| Errores de la API / auth | Supabase → Logs → API / Auth |
| Avisos (la función y el cron) | Supabase → Edge Functions → `send-reminders` → Logs; `select * from cron.job_run_details order by start_time desc limit 10;` |
| App caída | Un monitor externo gratuito (UptimeRobot, Better Stack) apuntando a la URL |
| Errores de JavaScript de los usuarios | Opcional: Sentry en el navegador (plan gratuito). Requiere decidir qué datos envía; no incluir títulos/notas |
| Uso y límites | Supabase → Reports (filas, ancho de banda, usuarios activos) |

Qué mirar si "no llegan los avisos": tabla de síntomas en `recordatorios-setup.md`.

## 7. Integración continua

`.github/workflows/ci.yml` ejecuta en cada subida y pull request: tipos, lint, tests,
`npm audit` (solo falla con vulnerabilidades altas), build y la auditoría de secretos.
Dependabot propone actualizaciones semanales agrupadas. En GitHub → Settings → Branches puedes
exigir que CI pase antes de fusionar a `main`.

> Subir ficheros de `.github/workflows` exige que tu credencial de GitHub tenga permiso `workflow`;
> si el push lo rechaza por eso, vuelve a iniciar sesión con ese permiso.

## 8. Releases y vuelta atrás

- Antes de publicar: `npm run check` y, en local, `node scripts/audit-repo.mjs` (revisa también
  el historial sin publicar).
- Marca cada versión con una etiqueta: `git tag -a v1.0.0 -m "Primera versión"` y `git push --tags`.
- **Nunca reescribas el historial publicado** (el proyecto está conectado a Lovable).
- Volver atrás: vuelve a publicar la etiqueta/commit anterior en el hosting. Los cambios de base de
  datos no se deshacen solos: escribe siempre el SQL de reversión junto al de la migración.

## 9. Lista de comprobación antes de abrir a usuarios

- [ ] Dos proyectos de Supabase; SQL aplicado en ambos y `supabase-security-tests.sql` en OK
- [ ] Variables del hosting puestas; ningún secreto en ellas
- [ ] HTTPS y dominio funcionando; Site URL y Redirect URLs de Auth configuradas
- [ ] Registro → confirmación por email → entrar, probado con una cuenta real
- [ ] Pruebas manuales 1–12 de `PROJECT_STATUS.md` hechas (datos, offline, PWA)
- [ ] Recordatorios: función desplegada, cron activo, un aviso real recibido en móvil
- [ ] CSP sin avisos y activada (apartado 4)
- [ ] Copia de la base de datos hecha y restauración probada
- [ ] Monitor de disponibilidad creado
- [ ] CI en verde

## 10. App nativa (opcional, más adelante)

La PWA cubre móvil y escritorio. Si se necesitara estar en las tiendas o tener avisos más fiables
en iPhone, el siguiente paso sería envolverla con Capacitor. No se hace ahora: añade cuentas de
desarrollador de pago y un ciclo de revisión de las tiendas.
