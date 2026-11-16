# PROJECT_STATUS — Orgadia

> Memoria permanente del proyecto. **Mantener actualizado al terminar cada funcionalidad importante.**
> No incluir contraseñas, claves API ni datos sensibles.

Última actualización: 2026-11-16
Commit de referencia: `7098b7c` (chore(deps): corregir vulnerabilidades de npm audit)
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
| Nitro | 3.0.260603-beta (build de servidor) |
| `@lovable.dev/vite-tanstack-config` | 2.27.2 |

Sin dependencias nuevas añadidas para el módulo de Tareas.

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
                    └── supabase-*.ts                 ← futuro, misma interfaz
```

```
dia-en-orden/
├── PROJECT_STATUS.md          ← este archivo
├── AGENTS.md                  ← reglas del proyecto + reglas de Lovable
├── package.json               ← scripts, overrides, dependencias
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
    ├── services/              ← planner-storage, tasks-repository, notes-repository
    ├── store/                 ← planner-store.tsx
    ├── test/                  ← setup + tests
    ├── types/                 ← planner.ts (tipos del dominio)
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

### Calidad
- 20 tests en 5 archivos (fechas, agrupación, repositorios, store/persistencia, rutas).
- `npm run build` y `npx tsc --noEmit` en verde.
- SSR verificado: `/`, `/tareas`, `/agenda`, `/notas` responden 200.

---

## 5. Funcionalidades pendientes

_(Ver el plan de 11 partes acordado con el usuario.)_

1. **Parte 1 — Backend:** proyecto **Supabase propio** (decisión tomada), entornos y
   secretos, cliente de Supabase.
2. **Parte 2 — Autenticación:** login (un solo usuario real, pero con auth),
   sesión persistente, rutas protegidas, perfil real (hoy `sampleUser` = "Nikita").
3. **Parte 3 — Esquema y RLS:** tablas `profiles`, `tasks`, `notes`, `activities`,
   índices y políticas por usuario.
4. **Parte 4 — Tareas en servidor:** repositorio Supabase, TanStack Query, importación
   de los datos locales, sincronización entre dispositivos.
5. **Parte 5 — Notas:** editar, buscar, filtros y persistencia en servidor.
6. **Parte 6 — Agenda real:** CRUD de actividades, fechas/horas reales, navegación
   entre semanas (hoy son de solo lectura con `dayOffset`).
7. **Parte 7 — PWA:** instalable, service worker, offline y cola de escrituras.
8. **Parte 8 — Recordatorios:** hora de aviso, Web Push y función programada
   (iOS requiere PWA instalada; valorar Capacitor más adelante).
9. **Parte 9 — Ajustes:** perfil, zona horaria, exportar/importar JSON, categorías
   propias, borrado de cuenta.
10. **Parte 10 — Calidad/seguridad:** validación con `zod` en servidor, tests de RLS,
    rate limiting, E2E con Playwright, accesibilidad, lint normalizado.
11. **Parte 11 — Producción:** dominio, entornos, backups, monitorización, CI/CD,
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

---

## 7. Estado actual

### Frontend
- ✅ Terminado y funcional para Tareas, Notas (parcial) y Agenda (solo lectura).
- ✅ Responsive en los tres formatos; verificado por SSR + revisión de clases.
- ⚠️ Pendiente una revisión visual manual en dispositivos reales.

### Backend
- ❌ **No existe** backend de negocio.
- Existe andamiaje de TanStack Start: `src/server.ts` (entrada SSR y errores),
  `src/start.ts` (middlewares de error y CSRF), `QueryClient` por petición en
  `src/router.tsx`. No hay endpoints ni *server functions* en uso.

### Base de datos
- ❌ **No hay base de datos conectada.**
- Datos en `localStorage` del navegador (por dispositivo, sin sincronización).
- No existe carpeta `supabase/` ni migraciones.
- No hay `.env` ni claves en el repositorio.

### Repositorio
- Commit `7098b7c` incluye la corrección de dependencias.
- **Trabajo pendiente de commit:** el módulo de Tareas completo (13 archivos
  modificados, 8 nuevos, 1 eliminado).

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

### Variables de entorno (previstas)

Nombres previstos para la Parte 1; los valores **no se guardan en el repositorio**:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

La *service role key* nunca debe estar en código de navegador ni en el repositorio.

---

## 10. Siguiente paso exacto

**Parte 1 — Conexión del backend (Supabase propio).**

1. Crear un proyecto en Supabase (elegir región europea) y anotar la URL y la
   `anon key` en un gestor de secretos, **no en el repositorio**.
2. Crear `.env.local` (ignorado por git) con `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY`, y un `.env.example` con los nombres vacíos.
3. Instalar `@supabase/supabase-js` (primera dependencia nueva del proyecto).
4. Crear `src/services/supabase-client.ts` con un cliente único y tipado.
5. Verificar que `npm run build`, `npx tsc --noEmit` y `npm run test` siguen en verde.

**Criterio de terminado:** la app arranca igual que ahora, el cliente de Supabase
inicializa sin errores y no hay secretos en el repositorio.

Después de esta parte: **Parte 2 — Autenticación y perfiles**.
