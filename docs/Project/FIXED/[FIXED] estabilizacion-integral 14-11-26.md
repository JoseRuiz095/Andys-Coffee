# Auditoría integral y estabilización del sistema

| | |
|---|---|
| **Fecha de realización** | 14 de noviembre de 2026 |
| **Alcance** | Todo el sistema: exactitud de operaciones (ventas, caja, inventario, gastos, estado de resultados), integridad de datos, seguridad, pruebas y preparación del despliegue. El frontend ya había pasado por tres auditorías (general, Inventario y Administración), así que este trabajo se centró en el backend |
| **Decisiones del usuario** | **N‑1:** cancelar una venta ya entregada NO devuelve al cajón el mandadito absorbido. **N‑2:** el conteo físico aplica la diferencia medida al contar. **N‑3:** un gasto en efectivo sin caja abierta se rechaza. **N‑4:** nuevo permiso `settings.manage` para la configuración |
| **Restricciones** | Sin commits, sin ramas, sin tocar producción. Las migraciones de esquema no fueron necesarias: todo se resolvió sin migración |
| **Estado** | Fases 0–7 ejecutadas. Pendientes en §6 |

---

## 1. Diagnóstico (resumen)

La base era sólida:
- precio calculado en el servidor;
- dinero en `Decimal`;
- idempotencia por índices únicos;
- transacciones Serializable en los flujos de dinero;
- 137 rutas que respetan `requireAuth → checkPermission → validate`.

Los riesgos estaban acotados y eran concretos:

| Área | Riesgo principal encontrado |
|---|---|
| Despliegue | El árbol de trabajo depende de dos migraciones (`20261111*`) aplicadas solo en desarrollo. El contenedor no migra y `/health` no revisaba el esquema: desplegar primero dejaba el menú, el POS y las órdenes en 500 |
| Scripts | `prisma migrate reset` pasaba el bloqueo con `NODE_ENV=production`. El seed borraba todas las promociones y sobrescribía precios. El reset operativo vaciaba tablas sin revisar a qué BD apuntaba |
| Caja | El cierre automático comparaba solo la hora: con cierre a `00:00`/`01:30` cerraba cualquier caja a los 15 minutos de abrirla; con `22:30`, a las 22:00 |
| Estado de resultados | Hallazgo nuevo **IS‑0**: la foto congelada de cada día se guardaba con la clave del día anterior, así que nunca se reutilizaba para su propio día y la vista de semana o mes podía mostrar los números del día siguiente. Además, fotos congeladas con el filtro de una sola caja, invalidación sin cascada a los días siguientes, y "Editar saldos" que siempre fallaba |
| Movimientos de caja | Editar el gasto de un mandadito y luego cancelar la venta descuadraba el cajón. Una venta entregada devolvía al cajón un mandadito ya pagado. Un gasto en efectivo sin caja abierta no salía de ninguna caja |
| Seguridad | Un no‑admin con `users.update` podía degradar o desactivar a un ADMIN. `users.update` controlaba también la configuración financiera. Había dependencias con vulnerabilidad crítica (`proxy-addr`) y altas |
| Idempotencia | Una clave reutilizada con otro carrito devolvía la venta anterior con 201, y la nueva nunca se registraba |

## 2. Correcciones realizadas

### Fase 0 — Línea base
Antes de tocar código, todo en verde: 148 unitarias, 117 de integración, 35 E2E, Vitest 95.

### Fase 1 — Críticos (P0)

| ID | Corrección | Archivos | Prueba |
|---|---|---|---|
| S‑1 | `migrate reset`, `migrate dev` y `db push` bloqueados en producción sin excepciones | `backend/prisma.config.ts` | `test/production-guards.test.ts` |
| S‑2 | En producción, el seed omite el catálogo (precios y promociones) salvo `SEED_CATALOG=true`; roles, permisos, admin y preferencias siguen siendo upserts | `prisma/seed.ts`, `prisma/seed-guards.ts` | ídem |
| S‑3 | El reset operativo contra producción (o con un `.env` que apunta a ella) exige `--confirm-host=<host>` | `scripts/reset-operational-data.ts`, `prisma/seed-guards.ts` | ídem |
| F1 | El cierre automático usa hora y minutos en `CASH_TIMEZONE`, a partir de cuándo se abrió **esa** sesión (cubre el cierre después de medianoche y las cajas abiertas fuera de horario), y registra el esperado dentro de la transacción de cierre | `services/cash.service.ts`, `utils/businessDate.ts` (`getBusinessDayEndAfter`) | `test/businessDate.test.ts`, `integration/cash-session` |
| IS‑0 | La clave de cada foto es su fecha UTC (columna `DATE`), no la fecha convertida a zona horaria | `services/income-statement.service.ts` | `integration/income-statement-snapshots` |
| IS‑1 | Con filtro de caja no se leen ni se guardan fotos globales (también en el detalle del día) | ídem | ídem |
| IS‑2 | Invalidar un día invalida también todas las fotos finales posteriores (los acumulados dependen de él) | `repositories/income-statement.repository.ts` | ídem |
| D1 | `GET /ready`: responde 503 si la BD no tiene la última migración que exige el código. Al arrancar se registra un error si el esquema está atrasado. Un test obliga a mantener la constante al día | `src/config/migrations.ts`, `repositories/schema.repository.ts`, `services/readiness.service.ts`, `app.ts`, `server.ts` | `test/migrations-sync.test.ts`, `integration/readiness` |
| SEC‑DEP | `npm audit fix` (sin `--force`). Backend: corregidas la crítica `proxy-addr` y las altas de ejecución `multer`, `body-parser`, `zod` y `qs`. Frontend: `zod` 4.6.7, 0 vulnerabilidades | `package.json`, lockfiles | suites completas |

### Fase 2 — Estabilidad funcional (P1)

| ID | Corrección | Archivos |
|---|---|---|
| F2 | El gasto automático de un mandadito no se edita ni se borra por separado (409). Al cancelar la venta se revierte el **neto** de todos sus movimientos de caja | `order.service.ts`, `expense.service.ts`, `cash.repository.ts` (`findMovementsByReference`) |
| N‑1 | Una venta `completed` con mandadito absorbido conserva su gasto y no devuelve ese dinero al cajón | `order.service.ts` |
| F3 | Una clave de idempotencia repetida solo se acepta si el carrito es el mismo (productos con tamaño y cantidad, extras, combos, método de pago); si no, 409 | `utils/idempotentOrderMatch.ts`, `order.service.ts` |
| F4 | La cancelación vuelve a leer la orden dentro de su transacción (antes, un mandadito entregado justo antes podía revertirse dos veces) | `order.service.ts`, `order.repository.ts` |
| F5 | Reabrir solo el corte más reciente de la caja y solo sin otra caja abierta | `cash.service.ts`, `cash.repository.ts` |
| IS‑3 | La corrección de saldos acumulados de hoy se guarda como fila no final. La secuencia la usa, la conserva ante gastos o ventas del día y la congela al cerrar el día | `income-statement.service.ts`, `income-statement.repository.ts` |
| EX‑1 (N‑3) | Gasto en efectivo sin caja abierta → 409 con mensaje. Pasar un gasto a efectivo sin caja abierta, igual | `expense.service.ts` |
| INV‑1/2 (N‑2) | Al aplicar un conteo se usa la diferencia medida al contar; al recapturar un insumo se actualiza también el stock de referencia | `inventory-count.service.ts`, `inventory-count.repository.ts` |
| A1 | Editar, activar o desactivar o borrar un usuario, o renombrar, borrar o cambiar permisos de un rol, exige tener todos los permisos de su rol actual | `user.service.ts`, `role.service.ts` |
| A2 (N‑4) | Permiso `settings.manage` (seed) en lugar de `users.update` para distribución, gastos fijos, saldos acumulados, preferencias generales e inventario | `config/permissions.ts`, rutas de `income-statement`, `inventory` y `preferences`, `preference.service.ts`, `inventory-settings.service.ts`, `prisma/seed.ts` |
| IS‑4 | Una compra se imputa al día en que se **recibe** (antes, al del borrador) | `purchase.service.ts`, `purchase.repository.ts` |
| INV‑4 | Un borrador solo se borra si sigue en borrador (`deleteMany` condicionado) | ídem |

Pruebas: `integration/stabilization-p1.integration.test.ts` (8 casos, uno por hallazgo) e `idempotent-order-match.test.ts`.

### Fase 3 — Integridad y validación (P2)

| ID | Corrección |
|---|---|
| F7 | Los extras se piden en unidades enteras (`.int()`), así el total no queda con más de 2 decimales |
| F9 | La invalidación de fotos después del commit es *best effort* con log (`services/snapshot-invalidation.ts`), en lugar de responder 500 por una operación que ya se hizo |
| EX‑2 | Un gasto en efectivo lleva la fecha del día de la caja de la que sale el dinero |
| INV‑6 | Una salida puede dejar el stock en negativo (decisión D‑1); la confirmación del frontend lo avisa |
| INV‑8 | No se compran insumos inactivos o eliminados |
| INV‑3 | El filtro por fecha de los conteos usa el día local |
| V1–V4 | Producto (precio, costo, longitudes), salida (cantidad numérica), compra (cantidad y costo acotados para que el total quepa en `Decimal(14,2)`), saldos acumulados: valores finitos y acotados (antes, desbordes o NaN → 500) |
| R3 | `GET /categories` (público): paginación validada (una página negativa daba 500); `?includeInactive=true` exige sesión y `categories.update` |

Pruebas: `test/stabilization-validators.test.ts` e `integration/stabilization-p2.integration.test.ts`.

### Fase 4 — Frontend

- **F8:** si se pierde la respuesta al cobrar (timeout o red), la clave de la venta se fija aunque cambie el carrito. Si la venta ya existía, el servidor responde 409 y la pantalla avisa que se revise Órdenes antes de volver a cobrar. Archivos: `useSaleAttemptKey.ts`, `DashboardPage.tsx`, más su test.
- **Gating de permisos:**
  - `settings.manage` reemplaza a `users.update` en Configuración, saldos acumulados, ajustes de inventario y el enlace a finanzas;
  - nueva etiqueta "Cambiar la configuración";
  - "Usuarios y roles".
- **A1 en la interfaz:** no se ofrecen acciones sobre usuarios o roles con permisos que el actor no tiene, y se explica el motivo.
- **Gastos:** el gasto de un mandadito se muestra como "De una venta", sin Editar ni Eliminar.
- **Salidas:** se permite dejar el stock en negativo, con aviso en la confirmación.

### Fase 5 — Deuda (P3)

- **E2:** Pino redacta cookies, `authorization`, contraseñas, tokens y los headers o datos de errores de Axios.
- **C1:** cierre ordenado con SIGTERM/SIGINT: deja de aceptar peticiones, detiene los crons y cierra el pool (máximo 10 s).
- **R1:** `route-policy` revisa `/api/product-families` y además falla si un router montado en `app.ts` no está en su lista.
- **R4:**
  - el aviso de gastos fijos pasó de `expense.controller` a `ExpenseService.fixedExpenseOverlapWarning` (corrige además su comparación accidental);
  - la revocación del token en logout pasó a `auth.service.revokeSessionsOfToken`.
- **P1:** `@prisma/adapter-pg` alineado a `^6.19.3`.

### Fase 7 — Producción

- **Nuevo documento:** `docs/Project/deployment.md`, con la arquitectura, las variables, `TRUST_PROXY`, `/health` frente a `/ready`, el orden obligatorio de despliegue (respaldo → normalización → migraciones → seed de permisos → imagen → smoke test → limpieza única de fotos), los scripts protegidos y el rollback.
- **CI:**
  - frontend: `npm audit --omit=dev --audit-level=high`;
  - backend: `--audit-level=critical`.
- **Encabezados de seguridad** en los dos `vercel.json`.
- **Referencias actualizadas:** `.env.example`, `Dockerfile` y `Readme.md`.

## 3. Pruebas ejecutadas (resultados finales)

| Suite | Antes | Después |
|---|---|---|
| Backend unitarias | 148/148 | **162/162** |
| Backend integración (Docker) | 117/117 | **135/135** |
| E2E Playwright (`--workers=1`, puertos 4100/5273) | 35/35 | **35/35** |
| Frontend Vitest | 95/95 | **97/97** |
| Frontend lint, typecheck, build | ✅ | ✅ |
| Backend lint, typecheck | ✅ | ✅ |
| `npm audit --omit=dev` | backend 12 (1 crítica), frontend 2 altas | backend 5 (3 altas de la CLI de Prisma + 2 moderadas, sin críticas); frontend **0** |

**Pruebas existentes que se modificaron (con su justificación en el propio test):**
- `inventory-flows`:
  - "conteo: si el stock cambia…" ahora espera la diferencia medida al contar (decisión N‑2);
  - "salida manual" ya no espera el rechazo por stock insuficiente (decisión D‑1/INV‑6).
- `income-statement` "un día con una sesión todavía abierta…": invalida la foto después de mover una sesión directo en la BD, como hacen los flujos reales. Antes pasaba solo por el bug IS‑0.
- `user-delete-protection`: el actor que borra usuarios ADMIN ahora tiene los permisos de ADMIN (regla A1).
- `preference-reserved`, `admin.e2e`, `inventory.e2e`: usan `settings.manage`.

## 4. Inventario y estado funcional final

| Módulo | Estado |
|---|---|
| POS y ventas (precio, extras, combos, 2x1, programadas, pago pendiente) | ✅ funcional y probado |
| Cobros pendientes y mandaditos | ✅ |
| Cancelación y aprobación | ✅ |
| Tablero de órdenes | ✅ |
| Caja (abrir, cerrar, corregir, reabrir, cierre automático) | ✅ |
| Inventario (existencias, compras, salidas, conteos, recetas) | ✅ |
| Inventario en tiempo real | ⚠️ código listo y probado; **producción pendiente** (Fase 9 del plan del 11/11; `consumeOnSale` apagado) |
| Gastos | ✅ |
| Estado de resultados | ✅ (en producción conviene una limpieza única de fotos, ver §6) |
| Usuarios, roles y permisos | ✅ |
| Preferencias, notificaciones, dashboard | ✅ |
| Scripts y seed | ✅ protegidos |

## 5. Incidente durante la ejecución

`npm run test:db:prepare` (`backend/test/db/prepare.ts`), en Windows, **cierra todos los procesos `node.exe` de la máquina**. Al ejecutarlo para registrar el permiso nuevo en la BD de pruebas, se detuvieron los servidores de desarrollo del usuario (4000/5173), y el propio script se cerró antes de sembrar. La BD de pruebas se preparó después con `prisma migrate deploy` + `tsx prisma/seed.ts` directamente. **Hay que volver a levantar los servidores de desarrollo.** Se recomienda limitar ese paso a los procesos que bloquean el motor de Prisma.

## 6. Pendientes y deuda restante

**Requieren autorización o una decisión:**
- **Despliegue a producción**, en el orden de `docs/Project/deployment.md`:
  - el rollout del inventario en tiempo real es prerrequisito;
  - el seed crea `settings.manage`;
  - los roles personalizados que configuraban el sistema necesitan ese permiso asignado.
- **Limpieza única de fotos finales en producción** (`DELETE … WHERE "isFinal" = true`): por IS‑0/IS‑1 pueden estar corridas o filtradas. Es un caché derivado, pero toca producción.
- **INV‑5:** precisión del costo por gramo (`Decimal(14,4)` → p. ej. `(18,8)`). Requiere una migración `ALTER COLUMN TYPE`; se presenta aparte y se ensaya en Docker.
- **Prisma 7 y `node-cron` 4** (versiones mayores) para cerrar las vulnerabilidades restantes de la CLI y de `uuid`.

**Deuda técnica sin autorización necesaria (P3):**
- **C2:** bloqueo en los cron jobs ante dos instancias simultáneas durante un deploy (hipótesis; hoy Render corre una sola instancia y el cierre ordenado reduce la ventana).
- **C3/C5:**
  - confirmar en Vercel qué `vercel.json` usa cada proyecto;
  - dejar un solo disparador de deploy en Render.
- **A3:** límite de login también por correo (hoy por IP+correo, en memoria).
- **R5:** envolturas de respuesta distintas entre módulos. No se cambiaron, para no romper contratos.
- **Frontend:** extraer `ProductFormModal` y ARIA de combobox (de auditorías previas).
- **`test:db:prepare`:** no cerrar todos los procesos `node.exe` (§5).

## 7. Estado final de estabilidad

**Cubierto por pruebas:**
- No queda ningún hallazgo P0 o P1 abierto en el código.
- Todas las suites críticas pasan.
- El build de producción es correcto.
- La configuración de despliegue queda documentada.

**Lo que impide declararlo "listo para operar en producción" sin más:**
- el despliegue y la Fase 9 del inventario, que requieren aprobación;
- la limpieza única de fotos;
- la revisión manual del usuario en ambos temas y en tablet.
