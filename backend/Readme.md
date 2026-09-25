# Andy's Coffee — Backend

API REST del punto de venta: Node.js + Express 5 + TypeScript, Prisma 6 sobre PostgreSQL (Supabase) y Zod para validar entradas.

---

## Inicio rápido

```bash
npm install
# Certificado CA de Supabase de cada proyecto: certs/dev/ y certs/prod/
npm run prisma:generate
npm run dev                     # Modo development
npm run start                   # Modo produccion
```

`npm run dev` libera el puerto 4000 si está ocupado y arranca `tsx watch src/server.ts` (recarga al guardar).

---

## Scripts

| Script | Qué hace |
| ------ | -------- |
| `npm run dev` | Servidor de desarrollo con recarga (`.env.development`) |
| `npm run start` | Servidor en modo producción (`NODE_ENV=production`, `.env.production`) |
| `npm run lint` | ESLint (incluye la regla que impide usar Prisma fuera de los repositorios) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` | Regenera el cliente de Prisma (después de cambiar `schema.prisma`) |
| `npm run prisma:migrate:deploy` / `prisma:migrate:deploy:prod` | Aplica migraciones pendientes a la BD de `.env.development` / `.env.production`. **Únicos comandos de migración para Supabase** |
| `npm run prisma:migrate` | `prisma migrate dev`. **Solo contra la BD de Docker** (ver abajo) |
| `npm run seed` | Genera el cliente y ejecuta `prisma/seed.ts` |
| `npm run catalog:export` / `catalog:export:prod` | Exporta el catálogo de la BD de desarrollo / producción (solo lectura) |
| `npm run db:replicate-prod-to-dev -- --yes` | Reemplaza **todos** los datos de desarrollo por una copia de producción (solo lee producción; guarda la copia en `backups/`, ignorada por git) |
| `npm run db:reset-operations:prod -- --yes` | Limpia la operación de producción (ventas, cajas, gastos, compras, movimientos, conteos, notificaciones, auditoría); conserva catálogo, ingredientes con su stock como saldo inicial, proveedores, preferencias y usuarios. Sin `:prod`, lo hace en desarrollo |
| `npm run storage:copy-to-dev` | Copia las imágenes del bucket de producción al proyecto de desarrollo (`--dry-run` para solo listar) |
| `npm run test:unit` | Pruebas unitarias (sin BD) |
| `npm run test:db:up` / `test:db:prepare` / `test:db:down` | BD de pruebas en Docker |
| `npm run test:integration` | Pruebas de integración (BD de Docker) |
| `npm run test:e2e` / `test:e2e:report` | Pruebas E2E con Playwright / reporte HTML |
| `npm run test:critical` | Unitarias + integración + E2E |

Scripts de mantenimiento en `scripts/`. Se ejecutan con `npx tsx scripts/<archivo>` contra la BD de `.env.development`, o con `npx cross-env NODE_ENV=production tsx scripts/<archivo>` contra la de `.env.production`:

| Script | Qué hace |
| ------ | -------- |
| `copy-storage-to-dev.ts` | Lee el bucket `Img` de producción y copia al de desarrollo lo que falte (ignora `NODE_ENV`; usa los dos archivos) |
| `export-catalog.ts` | **Solo lectura.** Exporta el catálogo de la BD a `prisma/seed-data/catalog.json` (ver [Seed](#seed-y-catálogo)) |
| `check-enum-migration.ts` | **Solo lectura.** Verificación antes/después de las migraciones `20260923*`; `--backup` escribe un respaldo JSON en `prisma/backups/` |
| `seed-inventory.ts`, `seed-suppliers.ts` | Cargas iniciales antiguas de ingredientes y proveedores (sustituidas por `export-catalog` + seed) |
| `fix-expense-dates-c01.sql` | Corrección puntual de datos aplicada en la auditoría (histórico) |

---

## Variables de entorno

Cada entorno tiene su archivo, creado a partir de la plantilla [`.env.example`](.env.example):

| Archivo | Se usa con |
| ------- | ---------- |
| `.env.development` | `npm run dev`, `npm run prisma:migrate:deploy`, `npx tsx scripts/…`, el seed y cualquier comando sin `NODE_ENV` |
| `.env.production` | `npm run start`, `npm run prisma:migrate:deploy:prod`, `npm run catalog:export:prod` y todo lo que se ejecute con `NODE_ENV=production` |

- El archivo se elige por la variable **`NODE_ENV` del proceso** (`src/config/env.ts`): el `NODE_ENV` escrito dentro del archivo no sirve para elegirlo. En PowerShell se fija con `$env:NODE_ENV="production"` o, en cualquier terminal, con `npx cross-env NODE_ENV=production <comando>`.
- Las variables que ya existen en el entorno **tienen prioridad** sobre el archivo (así las inyectan las pruebas y las plataformas de hosting). Si `DATABASE_URL` aparece definida en tu terminal (`echo $env:DATABASE_URL`), el archivo no la cambiará.
- Las pruebas fijan `NODE_ENV=test` y sus propias variables, así que nunca leen estos archivos.
- Los archivos `.env.*` nunca se suben al repositorio (solo `.env.example`). El antiguo `backend/.env` ya no se lee.
- **Protección:** si `.env.development` apunta a la misma base de datos que `.env.production`, el backend lo avisa al arrancar (error en el log), el seed también, y `prisma migrate dev`, `prisma migrate reset` y `prisma db push` se niegan a ejecutarse. `prisma migrate dev` y `db push` tampoco se ejecutan nunca con `NODE_ENV=production`.

### Base de datos de desarrollo

Desarrollo debe tener su propia base de datos (un proyecto de Supabase aparte), para probar y usar `prisma migrate dev` sin riesgo para los datos reales.

1. **Crear el proyecto** de Supabase de desarrollo.
2. **Completar `.env.development`** con los datos del proyecto nuevo:
   - `DATABASE_URL` y `DIRECT_URL`: Project Settings → Database → Connection string. Deben incluir `sslmode=require`.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API.
   - `JWT_SECRET` y `CSRF_SECRET` **distintos** a los de producción, para que una sesión de un entorno no sirva en el otro.
   - `ADMIN_SEED_PASSWORD`: contraseña del admin de desarrollo.
   - `DATABASE_SSL_CA_PATH`: el certificado CA de Supabase. Suele ser el mismo para todos los proyectos; descárgalo del proyecto nuevo (Database → SSL) si la conexión lo rechaza.
3. **Comprobar:** `npm run dev`. El log debe decir `Modo DEVELOPMENT` con el host o usuario del proyecto nuevo, **sin** el error "apunta a la base de datos de PRODUCCIÓN".
4. **Crear las tablas:** `npm run prisma:migrate:deploy`.
5. **Copiar los datos de producción**, a elegir:
   - **Todo** (ventas, cajas, gastos, usuarios…), para tener una réplica exacta: `npm run db:replicate-prod-to-dev -- --yes`. Usa `pg_dump`/`psql` de la imagen `postgres:17-alpine`, así que necesita Docker. Exige las mismas migraciones en ambas BD y reemplaza desarrollo en una sola transacción.
   - **Solo el catálogo:** `npm run catalog:export:prod` y después `npm run seed`.
6. **Copiar las imágenes:** `npm run storage:copy-to-dev -- --dry-run` para revisar la lista, y luego `npm run storage:copy-to-dev`. Crea el bucket `Img` público si no existe. Las imágenes subidas desde la app guardan su URL completa de producción y se siguen viendo desde ahí.
7. El frontend no necesita cambios: con `npm run dev` toma `SUPABASE_URL` de `.env.development`.

Para refrescar desarrollo con datos nuevos de producción, repite los pasos 5 y 6. Si quieres empezar de cero, antes ejecuta `npx prisma migrate reset`, que ahora sí se permite porque desarrollo ya no apunta a producción.

| Variable | Obligatoria | Descripción |
| -------- | ----------- | ----------- |
| `DATABASE_URL` | Sí | Conexión de la app (pooler de Supabase) con `sslmode=require` o `verify-full` |
| `DIRECT_URL` | Recomendada | Conexión directa usada por Prisma Migrate |
| `DATABASE_SSL_CA_PATH` | Sí (o `DATABASE_SSL_CA`) | Ruta al certificado CA del proyecto de Supabase: `certs/dev/prod-ca-2021.crt` en desarrollo, `certs/prod/prod-ca-2021.crt` en producción local. En Render: Secret File o `DATABASE_SSL_CA` con el contenido |
| `JWT_SECRET` | Sí | ≥ 32 caracteres y ≥ 16 distintos (`openssl rand -base64 48`) |
| `CSRF_SECRET` | Sí | Exactamente 32 caracteres |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Sí | Proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Para subir imágenes de productos. **Solo backend, jamás en el frontend** |
| `PORT` | No | Por defecto `4000` |
| `NODE_ENV` | No | `development` / `production` |
| `CORS_ORIGINS` | En producción | Orígenes permitidos, separados por comas |
| `CASH_TIMEZONE` | No | Zona del día de negocio (por defecto `America/Mexico_City`) |
| `TRUST_PROXY` | No | Número de proxies inversos delante de la API; vacío si se accede directo |
| `LOG_LEVEL` | No | Nivel de Pino (por defecto `info`) |
| `ADMIN_SEED_PASSWORD` | Con `NODE_ENV=production` | Contraseña inicial de `admin@andyscoffee.local` |
| `ENABLE_CASH_AUTO_CLOSE`, `ENABLE_CASH_RECONCILIATION` | No | `false` desactiva los jobs programados |

---

## Estructura

```
backend/
├── prisma/
│   ├── schema.prisma        # modelo de datos (fuente de verdad)
│   ├── migrations/          # migraciones SQL versionadas
│   ├── seed.ts              # roles, permisos, admin, catálogo, preferencias
│   ├── seed-catalog.ts      # carga de prisma/seed-data/catalog.json
│   └── backups/             # respaldos JSON tomados antes de migraciones de datos
├── scripts/                 # mantenimiento (ver tabla anterior)
├── src/
│   ├── app.ts / server.ts   # configuración de Express y arranque
│   ├── config/              # entorno, Prisma, seguridad, CSRF, Supabase
│   ├── routes/              # endpoints y cadena de middlewares
│   ├── middleware/          # auth, permisos, validación, rate limit, errores
│   ├── controllers/         # HTTP: leen la entrada ya validada y responden
│   ├── services/            # reglas de negocio
│   ├── repositories/        # acceso a datos (Prisma) y transacciones
│   ├── validators/          # esquemas Zod
│   ├── jobs/                # tareas programadas (node-cron)
│   ├── types/               # tipos compartidos (req.user, etc.)
│   └── utils/               # errores de dominio, fechas de negocio, paginación…
└── test/                    # unitarias, integración, E2E y BD de Docker
```

---

## Arquitectura

### Capas

| Capa | Responsabilidad | No debe |
| ---- | --------------- | ------- |
| **Route** | Declarar el endpoint y su cadena `requireAuth → checkPermission → validate(schema) → controller` | Tener lógica |
| **Controller** | Leer `req` (body ya validado; query con `schema.parse(req.query)`), llamar al service y responder | Tener `try/catch` ni reglas de negocio |
| **Service** | Reglas de negocio, orquestación, transacciones (`runInTransaction`) | Importar `config/prisma` (ESLint lo bloquea) |
| **Repository** | Consultas Prisma; reciben el cliente `tx` cuando participan en una transacción | Tener reglas de negocio |

### Convenciones

- **Rutas:** todas declaran `checkPermission` y validan el body con `validate()`. `test/route-policy.test.ts` falla si una ruta nueva no lo hace; las excepciones (rutas públicas, recursos acotados por usuario, acciones sin body) están listadas ahí con su motivo.
- **Query strings:** los flags booleanos usan `queryBoolean` (`validators/common.validator.ts`); nunca `z.coerce.boolean()`, que convierte `"false"` en `true`.
- **Transacciones:** `runInTransaction(work, { serializable: true })` para operaciones con carreras (ventas, caja, inventario). Las notificaciones se envían **después** de confirmar la transacción.
- **Errores:** los services lanzan errores de dominio (`utils/errors.ts`) y el `errorHandler` global los traduce. Express 5 reenvía los errores de handlers async, por eso los controllers no usan `try/catch`.

| Error | HTTP | Cuerpo |
| ----- | ---- | ------ |
| `ZodError` / `ValidationError` | 400 | `{ message, errors? }` |
| `AuthenticationError` | 401 | `{ message }` |
| `AuthorizationError` | 403 | `{ message }` |
| `NotFoundError` | 404 | `{ message }` |
| `BusinessRuleError` / `StateTransitionError` | 409 | `{ message }` |
| `ConflictError` | 409 | `{ error: 'CONFLICT_ERROR', message }` |
| `DuplicateError` / único duplicado (P2002) | 409 | `{ error: 'DUPLICATE_ERROR', message, details }` |
| Conflicto de concurrencia (P2034) | 409 | `{ message }` (reintentar) |
| Cualquier otro | 500 | `{ message }` genérico, sin detalles internos |

- **Logs:** Pino estructurado; nada de `console.log` en `src/` (ESLint).

---

## API

Prefijo `/api`. Formato: colección `GET /recurso`, detalle `GET /recurso/:id`, alta `POST`, edición `PATCH /recurso/:id`, subcampos `PATCH /recurso/:id/campo` (p. ej. `/active`) y acciones `POST|PATCH /recurso/:id/accion`.

| Recurso | Uso |
| ------- | --- |
| `/auth` | `login`, `logout`, `csrf`, `me`, `change-password`, `profile` |
| `/menu` | Menú público del POS (productos, combos y promociones activas) |
| `/categories`, `/products` | Catálogo (imágenes vía multipart a Supabase Storage) |
| `/orders` | Ventas, estados, pagos pendientes (`/payments/pending`), mandaditos (`/deliveries/pending`), `/by-date` |
| `/cash-register` | Sesiones de caja: abrir, cerrar, corregir, reabrir, historial |
| `/expenses` | Gastos |
| `/inventory`, `/inventory-counts`, `/purchases`, `/suppliers` | Ingredientes, salidas, movimientos, conteos físicos, compras y proveedores |
| `/income-statement` | Estado de resultados, distribución y gastos fijos |
| `/dashboard` | Métricas |
| `/users`, `/roles`, `/permissions` | Administración de acceso |
| `/preferences` | Preferencias del sistema (`GET /general` es público y de solo lectura) |
| `/notifications` | Notificaciones del usuario autenticado |

Además, `GET /health` (fuera de `/api`) responde el estado del servidor.

---

## Seguridad

- **Sesión:** JWT en cookie HttpOnly (8 h; `Secure` en producción). En cada petición se vuelve a leer al usuario, su rol y sus permisos de la BD, así que un cambio de permisos aplica de inmediato. El claim `tv` (versión de token) permite revocar sesiones: `logout` y el cambio de contraseña invalidan los tokens anteriores.
- **CSRF:** `tiny-csrf`; el frontend pide el token en `GET /api/auth/csrf` antes de cada mutación.
- **Permisos:** RBAC granular (`recurso.accion`). Los services repiten la verificación como segunda capa y agregan reglas contextuales (dueño del pedido, roles del sistema, no otorgar permisos que el usuario no tiene).
- **Rate limiting:** login 5 intentos por IP + correo cada 15 min; cambio de contraseña 3 por usuario cada 15 min.
- **Contraseñas:** bcrypt con 12 rondas.
- **Cabeceras y CORS:** Helmet y lista blanca de orígenes (`CORS_ORIGINS`).
- **Subidas:** solo JPEG, PNG o WebP de hasta 5 MB.

---

## Base de datos y migraciones

- `prisma/schema.prisma` es la fuente de verdad. Después de modificarlo: `npx prisma validate` y `npm run prisma:generate`.
- Algunos índices viven solo en SQL porque Prisma no puede declararlos (índices parciales o de expresión); están documentados como comentarios en el esquema.

> ⚠️ **`.env.development` y `.env.production` apuntan a bases de datos reales (Supabase).**
> - Contra Supabase solo se usa `npm run prisma:migrate:deploy`.
> - `prisma migrate dev` detecta cualquier drift y propone un reset; además, al cambiar el tipo de una columna genera `DROP COLUMN` + `ADD COLUMN` y **pierde los datos**.
> - `prisma migrate reset` **borra toda la base de datos**. Úsalo solo en el procedimiento de limpieza descrito abajo.

### Crear una migración

1. Modifica `schema.prisma`.
2. Genera o escribe el SQL en una carpeta nueva de `prisma/migrations/` (`AAAAMMDDhhmmss_descripcion/migration.sql`).
   - Cambios de tipo o de datos: **escríbelos a mano** con `ALTER COLUMN … TYPE … USING …` y envuélvelos en `BEGIN; … COMMIT;`, porque Prisma no ejecuta el script dentro de una transacción.
   - Si necesitas `migrate dev`, ejecútalo **solo contra Docker**: con la BD de pruebas levantada, fuerza `DATABASE_URL` y `DIRECT_URL` a `localhost:55432`. No confíes en `--config`, que puede ignorarse y caer en `.env.development`.
3. Ensaya en Docker: `npm run test:db:down && npm run test:db:up && npm run test:db:prepare` y comprueba que `npx prisma migrate diff --from-url <url de docker> --to-schema-datamodel prisma/schema.prisma` quede vacío.
4. `npm run test:critical`.
5. Aplica primero en desarrollo (`npm run prisma:migrate:deploy`) y después en producción (`npm run prisma:migrate:deploy:prod`). En producción, **despliega el código y la migración juntos, con el backend detenido.** Un backend con el cliente de Prisma nuevo contra una BD sin migrar falla en cada escritura.

---

## Seed y catálogo

`prisma/seed.ts` es idempotente y se puede ejecutar varias veces:

1. Roles `ADMIN` y `CAJERO`, permisos y su asignación. Solo agrega; nunca quita permisos personalizados.
2. Usuario `admin@andyscoffee.local`. La contraseña solo se fija al crearlo (`ADMIN_SEED_PASSWORD`).
3. **Catálogo:**
   - Si existe `prisma/seed-data/catalog.json`, lo carga ([`seed-catalog.ts`](prisma/seed-catalog.ts)): unidades, categorías, productos, ingredientes, recetas, extras, combos, promociones, proveedores y preferencias. Cada ingrediente nuevo entra con su stock como un movimiento de "saldo inicial"; al volver a ejecutarlo nunca sobrescribe el stock vivo.
   - Si no existe, carga el catálogo de ejemplo (lo usa la BD de pruebas).
4. Preferencias de distribución del estado de resultados (sin pisar valores configurados).

### Limpiar la BD de producción conservando el catálogo

Borra ventas, cajas, gastos, compras, movimientos, conteos, notificaciones y usuarios. Conserva el catálogo, los ingredientes con su stock, los proveedores y las preferencias.

1. Detener el backend; no debe haber caja abierta.
2. `npm run catalog:export:prod` y revisar `prisma/seed-data/catalog.json`.
3. Respaldo completo desde Supabase (Dashboard → Database → Backups).
4. `npx cross-env NODE_ENV=production prisma migrate reset`: borra el esquema de la BD de `.env.production`, aplica todas las migraciones y ejecuta el seed con el catálogo exportado.
5. Levantar el backend y volver a crear los usuarios (solo queda `admin@andyscoffee.local`).

---

## Jobs programados

| Job | Frecuencia | Qué hace |
| --- | ---------- | -------- |
| `cashAutoClose` | Cada 15 min (zona `CASH_TIMEZONE`) | Si pasó la hora de cierre configurada y la caja sigue abierta, la cierra con el monto esperado marcado como "sin conteo"; un admin debe corregir el corte con el conteo real |
| `cashReconciliation` | Diario, 23:30 | Comprueba que los movimientos de cada sesión cerrada sumen su `expectedAmount` y notifica a los administradores si hay diferencias |

---

## Producción (Docker)

`npm run build` genera `dist/server.js` (esbuild) y la imagen de `Dockerfile` lo ejecuta con `node dist/server.js`: multi-stage, solo dependencias de producción, usuario no root, `HEALTHCHECK` en `/health`, sin `.env` ni datos. Despliegue en Render, variables y migraciones: [docs/deployment.md](../docs/deployment.md).

## Pruebas

| Tipo | Ubicación | BD |
| ---- | --------- | -- |
| Unitarias | `test/*.test.ts` | No usa |
| Integración | `test/integration/*.integration.test.ts` | Docker |
| E2E (Playwright) | `test/e2e/*.spec.ts` | Docker; levantan el backend en :4000 y Vite en :5173 |

```bash
npm run test:db:up        # genera certificados y levanta PostgreSQL 16 con TLS (puerto 55432)
npm run test:db:prepare   # migrate deploy + seed
npm run test:critical
npm run test:db:down      # borra el contenedor y sus datos
```

- `test/setup/test-env.ts` fija `NODE_ENV=test` y todas las variables (no se lee ningún `.env.*`) y **se niega a correr contra cualquier host que no sea localhost**. Los archivos nuevos de integración o E2E deben importarlo antes que cualquier cosa que use Prisma.
- Las E2E necesitan los puertos 4000 y 5173 libres. En Windows, si Vite falla con `EACCES` en el 5173, el rango está reservado por WinNAT; reiniciar el equipo (o `net stop winnat && net start winnat` como administrador) lo libera.
