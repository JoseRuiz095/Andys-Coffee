# Despliegue de Andy's Coffee

Frontend en **Vercel**, backend en un contenedor **Docker en Render**, datos en **Supabase** y CI en **GitHub Actions**.

> Ninguna credencial real aparece en este documento. Los valores de producción viven solo en los paneles de Render y Vercel.

---

## 1. Arquitectura

```
Navegador
   │  https://<frontend>.vercel.app          (producción: login propio de la app)
   ▼                                         (previews: + Vercel Authentication)
Vercel ── sirve la SPA (frontend/dist)
   │  /api/*  ── rewrite (proxy) ──►  https://<backend>.onrender.com/api/*
   ▼
Render ── contenedor Docker: node dist/server.js (Express)
   │  TLS verificado (CA de Supabase)
   ▼
Supabase ── PostgreSQL (Prisma) + Storage (bucket "Img")
```

### Las tres capas de acceso (no confundirlas)

| Capa | Qué es | Qué protege |
| ---- | ------ | ----------- |
| **Autenticación de la app** (propia) | JWT en la cookie HttpOnly `token`, bcrypt, CSRF (tiny-csrf), RBAC y rate limiting | Todo el uso real del sistema, en producción y en preview |
| **Vercel Authentication** (Standard Protection) | Login de Vercel delante de los *deployments de preview* | Solo los previews. **No sustituye** el login de la app |
| **Supabase** | PostgreSQL + Storage | Infraestructura de datos. **No** se usa Supabase Auth |

### Por qué el rewrite de Vercel (y no llamar directo a Render)

El navegador envía las cookies SameSite=Lax (`token`) y SameSite=Strict (`csrfToken`) solo en peticiones **same-site**.

- `vercel.app` y `onrender.com` están en la Public Suffix List, así que `<app>.vercel.app` y `<api>.onrender.com` son **sitios distintos**.
- Un `fetch` directo del frontend al backend sería **cross-site**: no viajarían las cookies y fallarían el login y la CSRF.
- Con el rewrite, el navegador solo ve `https://<frontend>.vercel.app/api/...` (same-origin). Vercel reenvía la petición a Render y las cookies quedan first-party.
- Por eso el frontend usa `baseURL: '/api'` y **no hay** una variable de URL de API.

---

## 2. Variables de entorno

| Clase | Variable | Dónde (producción) | Notas |
| ----- | -------- | ------------------ | ----- |
| Pública | `VITE_SUPABASE_URL` | Vercel | Termina en el bundle; es pública por diseño |
| Secreta | `DATABASE_URL` | Render | Pooler de Supabase con `sslmode=require` |
| Secreta | `DIRECT_URL` | Render (opcional) y `.env.production` local | La usa Prisma CLI para migrar |
| Secreta | `JWT_SECRET` | Render | ≥ 32 caracteres, ≥ 16 distintos |
| Secreta | `CSRF_SECRET` | Render | Exactamente 32 caracteres |
| Secreta | `SUPABASE_SERVICE_ROLE_KEY` | Render | **Jamás** en el frontend |
| Secreta | `SUPABASE_ANON_KEY` | Render | Hoy solo la usa el backend |
| Secreta | `DATABASE_SSL_CA` **o** Secret File + `DATABASE_SSL_CA_PATH` | Render | CA de Supabase (contenido PEM o ruta) |
| Configuración | `NODE_ENV=production` | Imagen (ya viene fijada) | Render puede repetirla |
| Configuración | `PORT` | Render (lo inyecta) | La app lo respeta |
| Configuración | `CORS_ORIGINS` | Render | `https://<dominio-produccion-vercel>` (sin `*`) |
| Configuración | `TRUST_PROXY` | Render | **Se determina en el despliegue** (§6) |
| Configuración | `SUPABASE_URL`, `CASH_TIMEZONE`, `LOG_LEVEL` | Render | |
| Configuración | `ENABLE_CASH_AUTO_CLOSE`, `ENABLE_CASH_RECONCILIATION` | Render (opcional) | `false` desactiva los jobs |

**Reglas:**
- Todo `VITE_*` puede terminar en el bundle del frontend: **nunca** pongas un secreto en una variable `VITE_*`.
- Las variables del backend de producción se configuran **solo en Render**.
- `backend/.env.production` (ignorado por git) sirve únicamente para los comandos locales `*:prod`, como las migraciones. **Nunca** entra en la imagen: `.dockerignore` lo excluye.
- El backend carga `.env.<NODE_ENV>` si existe (`src/config/env.ts`). En el contenedor no hay archivo, así que usa las variables de Render, que siempre tienen prioridad.

---

## 3. Desarrollo local

Ver [Readme.md](../Readme.md), [backend/Readme.md](../backend/Readme.md) y [frontend/README.md](../frontend/README.md).
- `npm run dev` en cada app. El backend usa `.env.development` y Vite hace de proxy de `/api` hacia `:4000`.
- La BD de desarrollo es un proyecto de Supabase aparte (ver el backend README, "Base de datos de desarrollo").

---

## 4. Build

| App | Comando | Resultado |
| --- | ------- | --------- |
| Frontend | `npm run build` (`tsc -b && vite build`) | `frontend/dist/` |
| Backend | `npm run build` (esbuild) | `backend/dist/server.js`: un solo archivo ESM con todo `src/`; las dependencias quedan en `node_modules` |

El backend en producción corre con `node dist/server.js`. `npm run start` (tsx) queda solo para uso local.

---

## 5. Docker (backend)

`backend/Dockerfile` es multi-stage sobre `node:22-bookworm-slim`:
1. **Build:** `npm ci` → `prisma generate` → `npm run build` → `npm prune --omit=dev`.
2. **Runtime:** solo `node_modules` de producción, `dist/`, `package.json` y `prisma/schema.prisma`.
   - Corre como usuario `node` (no root), con `NODE_ENV=production`.
   - `HEALTHCHECK` sobre `GET /health` y `CMD node dist/server.js`.

`.dockerignore` excluye:
- `.env*`, salvo `.env.example`;
- `certs/`, `backups/`, `prisma/backups/`, `prisma/seed-data/` y `*.sql`;
- `test/` y `scripts/`.

**Probar localmente** (con la BD de pruebas de Docker levantada con `npm run test:db:up`):

```bash
cd backend
docker build -t andys-coffee-backend .
docker run --rm --name andys-api --network container:andys-coffee-test-postgres-1 \
  -v "$(pwd)/test/db/certs/ca.crt:/run/secrets/supabase-ca.crt:ro" \
  -e PORT=8080 -e DATABASE_SSL_CA_PATH=/run/secrets/supabase-ca.crt \
  -e DATABASE_URL="postgresql://andys:andys_test_password@localhost:5432/andys_test?sslmode=verify-full" \
  -e JWT_SECRET=<32+ caracteres> -e CSRF_SECRET=<32 caracteres> \
  -e SUPABASE_URL=http://localhost:54321 -e SUPABASE_ANON_KEY=x \
  -e CORS_ORIGINS=http://localhost:5173 andys-coffee-backend
docker inspect -f '{{.State.Health.Status}}' andys-api    # → healthy
```

`--network container:` hace falta porque el certificado de la BD de pruebas solo cubre `localhost`.

En Git Bash (Windows) antepón `MSYS_NO_PATHCONV=1`. Sin eso, Git Bash reescribe rutas como `/run/secrets/…` a `C:/Program Files/Git/run/…` y el contenedor no encuentra la CA.

### `/health`
- `GET /health` → `200 {"status":"ok"}`. **No toca la BD**: indica que el proceso atiende HTTP, nada más. Ver §8 sobre los jobs.

---

## 6. Render (backend)

**Crear el servicio** (acción manual):

| Campo | Valor |
| ----- | ----- |
| Tipo | Web Service → *Docker* |
| Repositorio | Este repositorio |
| Branch | `master` |
| **Root Directory** | `backend` |
| Dockerfile path | `./Dockerfile` |
| **Health Check Path** | `/health` |
| **Instancias** | **1**, sin autoescalado (ver §8) |
| **Plan** | Uno **sin suspensión** (Starter o superior). El Free se suspende y los jobs no correrían |
| **Auto-Deploy** | **After CI Checks Pass** (actívalo solo cuando `master` esté protegido, §10) |
| Variables | Las de la tabla §2 |
| CA de Supabase | *Secret File* `supabase-ca.crt` + `DATABASE_SSL_CA_PATH=/etc/secrets/supabase-ca.crt`, o `DATABASE_SSL_CA` con el PEM |

Al arrancar, el log debe mostrar `Modo PRODUCCIÓN`, la BD de producción (host y nombre) y `Backend listo`.

### `TRUST_PROXY` (se valida durante el despliegue)
La cadena teórica es navegador → Vercel → balanceador de Render → contenedor, pero **no se asume ningún valor**. Para determinarlo, **sin tocar código**:
1. Revisa los logs de peticiones de Render (IP de origen, `X-Forwarded-For`, `X-Forwarded-Proto`) y los de Vercel.
2. Configura `TRUST_PROXY` en Render según los saltos observados.
3. Valida:
   - el rate limit de login bloquea al 6.º intento **de un cliente** (misma IP y correo) **sin bloquear a otro cliente de otra red**;
   - las cookies llevan `Secure` y la sesión sobrevive a un refresh, lo que indica que `req.secure` es `true` detrás de los proxies.

Si con eso no alcanza y hace falta cambiar código (aunque sea un log temporal), se **pide autorización** antes.

---

## 7. Vercel (frontend)

**Proyecto** (acción manual):

| Campo | Valor |
| ----- | ----- |
| **Root Directory** | `frontend` |
| Framework | Vite |
| Install / Build | `npm ci` / `npm run build` |
| Output | `dist` |
| Node | 22.x |
| Variables | `VITE_SUPABASE_URL` (Production y Preview) |
| Deployment Protection | **Standard Protection** (Vercel Authentication en previews) |

`frontend/vercel.json` contiene solo los rewrites:
1. `/api/:path*` → `https://andys-coffee-api.onrender.com/api/:path*`. **Cambia la URL por la real del servicio de Render.**
2. `/(.*)` → `/index.html`: fallback de la SPA para que un refresh en `/dashboard` o `/settings` funcione.

### Producción vs preview
- **Producción:** la protege el login propio de la app.
- **Previews:** protegidos además con Vercel Authentication.
- **Limitación conocida de previews:** el rewrite apunta al backend de **producción** y `CORS_ORIGINS` solo permite el dominio de producción. Un preview muestra la interfaz, pero **no necesariamente puede usar la API** (CORS responde 403). Mejora futura: backend, BD, dominio y variables de *staging* propios.

---

## 8. Restricción de escalabilidad por jobs internos

- **Situación:** `cashAutoClose` (cada 15 minutos) y `cashReconciliation` (23:30) corren con `node-cron` **dentro del proceso** del backend.
- **Riesgo:**
  - Con 2 o más instancias se duplican los cierres automáticos y las notificaciones.
  - Si la instancia se suspende, los jobs no corren.
  - Hay que distinguir **disponibilidad HTTP** (responde cuando llega un request), **proceso vivo** (sigue corriendo sin tráfico) y **jobs ejecutados** (necesitan el proceso vivo a la hora indicada). Que `/health` responda no garantiza los jobs.
- **Decisión para el MVP:** **1 instancia** y un plan **sin suspensión**.
- **Futuro (no implementado):** mover los jobs a un worker, a un Render Cron Job o `pg_cron`, o a una cola de trabajos, para poder escalar el servicio HTTP.

---

## 9. Supabase y migraciones

- **Nunca en producción:** `prisma migrate dev`, `prisma db push` ni `prisma migrate reset`. `prisma.config.ts` los bloquea.
- **Mecanismo:** `prisma migrate deploy`, ejecutado **a mano**. **No** al arrancar el contenedor (la imagen ni siquiera incluye el CLI de Prisma).

**Secuencia para cada despliegue con migraciones** (desde una máquina con `backend/.env.production`):
1. `npx cross-env NODE_ENV=production prisma migrate status`: migraciones pendientes.
2. Revisar el SQL de cada migración pendiente (y, si hace falta, `prisma migrate diff` contra producción).
3. 🛑 **Mostrar la lista exacta de pendientes, con las operaciones destructivas señaladas, y obtener autorización explícita.**
4. `npm run prisma:migrate:deploy:prod`, con el backend detenido si la migración no es compatible con el código anterior.
5. `migrate status` sin pendientes.
6. `GET /health`.
7. Pruebas mínimas: login, una lectura y una escritura no destructiva.
8. Continuar con el despliegue: merge a `master` → CI → Render y Vercel.

---

## 10. CI/CD

```
CI:  GitHub Actions (.github/workflows/ci.yml) → solo valida
CD:  GitHub → Render ("Auto-Deploy: After CI Checks Pass") / Vercel (Git Integration) → producción
```

| Job | Qué valida |
| --- | ---------- |
| `frontend` | `npm ci`, lint, typecheck, build |
| `backend` | `npm ci`, lint, typecheck, `prisma validate`, `prisma generate`, unit tests, build |
| `backend-db` | PostgreSQL de prueba en Docker (TLS), migraciones y seed, tests de integración, Playwright E2E |
| `docker` | build de la imagen; sin herramientas de desarrollo, sin `.env` ni datos, usuario no root; arranque y health check |

- **No hay secretos en GitHub:** todo usa la BD de prueba y valores ficticios.
- **Protección de `master`** (acción manual; **antes** de activar el Auto-Deploy):
  - Pull Request obligatorio;
  - los 4 checks requeridos;
  - sin commits directos.
- Vercel despliega producción al hacer merge a `master`. Con la protección de rama, solo llega código que pasó la CI.

---

## 11. Rollback

| Qué | Cómo |
| --- | ---- |
| Frontend | Vercel → Deployments → *Instant Rollback* / *Promote* de un deployment anterior |
| Backend | Render → Deploys → *Rollback* a un deploy anterior |
| Base de datos | **No** se revierte con el código |

⚠️ **Hacer rollback del código ≠ hacer rollback de la BD.**
- Las migraciones de Prisma pueden ser irreversibles o incompatibles con el código anterior, por ejemplo los enums o el cambio de signo de `cash_movements.amount`.
- Un rollback que involucre cambios de esquema se planifica aparte: SQL inverso revisado, respaldo previo (`npm run db:replicate-prod-to-dev -- --yes` deja una copia en `backend/backups/`) y ensayo en la BD de desarrollo o de Docker.

---

## 12. Troubleshooting

| Síntoma | Causa probable | Qué revisar |
| ------- | -------------- | ----------- |
| `403 {"message":"This origin is not allowed."}` | El origen no está en `CORS_ORIGINS` (o es un preview) | `CORS_ORIGINS` en Render = dominio exacto de producción, con `https://` y sin `/` final |
| `403 CSRF token is invalid.` | Cookie `csrfToken` no enviada | Que el frontend llame a `/api` relativo (rewrite) y no directo a Render |
| El login responde 200 pero la sesión se pierde | Cookie `token` cross-site, o `Secure` sin HTTPS | Rewrite activo; dominio HTTPS; `NODE_ENV=production` |
| Rate limit bloquea a todos o a nadie | `TRUST_PROXY` incorrecto | §6 |
| El contenedor no arranca: `JWT_SECRET`/`CSRF_SECRET` | Faltan o no cumplen la longitud | Variables de Render |
| `self-signed certificate` / error TLS con la BD | Falta la CA o no corresponde | `DATABASE_SSL_CA` o el Secret File + `DATABASE_SSL_CA_PATH` |
| `Database connection must use SSL` | `DATABASE_URL` sin `sslmode=require` | Cadena de conexión |
| Primera petición tarda unos 50 s | Instancia suspendida (plan Free) | Plan sin suspensión (§8) |
| Cierres automáticos duplicados | Más de una instancia | Render: 1 instancia (§8) |
| Refresh en `/dashboard` da 404 en Vercel | Falta el fallback SPA | `frontend/vercel.json` |
| Imágenes rotas | `VITE_SUPABASE_URL` ausente o bucket distinto | Variable en Vercel; bucket `Img` público |
