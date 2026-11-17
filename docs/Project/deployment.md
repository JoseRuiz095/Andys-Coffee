# Despliegue de Andy's Coffee

> **Última actualización:** 14 de noviembre de 2026 (estabilización integral, fase 7).
> **Para:** quien despliega el sistema a producción y quien mantiene su configuración.

## 1. Arquitectura de producción

| Pieza | Dónde | Cómo se despliega |
|---|---|---|
| Frontend (React + Vite) | Vercel | Integración Git de Vercel (cada push a la rama configurada) |
| Backend (Express, imagen Docker) | Render, **una sola instancia** (los cron jobs viven en el proceso) | Job `deploy-render` de `.github/workflows/ci.yml`: después de que pasa todo el CI en `master`, llama al deploy hook de Render |
| Base de datos | Supabase Postgres (proyectos distintos para desarrollo y producción) | Migraciones **a mano**, nunca al arrancar el contenedor |
| Imágenes de productos | Supabase Storage (bucket público) | El backend sube y convierte a WebP |

**Rutas y cookies:**
- El frontend llama a `/api/*` en su propio dominio y Vercel lo reescribe al backend de Render. Así las cookies de sesión son first-party: nunca llames al backend cross-site.
- **Hay dos `vercel.json`:**
  - `vercel.json` (raíz): reescribe a `andys-coffee-api.onrender.com`, producción.
  - `frontend/vercel.json`: reescribe a `andys-coffee-dev.onrender.com`, desarrollo.
- Cuál usa cada proyecto de Vercel depende de su *Root Directory*. **Confírmalo en el panel de Vercel** antes de cambiar cualquiera de los dos.
- Ambos agregan encabezados de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

**Disparadores de deploy:** CI llama al deploy hook de Render. Si en Render también está activo "Auto-Deploy: After CI Checks Pass", se despliega dos veces: deja **solo uno** de los dos disparadores.

## 2. Variables de entorno (backend)

La lista completa y comentada está en `backend/.env.example`. En Render se configuran como variables del servicio (el certificado CA, como Secret File).

| Variable | Producción |
|---|---|
| `NODE_ENV` | `production` (ya viene en la imagen) |
| `DATABASE_URL` / `DIRECT_URL` | Pooler y conexión directa de Supabase, con `sslmode=require` |
| `DATABASE_SSL_CA_PATH` o `DATABASE_SSL_CA` | CA de Supabase del proyecto de producción |
| `JWT_SECRET` (≥32), `CSRF_SECRET` (=32) | Distintos de los de desarrollo |
| `CORS_ORIGINS` | El dominio de Vercel (obligatorio en producción) |
| `CASH_TIMEZONE` | `America/Mexico_City` |
| `TRUST_PROXY` | Número exacto de proxies entre el cliente y el contenedor (ver §2.1) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Solo backend; sin ellas no se suben imágenes (503) |
| `ADMIN_SEED_PASSWORD` | Obligatoria para correr el seed en producción |

### 2.1 TRUST_PROXY

- **Para qué sirve:** el límite de intentos de login usa la IP del cliente. Con `TRUST_PROXY` mayor que los saltos reales, un atacante puede falsificar `X-Forwarded-For` y saltarse el límite.
- **Valor:** el número de proxies entre el cliente y el contenedor (Vercel → Render → contenedor).
- **Cómo validarlo:** haz una petición y revisa en los logs que la IP registrada sea la del cliente, no la del proxy.
- **Riesgo adicional:** Render también es accesible directamente (sin pasar por Vercel). El límite se aplica igual, pero la IP vista cambia.

## 3. Comprobaciones de salud

| Ruta | Significado | Uso |
|---|---|---|
| `GET /health` | El proceso está vivo | Healthcheck del contenedor (Dockerfile) |
| `GET /ready` | La BD responde **y** tiene la última migración que exige el código (`src/config/migrations.ts`) | **Configura el health check de Render con `/ready`**: si la BD no tiene las migraciones, Render no pone en línea la versión nueva y mantiene la anterior |

Al arrancar con el esquema atrasado, el backend también lo registra en los logs como error.

## 4. Orden de despliegue (obligatorio)

Cada paso que toca producción requiere **aprobación explícita**. Nunca ejecutes `prisma migrate dev`, `migrate reset` ni `db push` contra Supabase. `prisma.config.ts` los bloquea con `NODE_ENV=production` y cuando un `.env` de desarrollo apunta a la BD de producción.

1. **Respaldo** de la base de producción (Supabase → Backups, o `pg_dump`).
2. **Listar migraciones pendientes:** `cross-env NODE_ENV=production npx prisma migrate status`.
3. **Normalización de datos**, si el despliegue incluye las migraciones del inventario en tiempo real (`20261111*`):
   - Sigue la *Fase 9* de `docs/Project/plan-inventario-tiempo-real.md`.
   - La segunda migración **aborta** si el catálogo no se normalizó antes con `scripts/normalize-catalog.ts`.
4. **Aplicar migraciones:** `npm run prisma:migrate:deploy:prod`.
5. **Permisos nuevos:** correr el seed en producción para crear `settings.manage` (estabilización 14/11/2026):
   - Comando: `cross-env NODE_ENV=production ADMIN_SEED_PASSWORD=… npx tsx prisma/seed.ts`.
   - En producción el seed **ya no toca el catálogo**: no sobrescribe precios ni borra promociones, salvo con `SEED_CATALOG=true`.
   - Solo hace upsert de roles, permisos, el admin y las preferencias por defecto.
   - ADMIN recibe `settings.manage`. Los roles personalizados que configuraban el sistema con `users.update` ahora necesitan que se les asigne `settings.manage`.
6. **Saldo inicial de inventario** (opcional, una sola vez, después de normalizar el catálogo con `--with-ingredients`):
   - **Qué carga:** el stock y el stock mínimo de `prisma/opening-stock.ts`, tomados de la columna "Stock Inicial" de la hoja de inventario de mayo de 2026. Son datos de hace meses: después hay que hacer un conteo físico.
   - **Vista previa:** `npm run seed:inventory:prod -- --report=saldo-inicial.md`. Escribe solo el archivo del reporte.
   - **Aplicar:** `npm run seed:inventory:prod -- --apply --confirm-host=<host de la BD>`.
   - **Qué no toca:** los insumos que ya tienen stock, movimientos, compras o un mínimo configurado.
   - **Qué registra:** cada saldo queda como movimiento `adjustment` con `referenceType = 'initial_balance'`.
   - **Qué queda fuera:** Vaso café caliente, Tapa vaso caliente, Fajo de cartón, Papel decorativo y Aguacate no se cargan mientras `PIECE_WEIGHT_GRAMS` no tenga su peso por pieza. Tampoco el Aceite para freír, porque la hoja no dice la unidad.
7. **Desplegar la imagen** (push a `master` → CI → deploy hook).
8. **Smoke test:**
   - `GET /ready` → 200;
   - iniciar sesión;
   - abrir el menú;
   - una venta de prueba en una caja de prueba (o en horario sin operación), cancelarla, y revisar el corte.
9. **Fotos del estado de resultados** (una sola vez, tras la estabilización del 14/11/2026):
   - **Por qué:** antes de la corrección IS‑0/IS‑1, las fotos congeladas se guardaban corridas un día y podían quedar calculadas con el filtro de una sola caja.
   - **Qué hacer:** borrar las fotos finales (`DELETE FROM income_statement_daily_snapshots WHERE "isFinal" = true;`). Son un caché derivado y se recalculan al consultarlas.
   - **Antes:** requiere aprobación y respaldo.

**Rollback:**
- **Código:** re-desplegar la imagen anterior en Render.
- **Migraciones:** no se revierten solas. Una migración aplicada se corrige con otra migración escrita a mano, ensayada en Docker (`ALTER … USING`, envuelta en `BEGIN/COMMIT`).
- **Datos:** restaurar el respaldo del paso 1.

## 5. Scripts que escriben datos

| Script | Protección |
|---|---|
| `prisma migrate reset/dev`, `db push` | Bloqueados en producción y cuando el `.env` apunta a producción (`prisma.config.ts`, test `production-guards`) |
| `prisma/seed.ts` | En producción omite el catálogo salvo `SEED_CATALOG=true` |
| `scripts/reset-operational-data.ts` (`db:reset-operations`) | Además de `--yes`, contra producción exige `--confirm-host=<host de la BD>` |
| `scripts/load-opening-stock.ts` (`seed:inventory`) | Vista previa por defecto; `--apply` para escribir; contra producción exige `--confirm-host=<host de la BD>`; nunca pisa stock existente |
| `scripts/sync-sales-menu-dev-to-prod.ts` | Vista previa por defecto; `--apply` para escribir; `--verify` para comparar |

## 6. Dependencias y seguridad

- **CI:**
  - frontend: `npm audit --omit=dev --audit-level=high`;
  - backend: `--audit-level=critical`.
- **Pendientes de seguridad en dependencias** (14/11/2026):
  - Prisma CLI (`deepmerge-ts`, alta): corregirlo exige Prisma 7 (mayor) y la CLI no viaja en la imagen.
  - `node-cron` (vía `uuid`, moderada): la función afectada no la usa este código.
  - Ambos se resuelven con una actualización mayor planificada.
- **Logs:** Pino redacta cookies, `authorization`, contraseñas y tokens.
- **Errores:** las respuestas 500 no incluyen trazas.
- **Apagado:** con SIGTERM (redeploy), el backend deja de aceptar peticiones, termina las que están en curso, detiene los cron jobs y cierra el pool de la BD (máximo 10 s).

## 7. Pruebas antes de desplegar

```bash
cd backend && npm run lint && npm run typecheck && npm run test:unit
npm run test:db:up            # Docker; ojo: test:db:prepare en Windows cierra TODOS los node.exe
npm run test:db:prepare
npm run test:integration
npm run test:e2e              # o con E2E_BACKEND_PORT/E2E_FRONTEND_PORT si 4000/5173 están ocupados
cd ../frontend && npm run lint && npm run typecheck && npm run test && npm run build
```
