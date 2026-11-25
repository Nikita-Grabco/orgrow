# PROJECT_STATUS — Orgrow

> Memoria permanente del proyecto. **Mantener actualizado al terminar cada funcionalidad importante.**
> No incluir contraseñas, claves API ni datos sensibles.

Última actualización: 2026-11-26 (Parte 7 implementada)
Commit de referencia: ver `git log` (rama `main`)
Rama: `main`

---

## 1. Objetivo y descripción

**Orgrow** es una aplicación web de organización personal diaria que debe funcionar
igual de bien en **PC, iPhone/iPad y tablet Android**, a cualquier hora, como una
aplicación normal (instalable, rápida y con datos sincronizados).

Estrella guía (`.lovable/north-star/north-star.md`):

> Las personas hacen lo que planearon para su día y no se les olvida nada.

Métrica: **tareas marcadas como hechas cada día**.

Funcionalidades objetivo: tareas con prioridad, fecha, categoría y progreso diario;
agenda de actividades; notas e ideas sin fecha; recordatorios; y sincronización entre
dispositivos.

---

## 2. Tecnologías y versiones

Entorno local verificado: **Node.js v24.21.0**, **npm 11.19.0** (Windows).

| Pieza | Versión |
|---|---|
| React / React DOM | 19.3.1 |
| TypeScript | 5.9.3 |
| Vite | 8.3.8 (fijada exacta) |
| TanStack Router | 1.170.41 |
| TanStack Start | 1.168.60 |
| TanStack Query | 5.107.1 (instalado, **aún sin usar**) |
| Tailwind CSS | 4.3.5 |
| Radix UI / shadcn | conjunto de `@radix-ui/*` 1.x–2.x |
| date-fns | 4.4.0 (locale `es`) |
| react-day-picker | 9.14.0 |
| sonner (toasts) | 2.0.8 |
| Vitest | 4.1.12 (+ Testing Library, jsdom) |
| `@supabase/supabase-js` | 2.119.0 |
| Nitro | 3.0.260603-beta (build de servidor) |
| `@lovable.dev/vite-tanstack-config` | 2.27.2 |

Sin dependencias nuevas para el módulo de Tareas. La primera dependencia nueva del
proyecto es `@supabase/supabase-js` (Parte 1).

### Notas de dependencias (importante)

- `npm audit` está en **0 vulnerabilidades**.
- Existe un `overrides` en `package.json` que **no debe eliminarse sin comprobar**:
  - `rolldown: ~1.2.18` → lo exige Vite 8.3.8.
  - `@typescript-eslint/typescript-estree → minimatch: ^11.0.1` → parche de seguridad
    temporal (cuando `typescript-eslint` suba a minimatch 11 nativo, se puede quitar).
- `zod` se **eliminó** de las dependencias directas (no se usaba). Las dependencias
  internas de TanStack ya traen `zod@4.6.7`.
- **Dos lockfiles:** `bun.lock` (versionado, de la plantilla de Lovable) y
  `package-lock.json` (generado con npm). `bun` no está instalado; `bun.lock` está
  desactualizado respecto a `package.json`.

---

## 3. Arquitectura y estructura de carpetas

Arquitectura en capas, pensada para sustituir el almacenamiento sin tocar la UI:

```
UI (routes + components)
  └── usePlanner()                        ← única API que consumen los componentes
        └── src/store/planner-store.tsx   ← estado en memoria + actualización optimista
              └── src/services/*-repository.ts  ← interfaz tipo tabla (list/create/update/remove)
                    └── src/services/planner-storage.ts  ← localStorage versionado (hoy)
                    └── src/services/supabase-client.ts ← cliente de Supabase (Parte 1)
                    └── supabase-*-repository.ts        ← futuro, misma interfaz
```

```
dia-en-orden/
├── PROJECT_STATUS.md          ← este archivo
├── AGENTS.md                  ← reglas del proyecto + reglas de Lovable
├── package.json               ← scripts, overrides, dependencias
├── .env.example               ← nombres de las variables (valores vacíos, sí se versiona)
├── .env.local                 ← valores reales, IGNORADO por git
├── .lovable/                  ← metadatos de Lovable (no editar)
├── public/                    ← favicon, robots.txt
└── src/
    ├── routes/                ← páginas (routeTree.gen.ts es AUTOGENERADO)
    │   ├── __root.tsx         ← providers (Query + Auth), AuthGate, 404, error boundary
    │   ├── index.tsx          ← Dashboard (/)
    │   ├── acceso.tsx         ← /acceso (login y registro)
    │   ├── tareas.tsx         ← /tareas
    │   ├── agenda.tsx         ← /agenda
    │   └── notas.tsx          ← /notas
    ├── components/
    │   ├── auth/              ← AuthGate, SignOutButton
    │   ├── ui/                ← kit shadcn (no editar salvo necesidad)
    │   ├── layout/            ← sidebar, nav móvil, AppShell, avatar
    │   ├── dashboard/         ← resumen del día, próximas, notas rápidas
    │   ├── tasks/             ← task-dialog, task-item, task-list, task-check
    │   ├── notes/             ← note-card, note-composer
    │   ├── activities/        ← activity-list (filas editables), activity-dialog
    │   ├── agenda/            ← agenda-toolbar + day-view, week-view, month-view
    │   └── common/            ← chip, section-card, page-header, empty-state, date-picker-field
    ├── config/                ← categorías, prioridades, tipos de nota, navegación
    ├── data/                  ← sample-data.ts (semilla del primer arranque)
    ├── hooks/                 ← useToday, useMobile
    ├── lib/                   ← dates.ts, time.ts, planner.ts, user.ts, utils.ts, errores
    ├── services/              ← planner-storage, *-repository (tasks/notes/activities), supabase-client, auth-errors
    ├── store/                 ← planner-store.tsx, auth-store.tsx
    ├── test/                  ← setup + tests
    ├── types/                 ← planner.ts (tipos del dominio)
    ├── env.d.ts               ← tipos de las variables VITE_*
    ├── styles.css             ← tema completo (tokens de color)
    ├── router.tsx, server.ts, start.ts
    └── routeTree.gen.ts       ← AUTOGENERADO, no editar a mano
```

Reglas de arquitectura:

- Los componentes **nunca** acceden al almacenamiento; solo a `usePlanner()`.
- Tipos del dominio solo en `src/types/planner.ts`.
- Etiquetas/colores/iconos solo en `src/config/` y tokens en `src/styles.css`.
- Nada de colores en crudo en los componentes.

---

## 4. Funcionalidades implementadas

### Layout y diseño
- Diseño original ("Calma") ahora bajo la marca **Orgrow**: rail de iconos en tablet,
  sidebar completo en escritorio, barra inferior en móvil con FAB central.
- Tema oscuro por tokens, tipografía Source Sans 3.
- Toasts con `sonner`.

### Módulo de Tareas (completo, en local)
- Crear, **editar** (lápiz + pulsar el título), eliminar, completar/descompletar.
- Prioridades alta/media/baja y 4 categorías (trabajo, personal, salud, hogar).
- **Fechas reales** `YYYY-MM-DD` (`dueDate`): chips Hoy / Mañana / Sin fecha y
  calendario completo.
- Agrupación en `/tareas`: **Atrasadas → Hoy → Mañana → fechas → Sin fecha**, con
  progreso por grupo.
- Atrasadas visibles también en el dashboard "Hoy" y marcadas en rojo.
- Progreso diario (anillo + contadores) y filtros por categoría / completadas.

### Notas
- Crear (idea / por hacer / recordatorio), fijar, eliminar, convertir en tarea.
- **Editar** texto y tipo en la propia tarjeta (lápiz; Enter guarda, Escape cancela;
  no se permite dejarla vacía).
- **Buscar** en `/notas` sin distinguir mayúsculas ni acentos y con todas las palabras
  en cualquier orden; los contadores de los chips respetan la búsqueda.
- Filtros por tipo en `/notas`.

### Agenda (Parte 6, completa en local)
- Tres vistas conmutables: **Día**, **Semana** (por defecto) y **Mes**.
- Navegación anterior/siguiente según la vista, más "Hoy" para volver.
- Pulsar un día en semana o mes abre la vista de día de esa fecha.
- **CRUD completo de actividades**: título, día, hora inicio/fin, lugar y categoría,
  con diálogo único para crear y editar (`ActivityDialog`) y borrado inmediato.
- Validación: el fin debe ser posterior al inicio; las horas son `HH:mm`.
- El dashboard (`next-up-card`, `upcoming-activities`) lee actividades reales.

### Persistencia
- Tareas, notas y actividades se guardan en `localStorage` con claves versionadas
  (`orgadia:v1:tasks`, `orgadia:v1:notes`, `orgadia:v1:activities`).
- Semilla de datos demo **solo la primera vez**; si se borra todo, no reaparecen.
- Migración automática de datos antiguos con `dayOffset`.
- Actualización optimista con rollback y aviso si el guardado falla.
- Datos corruptos → se ignoran y se vuelve a sembrar (nunca rompe la UI).

### Autenticación (Parte 2)

- Login por **email + contraseña** en `/acceso`, con dos modos en la misma pantalla
  (Entrar / Crear cuenta). Se eligió contraseña en lugar de enlace mágico porque en
  iPhone el enlace se abriría en Safari y la sesión **no se compartiría con la app
  instalada** en la pantalla de inicio.
- `AuthProvider` (`src/store/auth-store.tsx`) expone `status`, `user`, `email`,
  `displayName`, `initials`, `signIn`, `signUp` y `signOut`.
- `AuthGate` (`src/components/auth/auth-gate.tsx`) decide qué se renderiza:
  splash → `/acceso` → app con `AppShell`. Las rutas privadas redirigen y `/acceso`
  expulsa a quien ya tiene sesión.
- Los errores de Supabase se traducen al español en `src/services/auth-errors.ts`
  (nunca se muestra el mensaje interno).
- El registro pide también un **nickname** ("¿Cómo te llamas?"), que se guarda en
  `user_metadata.full_name` y es el nombre que se muestra en la app y en el avatar.
  Sin nickname, se deriva del email.
- Nombre e iniciales salen del email (`src/lib/user.ts`) mientras no exista
  `profiles` (Parte 3). `sampleUser` ("Nikita/NG") eliminado.
- Cerrar sesión disponible en la barra lateral (escritorio/tablet) y en la cabecera
  móvil.

### PWA y modo sin conexión (Parte 7)

- **Instalable:** `public/manifest.webmanifest`, iconos en `public/icons/` (generados con
  `node scripts/generate-icons.mjs`, mismo diseño que `Brand`) y metas de iOS en `__root.tsx`.
  `InstallCard` (dashboard) ofrece el botón nativo en Chrome/Android/PC y explica
  *Compartir → Añadir a pantalla de inicio* en Safari de iPhone/iPad; se puede descartar.
- **Service worker** (`public/sw.js`, registrado solo en producción): guarda la aplicación
  (HTML por ruta, `/assets/*`, iconos, fuentes) y **nunca datos de la cuenta**: las peticiones
  a Supabase (otro origen) y los POST pasan directos. Navegación: red primero, luego la última
  copia de esa ruta, luego `/`, luego `/offline.html`. Al subir de versión (`VERSION`) borra las
  cachés antiguas.
- **Datos sin conexión** (`src/services/offline-repositories.ts`, por encima de los repositorios
  de Supabase): cada lectura guarda una copia por usuario (`orgrow:v1:cache:<userId>`); sin red
  se sirve esa copia. Las escrituras se aplican a la copia y, si el servidor no responde, entran
  en una **cola** (`orgrow:v1:outbox:<userId>`) que se reenvía en orden al volver la red
  (evento `online`, foco o cada 30 s). Un rechazo definitivo del servidor (permiso, dato inválido)
  no se encola; si lo rechaza al reenviar, se descarta con aviso para no bloquear la cola.
- **Sesión:** con el token caducado y sin red, `auth-store` abre la app con la sesión guardada
  (`offline-session.ts`) en vez de mandar a `/acceso`; Supabase la renueva al volver la red.
- **Cerrar sesión** borra la copia de datos de ese usuario pero **conserva la cola** de cambios
  sin enviar (se envían al volver a entrar con la misma cuenta).
- `ConnectionBanner` (en `AppShell`) avisa de "Sin conexión" y de los cambios pendientes.

### Backend (Parte 1)

- Cliente único de Supabase en `src/services/supabase-client.ts`, creado de forma
  perezosa (`getSupabaseClient()`), con `persistSession`, `autoRefreshToken`,
  `detectSessionInUrl` y `storageKey: "orgadia:auth"`.
- `getSupabaseConfig()` valida que las dos variables existan y que la URL tenga
  forma de proyecto Supabase; `SupabaseConfigError` explica qué falta.
- `isSupabaseConfigured()` permite degradar a modo local si no hay entorno.
- Tipado de `import.meta.env` en `src/env.d.ts`.

### Calidad
- 48 tests en 7 archivos (fechas y calendario, agrupación de tareas y actividades,
  repositorios, store/persistencia, rutas, configuración de Supabase, autenticación).
- `npm run build` y `npx tsc --noEmit` en verde.
- SSR verificado: `/` y `/tareas` sirven el splash, `/acceso` sirve el formulario;
  todos responden 200.
- Conexión comprobada contra el proyecto real: `/auth/v1/health` 200 y
  `/auth/v1/settings` confirma `email: true` (proveedor activo) y
  `mailer_autoconfirm: false` (hace falta confirmar el email).

---

## 5. Funcionalidades pendientes

_(Ver el plan de 11 partes acordado con el usuario.)_

✅ **Parte 1 — Backend: completada.** Proyecto Supabase propio, `.env.local` +
`.env.example`, `@supabase/supabase-js` y cliente único validado.

✅ **Parte 2 — Autenticación: completada.** `/acceso`, sesión persistente, rutas
privadas y perfil derivado del email (la tabla `profiles` llega en la Parte 3).

✅ **Parte 6 — Agenda: completada en local.** Actividades con fecha real y CRUD
completo, vistas Día/Semana/Mes y persistencia en el navegador. Se adelantó a la
Parte 3 porque el usuario la pidió antes.

Las siguientes partes:

1. **Parte 3 — Esquema y RLS:** ✅ aplicada en Supabase y verificada (`docs/supabase-schema.sql`:
   6 tablas con índices y RLS). La UI ya lee el nombre de `profiles` y existe el mapeo
   `snake_case` ↔ `camelCase` en `src/services/mappers.ts`.
2. **Parte 4 — Datos en servidor:** ✅ implementada (tareas, notas, actividades y
   hábitos). Repositorios de Supabase, importación única de datos locales y recarga al
   volver a la app. Pendiente solo la **prueba manual con dos dispositivos**.
3. **Parte 5 — Notas:** ✅ editar, buscar y filtrar hechos; persistencia en servidor con la Parte 4.
4. **Parte 6 — Agenda real:** ✅ hecha en local; solo falta el repositorio Supabase
   (va con la Parte 4).
5. **Parte 7 — PWA:** ✅ implementada (instalable, service worker, copia local y cola de
   escrituras sin conexión). Pendiente solo la **prueba manual en dispositivos reales**.
6. **Parte 8 — Recordatorios:** hora de aviso, Web Push y función programada
   (iOS requiere PWA instalada; valorar Capacitor más adelante).
7. **Parte 9 — Ajustes:** perfil, zona horaria, exportar/importar JSON, categorías
   propias, borrado de cuenta.
8. **Parte 10 — Calidad/seguridad:** validación con `zod` en servidor, tests de RLS,
   rate limiting, E2E con Playwright, accesibilidad, lint normalizado.
9. **Parte 11 — Producción:** dominio, entornos, backups, monitorización, CI/CD,
   releases y posible envoltorio nativo.

Extras no planificados aún: recurrencia de tareas, búsqueda global, estadísticas
históricas, adjuntos.

---

## 6. Decisiones técnicas tomadas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-11 | **Backend propio con Supabase** (no Lovable Cloud) | Control total del esquema y las migraciones |
| 2026-11 | **Un solo usuario** por ahora, pero **con autenticación y RLS** | Sincronizar entre dispositivos sin exponer datos; base para multiusuario |
| 2026-11 | **PWA primero**, Capacitor solo si hace falta App Store/push iOS fiable | Un único código para PC, iOS y Android |
| 2026-11 | Patrón **repositorio** con interfaz `list/create/update/remove` | Cambiar localStorage → Supabase sin tocar la UI |
| 2026-11 | Fechas de tarea como **string `YYYY-MM-DD` local** | Evitar desplazamientos por zona horaria y permitir que "envejezcan" |
| 2026-11 | `dayOffset` **eliminado de `Task` y de `Activity`**; todo usa fecha real `YYYY-MM-DD` | Una sola fuente de verdad y datos que envejecen solos |
| 2026-11 | Un **único `TaskDialog`** y un **único `ActivityDialog`** para crear y editar | Evitar duplicar formularios |
| 2026-11 | Agenda con `anchor` (fecha visible) y vistas Día/Semana/Mes sobre helpers de `dates.ts` | Cambiar de vista no pierde el día; toda la lógica de calendario en un módulo testeable |
| 2026-11 | En la agenda, las vistas Semana/Mes son un **preview** y pulsar un día abre la vista Día | Menos ruido en móvil y un único sitio donde se edita |
| 2026-11 | **Semilla demo solo en el primer arranque** | Evitar que reaparezcan tareas borradas |
| 2026-11 | Lectura de almacenamiento solo en `useEffect` + flag `isReady` | Evitar hydration mismatch en SSR |
| 2026-11 | Actualización **optimista** con recarga en caso de error | UI instantánea y sin mentir sobre lo guardado |
| 2026-11 | `vite` fijado exacto + overrides documentados | Parchear vulnerabilidades sin romper el build |
| 2026-11 | No se toca `src/components/ui/*` ni `styles.css` al añadir funcionalidad | Mantener el diseño de Lovable intacto |
| 2026-11 | Cliente de Supabase **perezoso** (no al importar el módulo) | SSR y build no tienen variables ni `localStorage`; así nada se rompe |
| 2026-11 | Variable `VITE_SUPABASE_PUBLISHABLE_KEY` (no `ANON_KEY`) | Es la clave que emite Supabase hoy; el nombre evita confundirla con un secreto |
| 2026-11 | `.gitignore` bloquea `.env` y `.env.*`, permite `.env.example` | Evitar filtrar claves por accidente |
| 2026-11 | **Email + contraseña**, no enlace mágico | En iOS el enlace se abre en Safari y la sesión no se comparte con la app instalada; con contraseña se entra una vez dentro de la PWA |
| 2026-11 | Puerta de autenticación en `__root.tsx` (`AuthGate`), no en cada ruta | Una sola regla para toda la app, sin repetir comprobaciones |
| 2026-11 | Nombre e iniciales derivados del email hasta existir `profiles` | No inventar una tabla de perfil antes de la Parte 3 |

---

## 7. Estado actual

### Frontend
- ✅ Terminado y funcional para Tareas, Notas (parcial) y Agenda (Día/Semana/Mes con
  CRUD de actividades).
- ✅ Responsive en los tres formatos; verificado por SSR + revisión de clases.
- ⚠️ Pendiente una revisión visual manual en dispositivos reales.

### Backend
- ✅ **Parte 1 completada:** cliente de Supabase configurado y verificado contra el
  proyecto real (`src/services/supabase-client.ts`).
- El cliente se crea **de forma perezosa**; si faltan variables, la app sigue
  funcionando con `localStorage` en lugar de romperse.
- Existe andamiaje de TanStack Start: `src/server.ts` (entrada SSR y errores),
  `src/start.ts` (middlewares de error y CSRF), `QueryClient` por petición en
  `src/router.tsx`. No hay endpoints ni *server functions* en uso.
- ✅ **Parte 2 completada:** autenticación por email y contraseña, sesión persistente
  en el dispositivo y rutas privadas (`AuthGate`).
- ✅ **Parte 4:** con sesión, los datos se leen y escriben en Supabase
  (`src/services/supabase-repositories.ts`). `AuthGate` monta `PlannerProvider` con esos
  repositorios; los de `localStorage` quedan para tests y como origen de la importación.
- Ids `uuid` generados en el cliente (`createId`). Los registros de hábito se identifican
  por `habitId:fecha` en la UI y por `(habit_id, log_date)` en la base de datos.
- Importación única por cuenta y dispositivo (`src/services/local-import.ts`): omite los
  datos de demo (`t1`, `a1`, `n1`, `h-gym`…), usa ids derivados (idempotente) y deja la
  marca `orgrow:v1:imported:<userId>` en `localStorage`.
- Sincronización entre dispositivos: recarga al volver a la app tras ≥5 s oculta
  (`syncOnFocus`). No hay tiempo real (Realtime) todavía.

### Base de datos
- ✅ Proyecto de Supabase creado (región UE) y accesible: el endpoint REST responde
  y rechaza tablas inexistentes con `PGRST205`, lo que confirma que la clave es válida.
- ✅ **Parte 3 aplicada y verificada:** 6 tablas con RLS en el proyecto real. Sin sesión (`anon`) todo responde `permission denied`; con dos usuarios, ninguno ve ni toca filas del otro; el trigger crea el perfil con el nickname.
- Los datos de cada cuenta están en las tablas de Supabase (con RLS). `localStorage` solo
  conserva lo anterior a la Parte 4 y la marca de importación.
- No existe carpeta `supabase/` ni migraciones. **El esquema se gestiona desde el
  panel de Supabase**, no con migraciones a mano en el repo.
- La clave real vive solo en `.env.local` (ignorado por git); el repo contiene
  únicamente `.env.example` con nombres y valores vacíos.

### Repositorio
- `75172e7` — módulo de Tareas completo + `PROJECT_STATUS.md`.
- `44fba8e` — Parte 1 (cliente de Supabase).
- Parte 2 (autenticación) commiteada a continuación.

---

## 8. Problemas conocidos y errores pendientes

1. **Lint roto por finales de línea (preexistente).** `npm run lint` devuelve ~6620
   errores `prettier/prettier` porque los archivos están en CRLF y Prettier espera LF.
   No vienen del código ni de dependencias. Solución propuesta: `npm run format` o
   `"endOfLine": "auto"` en `.prettierrc` (commit aparte por el tamaño del diff).
2. **Dos lockfiles.** `bun.lock` (Lovable) y `package-lock.json` (npm). `bun` no está
   instalado, así que `bun.lock` no refleja los cambios de dependencias. Decidir un
   único gestor antes de producción.
3. ~~**Nombre de la app.**~~ ✅ Resuelto: la marca, los títulos de página y el
   favicon pendiente dicen **Orgrow** (el manifest llega en la Parte 7). Se mantiene
   la frase "Empecemos con calma" como texto, no como marca.
4. ~~**`next-up-card` y `upcoming-activities` con datos de ejemplo**~~ ✅ Resuelto en
   la Parte 6: leen actividades reales del store.
5. ~~Notas sin editar ni buscar~~ ✅ Resuelto en la Parte 5.
6. ~~**Agenda:** actividades de solo lectura.~~ ✅ Resuelto en la Parte 6: CRUD
   completo y vistas Día/Semana/Mes. Falta solo la persistencia en servidor.
7. Avisos del build/lint a vigilar (no bloquean): `__dirname` en `vitest.config.ts`
   (Vite sugiere `import.meta.dirname`) y recomendación de usar `resolve.tsconfigPaths`
   nativo en lugar del plugin `vite-tsconfig-paths`.
8. ~~**Sin auth**~~ ✅ Resuelto en la Parte 2: sin sesión no se ve ningún dato.
9. `localStorage` tiene ~5 MB y se borra si el usuario limpia el navegador.
10. Avisos `react-refresh/only-export-components` (7 preexistentes + `auth-store`) en componentes de `ui/` y en los stores.
11. **El registro exige confirmar el email** (`mailer_autoconfirm: false`). Con el
    SMTP por defecto de Supabase hay límites de envío (~3 correos/hora) y puede caer
    en spam. Para el uso real conviene configurar SMTP propio (Parte 11) o desactivar
    la confirmación en el panel si se prefiere entrar al instante.
12. ~~No es instalable~~ ✅ Resuelto en la Parte 7. Límite: el service worker solo se
    registra en **producción** (en `npm run dev` no hay caché), y `vite preview` no
    sirve este build (busca `dist/server`), así que la PWA solo se prueba en el despliegue.
13. ~~Datos locales por navegador~~ ✅ Resuelto en la Parte 4. Límites conocidos: sin
    Realtime (se ve el cambio al volver a la app), sin conflictos resueltos (última escritura
    gana, también al reenviar cambios hechos sin conexión) y TanStack Query sigue sin
    usarse: el store mantiene su propio estado optimista.
14. La importación local es **por cuenta**: en un navegador compartido, una segunda
    cuenta que inicie sesión importaría también los datos locales antiguos. Aceptable
    con un solo usuario; revisar antes de abrir a más personas.

---

## 9. Cómo ejecutar en local

Requisitos: Node.js 20+ (probado con 24) y npm.

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo → http://localhost:8080
npm run test         # tests (Vitest)
npm run test:watch   # tests en modo watch
npx tsc --noEmit     # comprobación de tipos
npm run build        # build de producción (genera .output/)
npm run preview      # servir el build
```

Advertencias:

- `npm run lint` falla por los CRLF descritos en el punto 8.1; **no es un fallo del código**.
- El puerto de desarrollo puede variar; Vite lo indica al arrancar.
- El proyecto está conectado a Lovable: **no reescribir historial publicado**
  (nada de force push, rebase o amend sobre commits ya subidos).

### Variables de entorno

Los valores **no se guardan en el repositorio**. Se declaran en `.env.local`
(ignorado por git) y sus nombres, vacíos, en `.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- Se usa el nombre **publishable** porque Supabase ya no emite `anon` clásicas para
  proyectos nuevos; esta clave es pública por diseño y el acceso lo limita RLS.
- La *service role / secret key* **nunca** debe estar en código de navegador ni en el
  repositorio.
- Tipado de las dos variables en `src/env.d.ts`.

---

## 10. Siguiente paso exacto

**Cerrar las Partes 4, 5 y 7 con pruebas manuales**, y después la **Parte 8 — Recordatorios**.

Prueba manual (hace falta una cuenta real confirmada):

1. `npm run dev`, entrar en `/acceso`, y crear una tarea, una nota, una actividad y
   un hábito con progreso.
2. Abrir la app en otro navegador o dispositivo con la misma cuenta: debe verlo todo.
3. Editar algo en uno, cambiar de pestaña 6 s y volver en el otro: se actualiza.
4. En el SQL Editor: `select count(*) from tasks;` ≠ 0 y, sin sesión, `permission denied`.
5. Si había datos propios en `localStorage`, deben haberse subido una vez (aviso en pantalla).

6. En `/notas`: editar una nota con el lápiz, buscar "telefono" y encontrar "teléfono".

Prueba manual de la PWA (solo en el despliegue, con HTTPS; el service worker no corre en `npm run dev`):

7. Abrir la app online una vez y comprobar en DevTools → Application → Service Workers que
   está activo y que `manifest.webmanifest` no da errores.
8. En el dashboard debe aparecer "Instala Orgrow" (Chrome/Android) o los pasos (Safari iOS).
9. Instalarla, activar modo avión y abrirla: debe abrir con los datos de la última vez y el
   aviso "Sin conexión".
10. Sin red, crear una tarea y marcar otra: se ven al momento, el aviso cuenta "2 cambios
    pendientes". Al volver la red se envían solos (comprobar en otro dispositivo).
11. Con la app cerrada más de una hora y sin red, abrirla: no debe pedir iniciar sesión.
12. Cerrar sesión: en `localStorage` desaparece `orgrow:v1:cache:<id>`.

Antes de subir a internet: `npm audit`, `npm run build` y revisar que `git status` no
muestra `.env*` (solo `.env.example`).

---

## Historial de partes

| Parte | Estado | Commit |
|---|---|---|
| 1 — Conexión del backend (Supabase) | ✅ completada | `44fba8e` |
| 2 — Autenticación y perfiles | ✅ completada | `88fadbb` |
| Marca Orgrow + nickname | ✅ completada | `829f326` |
| 6 — Agenda real (en local) | ✅ completada | ver `git log` |
| 3 — Esquema y RLS | ✅ completada y verificada | ver `git log` |
| 4 — Datos en servidor | ✅ implementada, falta prueba manual | ver `git log` |
| 5 — Notas completas | ✅ completada | ver `git log` |
| 7 — PWA y offline | ✅ implementada, falta prueba en dispositivos | ver `git log` |
| 8 — Recordatorios | ⏳ pendiente | — |
| 9 — Ajustes y datos | ⏳ pendiente | — |
| 10 — Calidad y seguridad | ⏳ pendiente | — |
| 11 — Producción | ⏳ pendiente | — |

---

## 8. Funciones nuevas acordadas (pendientes de implementar)

### Hábitos (decisiones del 2026-11-25) — ✅ implementado en local

Ruta `/habitos`, repositorios en `src/services/habits-repository.ts`, reglas en `src/lib/habits.ts`, claves `orgrow:v1:habits` y `orgrow:v1:habit-logs`. Falta pasarlo a Supabase (Partes 3 y 4).

- **Tipos de medición:** sí/no (ir al gym), cantidad con meta (1 l de agua, sumando
  registros) y tiempo con meta (leer 60 min).
- **Frecuencia flexible:** cada día, días concretos de la semana o X veces por semana.
- **Progreso:** calendario de calor (estilo GitHub) por hábito, con intensidad según el
  cumplimiento. Racha, porcentajes y anillo en Inicio quedan fuera por ahora.
- **Modelo de datos (para la Parte 3):** `habits` (nombre, tipo, meta, unidad, frecuencia,
  días, archivado) y `habit_logs` (hábito, fecha `YYYY-MM-DD`, valor). Un registro por
  hábito y día.

### Ideas aceptadas para valorar después
- Revisión diaria y semanal (qué hiciste, qué quedó pendiente, nota breve).
- Objetivos a largo plazo que agrupan hábitos y tareas.
- Temporizador de enfoque ligado a una tarea o hábito, que suma tiempo al registro.

Descartadas por ahora: diario y estado de ánimo.
