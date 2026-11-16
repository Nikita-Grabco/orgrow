# PROJECT_STATUS — Orgadia

> Memoria permanente del proyecto. **Mantener actualizado al terminar cada funcionalidad importante.**
> No incluir contraseñas, claves API ni datos sensibles.

Última actualización: 2026-11-16 (Parte 1 completada)
Commit de referencia: `75172e7` (feat(tareas): CRUD completo con fechas reales y persistencia)
Rama: `main`

---

## 1. Objetivo y descripción

**Orgadia** es una aplicación web de organización personal diaria que debe funcionar
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
    │   ├── __root.tsx         ← layout, providers, 404, error boundary
    │   ├── index.tsx          ← Dashboard (/)
    │   ├── tareas.tsx         ← /tareas
    │   ├── agenda.tsx         ← /agenda
    │   └── notas.tsx          ← /notas
    ├── components/
    │   ├── ui/                ← kit shadcn (no editar salvo necesidad)
    │   ├── layout/            ← sidebar, nav móvil, AppShell, avatar
    │   ├── dashboard/         ← resumen del día, próximas, notas rápidas
    │   ├── tasks/             ← task-dialog, task-date-picker, task-item, task-list, task-check
    │   ├── notes/             ← note-card, note-composer
    │   ├── agenda/            ← activity-timeline
    │   └── common/            ← chip, section-card, page-header, empty-state
    ├── config/                ← categorías, prioridades, tipos de nota, navegación
    ├── data/                  ← sample-data.ts (semilla del primer arranque)
    ├── hooks/                 ← useToday, useMobile
    ├── lib/                   ← dates.ts, planner.ts, utils.ts, errores
    ├── services/              ← planner-storage, tasks-repository, notes-repository, supabase-client
    ├── store/                 ← planner-store.tsx
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
- Diseño "Calma" responsive: rail de iconos en tablet, sidebar completo en escritorio,
  barra inferior en móvil con FAB central.
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
- Filtros por tipo en `/notas`.

### Agenda
- Vista de 7 días con actividades (datos de ejemplo) y tareas por día.
- Sincronizada con las fechas reales de las tareas.

### Persistencia
- Tareas y notas se guardan en `localStorage` con claves versionadas
  (`orgadia:v1:tasks`, `orgadia:v1:notes`).
- Semilla de datos demo **solo la primera vez**; si se borra todo, no reaparecen.
- Migración automática de datos antiguos con `dayOffset`.
- Actualización optimista con rollback y aviso si el guardado falla.
- Datos corruptos → se ignoran y se vuelve a sembrar (nunca rompe la UI).

### Backend (Parte 1)

- Cliente único de Supabase en `src/services/supabase-client.ts`, creado de forma
  perezosa (`getSupabaseClient()`), con `persistSession`, `autoRefreshToken`,
  `detectSessionInUrl` y `storageKey: "orgadia:auth"`.
- `getSupabaseConfig()` valida que las dos variables existan y que la URL tenga
  forma de proyecto Supabase; `SupabaseConfigError` explica qué falta.
- `isSupabaseConfigured()` permite degradar a modo local si no hay entorno.
- Tipado de `import.meta.env` en `src/env.d.ts`.

### Calidad
- 25 tests en 6 archivos (fechas, agrupación, repositorios, store/persistencia, rutas,
  configuración de Supabase).
- `npm run build` y `npx tsc --noEmit` en verde.
- SSR verificado: `/`, `/tareas`, `/agenda`, `/notas` responden 200.
- Conexión comprobada contra el proyecto real: `/auth/v1/health` responde 200.

---

## 5. Funcionalidades pendientes

_(Ver el plan de 11 partes acordado con el usuario.)_

✅ **Parte 1 — Backend: completada.** Proyecto Supabase propio, `.env.local` +
`.env.example`, `@supabase/supabase-js` y cliente único validado.

Las siguientes partes del plan ya están cubiertas en "implementado" donde aplica:

1. **Parte 2 — Autenticación:** login (un solo usuario real, pero con auth),
   sesión persistente, rutas protegidas, perfil real (hoy `sampleUser` = "Nikita").
2. **Parte 3 — Esquema y RLS:** tablas `profiles`, `tasks`, `notes`, `activities`,
   índices y políticas por usuario.
3. **Parte 4 — Tareas en servidor:** repositorio Supabase, TanStack Query, importación
   de los datos locales, sincronización entre dispositivos.
4. **Parte 5 — Notas:** editar, buscar, filtros y persistencia en servidor.
5. **Parte 6 — Agenda real:** CRUD de actividades, fechas/horas reales, navegación
   entre semanas (hoy son de solo lectura con `dayOffset`).
6. **Parte 7 — PWA:** instalable, service worker, offline y cola de escrituras.
7. **Parte 8 — Recordatorios:** hora de aviso, Web Push y función programada
   (iOS requiere PWA instalada; valorar Capacitor más adelante).
8. **Parte 9 — Ajustes:** perfil, zona horaria, exportar/importar JSON, categorías
   propias, borrado de cuenta.
9. **Parte 10 — Calidad/seguridad:** validación con `zod` en servidor, tests de RLS,
   rate limiting, E2E con Playwright, accesibilidad, lint normalizado.
10. **Parte 11 — Producción:** dominio, entornos, backups, monitorización, CI/CD,
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
| 2026-11 | `dayOffset` **eliminado de `Task`** (se mantiene en `Activity` hasta la Parte 6) | Una sola fuente de verdad |
| 2026-11 | Un **único `TaskDialog`** para crear y editar | Evitar duplicar formularios |
| 2026-11 | **Semilla demo solo en el primer arranque** | Evitar que reaparezcan tareas borradas |
| 2026-11 | Lectura de almacenamiento solo en `useEffect` + flag `isReady` | Evitar hydration mismatch en SSR |
| 2026-11 | Actualización **optimista** con recarga en caso de error | UI instantánea y sin mentir sobre lo guardado |
| 2026-11 | `vite` fijado exacto + overrides documentados | Parchear vulnerabilidades sin romper el build |
| 2026-11 | No se toca `src/components/ui/*` ni `styles.css` al añadir funcionalidad | Mantener el diseño de Lovable intacto |
| 2026-11 | Cliente de Supabase **perezoso** (no al importar el módulo) | SSR y build no tienen variables ni `localStorage`; así nada se rompe |
| 2026-11 | Variable `VITE_SUPABASE_PUBLISHABLE_KEY` (no `ANON_KEY`) | Es la clave que emite Supabase hoy; el nombre evita confundirla con un secreto |
| 2026-11 | `.gitignore` bloquea `.env` y `.env.*`, permite `.env.example` | Evitar filtrar claves por accidente |

---

## 7. Estado actual

### Frontend
- ✅ Terminado y funcional para Tareas, Notas (parcial) y Agenda (solo lectura).
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
- ❌ Sin auth todavía (Parte 2) y sin consultas a datos (Parte 4).

### Base de datos
- ✅ Proyecto de Supabase creado (región UE) y accesible: el endpoint REST responde
  y rechaza tablas inexistentes con `PGRST205`, lo que confirma que la clave es válida.
- ❌ **Aún no hay tablas ni políticas RLS** (Parte 3).
- Datos en `localStorage` del navegador (por dispositivo, sin sincronización).
- No existe carpeta `supabase/` ni migraciones. **El esquema se gestiona desde el
  panel de Supabase**, no con migraciones a mano en el repo.
- La clave real vive solo en `.env.local` (ignorado por git); el repo contiene
  únicamente `.env.example` con nombres y valores vacíos.

### Repositorio
- `75172e7` — módulo de Tareas completo + `PROJECT_STATUS.md`.
- Parte 1 (cliente de Supabase) commiteada a continuación.

---

## 8. Problemas conocidos y errores pendientes

1. **Lint roto por finales de línea (preexistente).** `npm run lint` devuelve ~6620
   errores `prettier/prettier` porque los archivos están en CRLF y Prettier espera LF.
   No vienen del código ni de dependencias. Solución propuesta: `npm run format` o
   `"endOfLine": "auto"` en `.prettierrc` (commit aparte por el tamaño del diff).
2. **Dos lockfiles.** `bun.lock` (Lovable) y `package-lock.json` (npm). `bun` no está
   instalado, así que `bun.lock` no refleja los cambios de dependencias. Decidir un
   único gestor antes de producción.
3. **Nombre de la app.** La UI y los metadatos dicen "Calma"; el proyecto se llama
   **Orgadia**. Unificar textos, título, manifest y favicon en una tarea de marca.
4. **`next-up-card` y `upcoming-activities` siguen 100 % con datos de ejemplo**
   (no dependen de tareas). Se resolverá con la Parte 6.
5. **Notas:** no se pueden editar ni buscar; no hay persistencia remota.
6. **Agenda:** actividades de solo lectura, sin crear/editar/borrar ni cambiar de semana.
7. Avisos del build/lint a vigilar (no bloquean): `__dirname` en `vitest.config.ts`
   (Vite sugiere `import.meta.dirname`) y recomendación de usar `resolve.tsconfigPaths`
   nativo en lugar del plugin `vite-tsconfig-paths`.
8. **Sin auth**: cualquiera con la URL ve la app (solo datos locales).
9. `localStorage` tiene ~5 MB y se borra si el usuario limpia el navegador.
10. Avisos `react-refresh/only-export-components` (7, preexistentes) en componentes de `ui/` y en el store.

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

**Parte 2 — Autenticación y perfiles.**

1. Activar el proveedor **Email** en Supabase (Authentication → Providers). Decidir
   entre enlace mágico y contraseña (recomendado: enlace mágico, sin contraseñas que
   gestionar). Opcional: Google.
2. Crear la tabla `profiles` (id = `auth.users.id`, nombre, iniciales, timestamps) —
   se hará junto con el esquema de la Parte 3 si conviene adelantarla.
3. Añadir la capa de sesión en el cliente: `supabase.auth.getSession()`,
   `onAuthStateChange` y un `AuthProvider` que exponga `user`, `isLoading`, `signIn`,
   `signOut` a la UI.
4. Pantalla de acceso con el lenguaje visual actual y **rutas protegidas** en
   `__root.tsx` (redirección a `/acceso` sin sesión).
5. Sustituir `sampleUser` ("Nikita/NG") por el perfil real en `UserAvatar` y saludo.

**Criterio de terminado:** sin sesión no se ve ningún dato; con sesión, la app se ve
exactamente igual que hoy y el perfil muestra el nombre real.

Después de esta parte: **Parte 3 — Esquema y RLS**.

---

## Historial de partes

| Parte | Estado | Commit |
|---|---|---|
| 1 — Conexión del backend (Supabase) | ✅ completada | ver `git log` |
| 2 — Autenticación y perfiles | ⏳ siguiente | — |
| 3 — Esquema y RLS | ⏳ pendiente | — |
| 4 — Tareas en servidor | ⏳ pendiente | — |
| 5 — Notas completas | ⏳ pendiente | — |
| 6 — Agenda real | ⏳ pendiente | — |
| 7 — PWA y offline | ⏳ pendiente | — |
| 8 — Recordatorios | ⏳ pendiente | — |
| 9 — Ajustes y datos | ⏳ pendiente | — |
| 10 — Calidad y seguridad | ⏳ pendiente | — |
| 11 — Producción | ⏳ pendiente | — |
