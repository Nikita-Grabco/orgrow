# Orgrow

Aplicación web de organización personal diaria: tareas, agenda, hábitos y notas, con avisos
(recordatorios) y modo sin conexión. Funciona en móvil, tablet y ordenador, y se puede instalar
como app (PWA).

React 19 · TanStack Start/Router · TypeScript · Tailwind 4 · Supabase (Auth + Postgres con RLS).

## Empezar

```bash
npm install
cp .env.example .env.local   # y rellena los dos valores públicos de Supabase
npm run dev
```

Sin las variables de Supabase la app arranca pero muestra que falta configurar el servidor.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila para producción |
| `npm run check` | Tipos + lint + tests + `npm audit` + auditoría del repositorio |
| `npm test` | Tests (Vitest) |
| `npm run audit:repo` | Busca secretos, `.env`, correos personales y firmas de coautor antes de subir |
| `node scripts/generate-vapid-keys.mjs` | Claves de los avisos push |

## Documentación

- `PROJECT_STATUS.md` — estado, arquitectura, decisiones y pruebas manuales pendientes.
- `docs/supabase-*.sql` — esquema, recordatorios, borrado de cuenta y pruebas de seguridad.
- `docs/recordatorios-setup.md` — puesta en marcha de los avisos push.
- `docs/produccion.md` — despliegue, entornos, copias de seguridad y lista de comprobación.

## Seguridad

Los valores de entorno viven en `.env.local` (ignorado por git). La única clave de Supabase que
llega al navegador es la *publishable*; la *service role* y la clave privada VAPID **nunca** van
en el repositorio ni en el navegador. El acceso a los datos lo limita RLS en la base de datos.
