# Auditoría integral MVP — Andy's Coffee

**Fecha:** 2026-09-22 · **Rama:** `test/general-testing` · **Alcance:** Fases 0-5 de [plan-test.md](plan-test.md)
**Modo:** solo diagnóstico. No se modificó código de la aplicación ni se hizo ninguna operación git.

---

## 0. Línea base (Fase 0)

| Chequeo | Resultado |
| --- | --- |
| `npx prisma validate` | ✅ Schema válido |
| `npx prisma migrate status` | ⚠️ **1 migración sin aplicar**: `20260921120000_remove_unused_models` (la BD remota de Supabase aún tiene las tablas Ticket/Promotion*/PurchaseInvoiceCounter) |
| Backend `npx tsc --noEmit` | ⚠️ `src/` compila; fallan 3 errores en `test/` (`vitest` y `supertest` no instalados) |
| Frontend `npm run build` | ✅ Compila. Aviso: bundle único de 1.77 MB (458 KB gzip) |
| Frontend `npm run lint` | ❌ **73 errores, 1 warning** (60 `no-explicit-any`, 6 `set-state-in-effect`, 3 `no-unused-vars`, 2 `react-hooks/refs`, 1 `exhaustive-deps`, 1 `only-export-components`) |
| Backend lint | N/A — el backend no tiene script ni configuración de lint |
| Backend `npm run test:unit` | ❌ **41/45 pasan, 4 fallan** (ver TD-08) |

### Mapa técnico real

```text
React 19 + Vite (SPA, router propio basado en window.history — NO React Router)
   │  axios `apiClient` en frontend/src/app/api.ts (baseURL /api, withCredentials, CSRF por header X-CSRF-TOKEN)
   ▼
Express 5 (app.ts): X-Request-ID → CORS whitelist → json/urlencoded → cookieParser → tiny-csrf → routes → errorHandler
   │  requireAuth (JWT de cookie `token` o Bearer; re-lee usuario+permisos de BD en cada request)
   │  checkPermission (solo en algunas rutas; muchos módulos validan el permiso dentro del service)
   ▼
Controllers → Services → Repositories → Prisma (adapter-pg, SSL obligatorio) → PostgreSQL (Supabase)
   └─ Jobs node-cron: cashAutoClose (cada 15 min), cashReconciliation (23:30)
   └─ UploadService → Supabase Storage (bucket `Img`, anon key)
```

### Desviaciones respecto a la arquitectura/documentación esperada

| Documentado (CLAUDE.md) | Realidad |
| --- | --- |
| Services nunca llaman Prisma | `order.service.ts` (67 usos), `expense.service.ts` (13), `cash.service.ts`, `auth.service.ts`, `menu.service.ts`, `jobs/cashReconciliation.job.ts` usan `prisma`/`tx` directamente |
| Orden de middleware `requireAuth → checkPermission → validate → controller` | Solo cash, expenses, dashboard y parte de roles/users lo siguen. Orders, inventory, purchases, suppliers, inventory-counts validan permisos en el service y parsean Zod en el controller |
| React Router, `shared/api/`, `shared/hooks/`, `shared/store/`, `ProtectedRoute` | Router propio en `app/router.tsx`; API en `app/api.ts` + `features/*/api`; store en `features/auth/store`; no existe `ProtectedRoute` |
| Comandos `npm run dev:backend` desde raíz | No hay `package.json` en la raíz |
| `.env.example` en backend | No existe |
| Login devuelve `{ user, token }` | Devuelve solo `{ user }` (el token va en cookie HttpOnly) — mejor que lo documentado |
| Errores `{ error, statusCode, details? }` | La mayoría responde `{ message }`; rate-limit y login-Zod responden `{ error, statusCode }` |
| `todo.md`: auto-cierre 14:00, migraciones aplicadas | Auto-cierre usa `businessHoursClose` (22:00 por defecto); hay 1 migración pendiente |

---

## 1. Problemas encontrados

Severidades según el plan: CRITICAL (datos/finanzas/acceso), HIGH, MEDIUM, LOW. Categoría: **Bug** o **Vulnerabilidad** (la deuda técnica y el código muerto van en sus propias secciones).

| ID | Área | Categoría | Problema | Severidad | Evidencia | Recomendación |
| -- | ---- | --------- | -------- | --------- | --------- | ------------- |
| C-01 | Gastos / Estado de resultados | Bug | Todo gasto con `expenseDate` explícito se guarda a las `12:00Z` = **06:00 en America/Mexico_City**, antes de la apertura (09:00 por defecto). El estado de resultados descarta los gastos fuera de horario, así que **desaparecen del P&L**. El formulario de edición siempre reenvía la fecha, por lo que **cualquier gasto editado también desaparece**. | CRITICAL | `backend/src/services/expense.service.ts:60,205`; filtro en `income-statement.service.ts:194-205`; `frontend/src/features/expenses/components/ExpenseFormModal.tsx:20,46` | Guardar la fecha usando la zona del negocio (p.ej. mediodía local, o conservar la hora original al editar) y no reescribir la hora si solo cambia otro campo |
| C-02 | Ventas / Caja / Estado de resultados | Bug | Cancelar una orden de una sesión de caja **ya cerrada** inserta movimientos de reversa en esa sesión y modifica su `expectedAmount`, dejando `difference` guardado inconsistente con el corte. Además `updateStatus` **no invalida el snapshot** del estado de resultados, así que un día ya finalizado conserva el ingreso de una venta cancelada. Es alcanzable desde la UI: "Pedidos del día" permite cancelar pedidos de cualquier fecha. | CRITICAL | `order.service.ts:137-241` (sin guarda de `cashSession.status`, sin `invalidateSnapshot`); gastos sí tienen la guarda en `expense.service.ts:121,228`; UI `DailyOrderDetailDrawer.tsx:74` | Aplicar la misma regla que gastos (bloquear o registrar la reversa en la sesión abierta actual) e invalidar el snapshot del día de la orden |
| H-01 | Ventas / Seguridad | Vulnerabilidad | `POST /api/orders` no exige `sales.create`: ni la ruta ni `OrderService.create` (que solo recibe `userId`) comprueban el permiso. Cualquier usuario autenticado (p.ej. un rol solo de inventario) puede registrar ventas y movimientos de caja. | HIGH | `routes/order.routes.ts:67-72`; `services/order.service.ts:272` | Añadir `checkPermission('sales.create')` en la ruta (y en las demás rutas de orders para uniformidad) |
| H-02 | Ventas / Caja | Bug | `settlePayment` y `handoffDelivery` validan el estado **fuera** de la transacción, y la transacción usa el aislamiento por defecto (READ COMMITTED) con un `update` sin condición de estado. Dos requests concurrentes (doble clic, reintento) crean **dos movimientos de caja** y duplican el efectivo esperado. | HIGH | `order.service.ts:701-746` (settle), `771-821` (handoff) | `updateMany` condicionado a `status: 'pending'` / `deliveryHandedOff: false` y verificar `count === 1`, o usar Serializable como el resto del módulo |
| H-03 | Ventas / Pagos pendientes | Bug | Al cancelar una orden solo se cancelan los pagos `paid`; el pago `pending` queda vivo, sigue apareciendo en "Pagos pendientes" (no filtra por estado de la orden) y **se puede liquidar**, metiendo efectivo de una venta cancelada a la caja. | HIGH | `order.service.ts:181-184`, `685-693`, `696-710` | Cancelar también pagos `pending` y rechazar `settlePayment` si la orden está cancelada |
| H-04 | Estado de resultados | Bug | Solo cuentan como ingreso las órdenes `completed`. Si una orden se completa (o cancela) después de que su día quedó con snapshot final, el cambio **nunca se refleja** porque `updateStatus` no invalida el snapshot. Las órdenes que se quedan en `pending/preparing/ready` al cierre del día nunca cuentan como ingreso aunque el efectivo ya entró a caja. | HIGH | `income-statement.repository.ts:124-165`; `income-statement.service.ts:483-517`; `order.service.ts:95-270` | Invalidar el snapshot del día de la orden en cada cambio de estado y definir la regla de negocio para órdenes no completadas al cierre (ver R-02) |
| H-05 | Inventario | Bug | `PATCH /api/inventory/:id/active` exige en el service el permiso `inventory.update_ingredient`, que **no existe** en el seed. Nadie, ni ADMIN, puede activar/desactivar ingredientes (siempre 403). La ruta, en cambio, exige `inventory.create_ingredient`. | HIGH | `services/inventory.service.ts:248`; `routes/inventory.routes.ts:47-51`; `prisma/seed.ts:575-583` | Usar `inventory.create_ingredient` en el service (o crear el permiso en el seed) |
| H-06 | Auth / Seguridad | Vulnerabilidad | El rate limit de login usa como clave el header `X-Forwarded-For` tal cual lo manda el cliente. Rotando ese header se evita el límite de 5 intentos y se puede hacer fuerza bruta. `trust proxy` no está configurado. | HIGH | `middleware/rate-limit.middleware.ts:3-5,13-18` | Usar `req.ip` con `app.set('trust proxy', <n saltos reales>)` |
| M-01 | Catálogo / Seguridad | Vulnerabilidad | `GET /api/products` y `GET /api/products/:id` son públicos y devuelven `cost`, productos inactivos y, en el detalle, **recetas con el ingrediente completo** (`averageCost`, `currentStock`, `sku`). Cualquiera sin sesión puede ver costos y márgenes. | MEDIUM | `routes/product.routes.ts:34-35`; `repositories/product.repository.ts:26-31` | Exigir `requireAuth` (el permiso `products.read` existe pero no se usa) o devolver un DTO público sin costos |
| M-02 | Caja / Seguridad | Vulnerabilidad | `POST /cash-register/sessions/:id/reopen` borra `closingAmount`/`difference` de cualquier sesión cerrada sin `AuditLog` ni validación Zod del `reason`, y basta con `cash.close` (el CAJERO lo tiene). Ninguna parte del frontend lo usa. | MEDIUM | `routes/cash.routes.ts:27-32`; `services/cash.service.ts:156-197` | Restringir a `cash.correct`, registrar el cierre anterior en `AuditLog`, validar el body; o eliminar el endpoint si no se usa |
| M-03 | Caja | Bug | El job de conciliación de las 23:30 suma el monto de todos los movimientos, incluido `CLOSING` (= monto contado), y mezcla convenciones de signo (`expense` positivo que descuenta, `expense_reversal` negativo que suma). Reporta **discrepancia en todas las sesiones cerradas** → notificaciones falsas a los admins. | MEDIUM | `jobs/cashReconciliation.job.ts:129-136`; `repositories/cash.repository.ts:66-73`; `order.service.ts:610-624` | Excluir `CLOSING` y aplicar el signo según `type` (o normalizar la convención de signos) |
| M-04 | Usuarios / Seguridad | Vulnerabilidad | `assignPermissions` impide otorgar permisos que el actor no tiene, pero `UserService.create/update` permite asignar **cualquier `roleId`**, incluido ADMIN. Un rol personalizado con `users.create`/`users.update` puede crear una cuenta ADMIN (escalamiento). | MEDIUM | `services/user.service.ts:44-73,75-111` | Rechazar la asignación de roles con permisos que el actor no posee (mismo criterio que `role.service.ts:122-138`) |
| M-05 | Seguridad HTTP | Vulnerabilidad | Sin cabeceras de seguridad (`helmet`, CSP, `X-Content-Type-Options`, HSTS) y Express expone `X-Powered-By`. | MEDIUM | `backend/src/app.ts` (ausencia) | Añadir `helmet()` y `app.disable('x-powered-by')` |
| M-06 | Auth / Seguridad | Vulnerabilidad | El JWT (8 h) no se revoca: tras logout o cambio de contraseña, un token robado sigue siendo válido hasta que expira. (Desactivar usuario y cambiar rol sí aplican de inmediato.) | MEDIUM | `controllers/auth.controller.ts:49-59`; `middleware/auth.middleware.ts:37-63` | Campo `tokenVersion`/`passwordChangedAt` en `User` comparado contra `iat` |
| M-07 | Gastos / Estado de resultados | Bug | Al editar un gasto solo se invalida el snapshot de la **nueva** fecha (el comentario dice "old and new"); si cambia la fecha, el día anterior queda con un snapshot final incorrecto. | MEDIUM | `services/expense.service.ts:212-216` | Invalidar también `existing.expenseDate` |
| M-08 | Frontend / Caché | Bug | Las mutaciones que mueven caja no invalidan la sesión activa ni el estado de resultados: cancelar orden (`useOrders`, `useDailyOrders`), liquidar pago, entregar mandadito y crear/editar/eliminar gasto. El "efectivo esperado" y el P&L en pantalla quedan desactualizados hasta un refetch. | MEDIUM | `features/orders/hooks/useOrders.ts:24`; `daily-orders/hooks/useDailyOrders.ts:21`; `pending-payments/hooks/usePendingPayments.ts:21`; `deliveries/hooks/useDeliveries.ts:20`; `expenses/hooks/useExpenses.ts:17-44` | Invalidar `['cash-session','active']`, `income-statement`, `pending-payments`, `dashboard`, `inventory` según el caso |
| M-09 | Base de datos | Bug | La migración `20260921120000_remove_unused_models` no está aplicada en la BD. El código ya no usa esos modelos, pero hay drift y el siguiente `migrate deploy` borrará tablas. | MEDIUM | `npx prisma migrate status` | Revisar que las tablas estén vacías y aplicar la migración de forma controlada |
| M-10 | Seed / Seguridad | Vulnerabilidad | Re-ejecutar el seed **resetea la contraseña del admin** (`upsert.update.passwordHash`) y, si falta `ADMIN_SEED_PASSWORD`, la deja en `CambiarEstaPassword123!`. También borra los permisos personalizados de ADMIN/CAJERO. | MEDIUM | `prisma/seed.ts:630-660` | No tocar `passwordHash` en `update`; exigir `ADMIN_SEED_PASSWORD` fuera de desarrollo |
| M-11 | Caja / Frontend | Bug | El historial de cortes y la corrección de cierre (`cash.correct`) no tienen UI accesible: `CashSessionHistory.tsx` no está montado en ninguna página. | MEDIUM | `frontend/src/features/dashboard/components/CashSessionHistory.tsx` (sin importadores) | Montarlo en Configuración/Dashboard o documentar que se retiró |
| L-01 | Auth | Vulnerabilidad | Enumeración de usuarios por tiempo de respuesta: si el email no existe no se ejecuta `bcrypt.compare`. | LOW | `services/auth.service.ts:27-34` | Comparar contra un hash ficticio cuando no hay usuario |
| L-02 | API | Bug | Tres formatos de error: `{message}` (errorHandler), `{message, errors: <string>}` (`validate.ts`), `{error, statusCode}` (rate-limit, login). El frontend lee `response.data.message`, así que el mensaje 429 de rate-limit **no se muestra**. | LOW | `middleware/rate-limit.middleware.ts:23-28,48-53`; `middleware/validate.ts:10-13`; `auth.controller.ts:38-44` | Unificar en `{ message, details? }` |
| L-03 | Errores | Bug | `ConflictError` y `DuplicateError` no están mapeados en el `errorHandler` global; dependen de try/catch en cada controller. Cualquier ruta que no los capture devuelve 500. | LOW | `middleware/errorHandler.ts`; `utils/errors.ts:29-46` | Mapearlos en el handler central (409) |
| L-04 | Caja / Gastos | Bug | Los filtros de fecha del historial de caja y de gastos usan límites UTC (`T00:00Z`–`T23:59Z`) en vez de la zona del negocio; los registros de 18:00–23:59 hora local caen en el día siguiente. | LOW | `repositories/cash.repository.ts:165-168`; `services/expense.service.ts:12-17` | Usar `getZonedDayBoundaries` |
| L-05 | Ventas | Bug | Combos: `unitPrice = precio/nItems` pero `quantity = cantidadItem×cantidad`, así que `unitPrice×quantity ≠ subtotal`; además el reparto a `Decimal(12,2)` puede perder centavos frente a `order.subtotal` (p.ej. 100/3). | LOW | `order.service.ts:447-458` | Repartir con residuo en el último item y guardar `unitPrice = subtotal/quantity` |
| L-06 | Ventas / Costos | Bug | `OrderItemExtra.costSnapshot` guarda el costo **unitario**, mientras `OrderItem.costSnapshot` guarda el costo **total**; el COGS del estado de resultados ignora los extras. Solo es informativo (COGS no resta de la utilidad, por decisión documentada). | LOW | `order.service.ts:426,439`; `income-statement.repository.ts:149-165` | Guardar `extra.cost × quantity` e incluir extras en COGS |
| L-07 | Ventas / Promociones | Bug | `todayDate = new Date('YYYY-MM-DD 00:00:00')` se interpreta en la zona del **servidor**; el filtro `endDate >= todayDate` puede excluir una promoción en su último día si el servidor no corre en UTC. | LOW | `order.service.ts:274-276,325-331`; `menu.service.ts:29` | Construir la fecha con `getZonedDayBoundaries` |
| L-08 | Config | Bug | `config/prisma.ts` usa `__dirname` (no existe en ESM, `"type": "module"`) como ruta por defecto del CA; solo funciona porque `DATABASE_SSL_CA_PATH` está definido. | LOW | `config/prisma.ts:34-36` | Usar `import.meta.url` o hacer obligatoria la variable |
| L-09 | Ventas | Bug | Si la notificación posterior al commit falla, `POST /orders` responde 500 aunque la venta se guardó (el reintento con la misma idempotency key lo recupera). | LOW | `order.service.ts:646-660` | Envolver el envío en try/catch + log |
| L-10 | Inventario | Bug | Aplicar un conteo con una diferencia negativa mayor que el stock actual (por ventas posteriores al conteo) viola el CHECK `currentStock >= 0` y termina en 500 genérico. | LOW | `inventory-count.service.ts:178-183`; migración `add_data_integrity_constraints` | Validar antes de actualizar y devolver 409 con mensaje claro |
| L-11 | Frontend | Bug | `APP_ROUTES` define `/menu`, `/orders`, `/inventory`, pero el router solo pinta `/login`, `/dashboard` y `/settings`; entrar a esas URLs deja la pantalla en blanco. | LOW | `shared/constants/routes.ts`; `app/router.tsx:103-150` | Redirigir rutas desconocidas a `/dashboard` |

---

## 2. Código muerto

No se eliminó nada. Clasificación según el plan.

| Archivo | Elemento | Evidencia | Confianza | Acción propuesta |
| ------- | -------- | --------- | --------- | ---------------- |
| `backend/src/repositories/inventory.repository.ts:512` | `updateAverageCost` | 0 referencias en `src/` y `test/` | CONFIRMADO | Eliminar |
| `backend/src/repositories/purchase.repository.ts:105` | `getPurchaseItems` | 0 referencias | CONFIRMADO | Eliminar |
| `backend/src/repositories/purchase.repository.ts:168` | `createPurchaseItems` | 0 referencias | CONFIRMADO | Eliminar |
| `backend/src/validators/purchase.validator.ts:32` | `updatePurchaseSchema` | Sin ruta PATCH de compras; solo lo usa un test | PROBABLEMENTE MUERTO | Eliminar junto con su test, o implementar la edición de compras |
| `backend/src/routes/cash.routes.ts:27` | `POST /sessions/:id/reopen` | Ningún consumidor en el frontend | REQUIERE VALIDACIÓN | Decidir si es una operación administrativa (ver M-02) |
| `backend/prisma/seed.ts:555,574` | Permisos `products.read`, `reports.read` | 0 comprobaciones en `backend/src` | REQUIERE VALIDACIÓN | Usarlos (M-01) o eliminarlos |
| `frontend/src/features/menu/pages/SalePage.tsx` | Página completa | Sin importadores ni ruta | CONFIRMADO | Eliminar |
| `frontend/src/features/dashboard/components/CashSessionHistory.tsx` (+ `useCashSessionHistory`, `useCorrectCashClosing`) | Historial y corrección de caja | Sin importadores | REQUIERE VALIDACIÓN | Es funcionalidad sin montar (M-11), no basura |
| `frontend/src/features/inventory/utils/duplicate-error.ts` | 3 helpers | Sin importadores (un comentario del backend lo cita como consumidor) | CONFIRMADO | Eliminar y corregir el comentario en `utils/controllerErrors.ts:5-8` |
| `frontend/src/components/ui/shield-check.tsx`, `user-round-check.tsx` | Iconos | Sin importadores | CONFIRMADO | Eliminar |
| `frontend/src/shared/assets/logo/LogoAndysVector.tsx` | Componente | Solo se usa el `.svg` homónimo | CONFIRMADO | Eliminar |
| `frontend/src/shared/constants/colors.ts` | Archivo vacío | Sin importadores | CONFIRMADO | Eliminar |
| `frontend/src/features/orders/mocks/` | Carpeta vacía | — | CONFIRMADO | Eliminar |
| `frontend/src/features/{expenses,products,roles,users}/index.ts` | Barrels | Nadie importa desde el barrel | PROBABLEMENTE MUERTO | Unificar criterio de imports |

---

## 3. Riesgos

| Riesgo | Área | Impacto | Probabilidad | Acción |
| ------ | ---- | ------- | ------------ | ------ |
| R-01 Las pruebas de integración corren contra la **BD remota de Supabase** del `.env` (no hay BD de test) | Testing | Alto (datos reales modificados) | Alta en Fase 7 | Crear una BD/esquema de pruebas dedicado antes de la Fase 7 |
| R-02 Regla "solo órdenes `completed` son ingreso" depende de que el personal avance cada pedido | Estado de resultados | Alto | Media | Definir la regla con negocio (¿`ready` al cierre = completada?) |
| R-03 Gastos y compras fuera del horario de negocio se excluyen del P&L por diseño; no aparecen en ningún otro reporte | Estado de resultados | Medio | Media | Validar con negocio; al menos mostrarlos como "fuera de horario" |
| R-04 `Product.cost` es manual y no se deriva de receta × `averageCost`; el `costSnapshot` puede alejarse del costo real de inventario | Costos | Medio | Alta | Decidir si el costo se calcula desde recetas |
| R-05 El bucket de Supabase se escribe con la **anon key**, así que su política debe permitir inserts anónimos; cualquiera con la anon key (pública por diseño) podría subir archivos | Storage | Medio | Baja-Media | Usar service-role key en el backend y restringir la política del bucket |
| R-06 Concurrencia: casi todo usa Serializable, pero varios flujos (H-02, lectura de la orden fuera de la transacción en `updateStatus`) dependen de conflictos implícitos | Ventas/Caja | Alto | Baja | Tests de concurrencia en Fase 7 |
| R-07 Dos fuentes de verdad de documentación desactualizadas (`CLAUDE.md`, `todo.md`) | Proceso | Bajo | Alta | Actualizadas parcialmente (ver cierre) |

---

## 4. Deuda técnica

| ID | Deuda | Evidencia |
| -- | ----- | --------- |
| TD-01 | Services con acceso directo a Prisma (viola la regla 4 de CLAUDE.md) | `order.service.ts` (67), `expense.service.ts` (13), `cash.service.ts`, `auth.service.ts`, `menu.service.ts`, `jobs/cashReconciliation.job.ts` |
| TD-02 | Autorización repartida: algunas rutas usan `checkPermission` y otras delegan en el service; la configuración y el estado de resultados se protegen con permisos `users.*` | `routes/{order,inventory,purchase,supplier,inventory-count}.routes.ts`; `preference.routes.ts`; `income-statement.routes.ts:28-32` |
| TD-03 | Controllers con try/catch repetitivo que mapea `error.name` a mano en lugar del handler central | `inventory.controller.ts` (14 bloques), `purchase.controller.ts`, `supplier.controller.ts`, `inventory-count.controller.ts`, `preference.controller.ts` |
| TD-04 | Validación Zod mezclada: middleware `validate()` en unas rutas, `schema.parse` en controllers en otras | routes vs controllers |
| TD-05 | Campos de estado como `String` con CHECK en la BD en lugar de enums (`Payment.status`, `CashMovement.type`, `deliveryResponsible`, `Expense.category`); `Expense.sourceOrderId` sin FK | `schema.prisma:391-523`; migraciones |
| TD-06 | Frontend: 73 errores de lint (60 `any`) | `npm run lint` |
| TD-07 | Frontend: bundle único de 1.77 MB, sin code splitting | `npm run build` |
| TD-08 | Infraestructura de tests inconsistente: `dashboard.test.ts` usa `vitest`/`supertest` (no instalados) con el runner `node:test`; `security.test.ts` usa `__dirname` en ESM (2 fallos); `purchase-validator.test.ts` espera rechazar `tax`, que ya no existe en el schema | `test/dashboard.test.ts:1`; `test/security.test.ts:28`; `test/purchase-validator.test.ts:36` |
| TD-09 | El backend no tiene ESLint | `backend/package.json` |
| TD-10 | Convención de signos inconsistente en `CashMovement.amount` según el tipo | `order.service.ts:168,196,222,614`; `expense.service.ts:149,169,238` |
| TD-11 | Sin `package.json` raíz ni `.env.example` | raíz del repo, `backend/` |

---

## 5. Matriz de cobertura funcional

Tests existentes: 12 archivos de integración (se omiten si falta `RUN_INTEGRATION_TESTS`), 2 E2E de seguridad, 11 unitarios.

| Módulo | Auditado | Riesgo | Tests necesarios (Fase 7) |
| ------ | -------- | ------ | ------------------------- |
| Auth | ✅ | Alto (H-06, M-06, L-01) | Rate limit con `X-Forwarded-For` falsificado, revocación de token, CSRF en todas las mutaciones |
| Usuarios | ✅ | Medio (M-04) | Asignación de rol con más permisos que el actor, último admin |
| Roles | ✅ | Bajo | Ya existe `sec-privilege-escalation`; añadir roles de sistema |
| Productos | ✅ | Medio (M-01) | Endpoints públicos sin campos de costo, validación de imagen |
| Inventario | ✅ | Alto (H-05, L-10) | Activar/desactivar ingrediente, conteo con stock cambiado, salidas vs stock |
| Ventas | ✅ | **Crítico** (C-02, H-01..H-04) | Permiso de creación, cancelación con sesión cerrada, pago pendiente cancelado, doble liquidación concurrente, combos/extras |
| Caja | ✅ | Alto (C-02, M-02, M-03) | Invariante `expectedAmount = Σ movimientos con signo`, reapertura, conciliación |
| Gastos | ✅ | **Crítico** (C-01, M-07) | Gasto con fecha explícita y editado aparece en el P&L; cambio de fecha invalida ambos días |
| Estado de resultados | ✅ | **Crítico** (C-01, C-02, H-04) | Snapshot se invalida en cancelar/completar/liquidar; horario de negocio; zona horaria |

---

## AUDITORÍA COMPLETADA

```text
Problemas encontrados:
Critical: 2   (C-01, C-02)
High:     6   (H-01 … H-06)
Medium:   11  (M-01 … M-11)
Low:      11  (L-01 … L-11)

Código muerto:
Confirmado: 9 elementos
Pendiente:  5 elementos (probablemente muerto / requiere validación)

Deuda técnica: 11 elementos (TD-01 … TD-11)

Riesgos: 7 (R-01 … R-07)

Correcciones realizadas: ninguna en código (fase de diagnóstico).
  Documentación: CLAUDE.md corregido en las desviaciones factuales de la Fase 0.

Build:     frontend ✅ | backend src ✅
Lint:      frontend ❌ 73 errores | backend sin lint configurado
Typecheck: backend ⚠️ falla solo en test/ (dependencias vitest/supertest) | frontend ✅ (tsc -b en el build)
Unit tests backend: 41/45 (4 fallos de infraestructura de tests, TD-08)
Prisma: validate ✅ | 1 migración pendiente en la BD (M-09)

¿Sistema listo para fase de testing?: NO
Motivo: 2 problemas CRITICAL sin resolver (C-01, C-02) y no hay BD de pruebas aislada (R-01).
```

**Siguiente paso propuesto (Fase 6):** corregir C-01, C-02 y H-01…H-06, luego los MEDIUM de dinero/seguridad (M-01…M-04, M-07, M-08), limpiar el código muerto confirmado y reparar la infraestructura de tests (TD-08). Queda pendiente de tu revisión antes de tocar código.

---

## Fase 6 — Correcciones aplicadas (2026-09-22)

Sin commits ni operaciones git. Verificación: backend `tsc --noEmit` ✅ (incluye `test/`), unit tests **56/56** ✅, frontend `npm run build` ✅, prueba de humo del servidor ✅ (cabeceras helmet, `GET /api/products` → 401 sin sesión, login → 429 al 6.º intento aun rotando `X-Forwarded-For`).

| ID | Estado | Cambio |
| -- | ------ | ------ |
| C-01 | ✅ Corregido | `expense.service.ts`: la fecha explícita se guarda a mitad del horario de negocio en `CASH_TIMEZONE` (hoy = hora actual); al editar solo se mueve si cambia el día. Nuevo helper `getZonedInstant` en `utils/businessDate.ts`. **Datos históricos:** revisado en Supabase el 2026-09-22: 0 gastos registrados, no hubo nada que corregir (el script `backend/scripts/fix-expense-dates-c01.sql` queda solo como referencia) |
| C-02 | ✅ Corregido | Las reversas de una venta de caja cerrada van a la sesión abierta actual (o se pide abrir caja); ya no se toca el corte cerrado. Se invalida el snapshot del día de la orden y del gasto de mandadito borrado |
| H-01 | ✅ | `checkPermission('sales.create')` en `POST /api/orders` |
| H-02 | ✅ | `settlePayment` y `handoffDelivery` usan `updateMany` condicionado + Serializable |
| H-03 | ✅ | Cancelar también cancela pagos `pending`; la lista excluye órdenes canceladas; no se puede liquidar un pago de orden cancelada |
| H-04 | ✅ | Completar/cancelar/liquidar invalidan el snapshot del día de la orden; el estado se re-verifica dentro de la transacción (R-06) |
| H-05 | ✅ | `setIngredientActive` usa `inventory.create_ingredient` |
| H-06 | ✅ | Rate limit con `req.ip` + `ipKeyGenerator`; nueva variable `TRUST_PROXY` (sin definir = no confiar en `X-Forwarded-For`) |
| M-01 | ✅ | `GET /api/products[/:id]` exigen sesión y `products.read` (el POS usa `/api/menu`) |
| M-02 | ✅ | Reapertura exige `cash.correct`, `reason` obligatorio (Zod) y deja `AuditLog` con el conteo descartado |
| M-03 | ✅ | Conciliación aplica el signo por tipo y excluye `CLOSING` |
| M-04 | ✅ | Crear/editar usuario rechaza roles con permisos que el actor no tiene |
| M-05 | ✅ | `helmet()` + `x-powered-by` desactivado |
| M-06 | ✅ Aplicado (2026-09-22) | Columna `users.tokenVersion` (migración `20260922200000_add_user_token_version`, aplicada en Supabase). El JWT lleva la versión (`tv`) y `requireAuth` rechaza versiones anteriores. Logout y cambio de contraseña incrementan la versión; el cambio de contraseña reemite la cookie del dispositivo actual. Test: `session-revocation.integration.test.ts` |
| M-07 | ✅ | Editar gasto invalida el día anterior y el nuevo |
| M-08 | ✅ | Nuevo `shared/utils/queryInvalidation.ts`; lo usan cancelar orden, liquidar pago, entregar mandadito, crear orden y gastos |
| M-09 | ✅ Aplicado (2026-09-22) | `prisma migrate deploy` en Supabase. Antes se respaldaron las 11 filas que existían (`PromotionOnCategory`: 1, `PromotionOnProduct`: 10; `tickets` y `purchase_invoice_counters` vacías) en `backend/prisma/backups/2026-09-22-remove_unused_models.json`. `migrate status`: al día; `GET /api/menu` responde 200 |
| M-10 | ✅ | El seed ya no resetea la contraseña del admin ni borra permisos personalizados; exige `ADMIN_SEED_PASSWORD` en producción |
| M-11 | ✅ | Pestaña "Cortes de caja" en Configuración (`cash.read`); botón "Corregir" solo con `cash.correct`; colores de tema |
| L-01 | ✅ | `bcrypt.compare` siempre se ejecuta (hash ficticio) |
| L-02 | ✅ | Todas las respuestas de error usan `message` (+ `errors` en validación). Se corrigieron **~110 respuestas** en 7 controllers que usaban `error`, cuyo texto el frontend nunca mostraba |
| L-03 | ✅ | `ConflictError`, `DuplicateError` y `P2004` mapeados en el handler global |
| L-04 | ✅ | Filtros de fecha de gastos e historial de caja usan días de negocio |
| L-08 | ✅ | `config/prisma.ts` y `test/security.test.ts` ya no usan `__dirname` |
| L-09 | ✅ | Falla de notificación tras crear la venta se registra en log sin devolver 500 |
| L-10 | 🟡 Parcial | La violación del CHECK ahora responde 409 en vez de 500; falta un mensaje específico |
| L-11 | ✅ | Rutas no renderizadas redirigen a `/dashboard` |
| L-05, L-06, L-07 | ⏸ Pendiente | Cambian cálculos de precios/costos guardados; conviene cubrirlos con tests primero (Fase 7) |
| TD-08 | ✅ | `dashboard.test.ts` migrado a `node:test` con expectativas por zona horaria; `purchase-validator` actualizado; se eliminó `test/integration/dashboard.integration.test.ts` (nunca se autenticaba y usaba un endpoint inexistente) — reescribir en Fase 7 |
| Código muerto | ✅ | Eliminados los 9 elementos CONFIRMADOS + carpeta `menu/pages` vacía |

**Hallazgo nuevo (R-08, requiere validación de negocio):** al cerrar sesión desde Configuración, el frontend cierra la caja con `closingAmount = expectedAmount`, es decir, siempre con diferencia 0 (`SettingsPage.tsx:38-59`). Cualquier faltante o sobrante queda oculto si el cajero sale sin hacer el corte.

### Estado para la Fase 7

```text
Critical abiertos: 0
High abiertos:     0
Medium abiertos:   2 (M-06, M-09 — requieren cambios en la BD remota)
Lint frontend:     71 problemas (deuda TD-06, preexistente)

¿Sistema listo para fase de testing?: SÍ, con una condición previa:
  crear una base de datos de pruebas aislada (R-01) antes de correr tests de integración.
```

---

## Fase 7 — Testing (2026-09-22)

### Base de datos de pruebas aislada (R-01 resuelto)

- `backend/test/db/docker-compose.yml`: PostgreSQL 16 en Docker (puerto 55432, datos en `tmpfs`), con TLS y un CA propio (`test/db/generate-certs.sh`), porque `config/prisma.ts` exige `verify-full` igual que en producción.
- `backend/test/setup/test-env.ts`: se carga con `--import` **antes** que cualquier módulo, fija el entorno de pruebas por encima de `backend/.env` y **aborta si la URL de BD no es `localhost`**. Ningún test puede volver a escribir en Supabase.
- Los E2E de Playwright importan ese mismo setup como primer import.
- Las 25 migraciones (incluida `remove_unused_models`, pendiente en Supabase) se aplican limpias sobre una BD vacía y el seed corre con TLS verificado.

```bash
cd backend
npm run test:db:up        # genera certificados + levanta el contenedor
npm run test:db:prepare   # migrate deploy + seed
npm run test:critical     # unit + integration + e2e
npm run test:db:down      # borra el contenedor
```

### Resultados

| Suite | Antes (Fase 0) | Ahora |
| ----- | -------------- | ----- |
| Unit | 41/45 | **67/67** |
| Integración | nunca ejecutada contra una BD aislada | **47/47** |
| E2E (Playwright) | 1 spec en el script | **5/5** (3 specs, en serie) |
| Cobertura `src/` (unit + integración) | — | ~69% líneas |

### Tests nuevos

| Archivo | Cubre |
| ------- | ----- |
| `test/integration/financial-regressions.integration.test.ts` | C-01, C-02, H-01, H-02 (liquidación concurrente), H-03, H-04, H-05, M-02, M-04 |
| `test/integration/inventory-flows.integration.test.ts` | Salidas manuales, conteo físico draft→completed→applied, rollback atómico al violar stock ≥ 0 (L-10), recepción concurrente de compra (una sola vez) |
| `test/e2e/cash-history.e2e.spec.ts` | M-11 en navegador: corrección de corte con `cash.correct`, sin botón con solo `cash.read`; capturas claro/oscuro en `test-results/` |
| `test/cash-reconciliation.test.ts` | M-03 (signos por tipo de movimiento), validador de reapertura |
| `test/businessDate.test.ts`, `test/error-handler.test.ts`, `test/http-security.test.ts` (ampliados) | C-01 (hora de negocio), L-02, L-03, L-10, M-01, M-05 |

### Tests existentes corregidos (estaban desactualizados, no eran fallas del código)

- `orders.integration.test.ts`: usaba el permiso antiguo `view:orders` y la transición `pending → completed`, que la máquina de estados no permite.
- `daily-orders.integration.test.ts`: el rol de prueba no tenía `sales.read`.
- `income-statement.integration.test.ts`: esperaba repartir una ganancia distribuible negativa (desde que existen los gastos fijos no se reparte nada si es ≤ 0).
- `products.integration.test.ts`, `sec-003.e2e.spec.ts`: necesitan `products.read` tras M-01.
- `sec-006-auth-session.spec.ts`: el botón "Cerrar sesión" ahora está dentro de la pestaña "Sesión".
- `security.test.ts`, E2E: dejaron de usar `__dirname` (paquete ESM).

### Pendiente

- Cobertura baja en categorías, dashboard, notificaciones y controllers de inventario (funciones < 20%).
- L-05, L-06, L-07 (redondeo de combos, `costSnapshot` de extras, fecha de promociones): ya hay red de tests de integración para cambiarlos con seguridad.
- M-06, M-09, script de datos C-01 y R-08: decisiones del desarrollador (no se tocó Supabase).

### Decisión R-08 (2026-09-22) — aplicada

Decisión del desarrollador: **cerrar sesión no toca la caja.**

- `SettingsPage.tsx`: el logout ya no cierra la caja. El corte se hace solo desde "Cierre de caja", con el efectivo contado y el motivo si hay diferencia.
- `CashService.closeIfBusinessDayEnded`: el auto-cierre de fin de jornada (hora de cierre configurada; en Supabase es 14:00) se mantiene como red de seguridad. Queda marcado con `closingReason = "Cierre automático sin conteo"` y un comentario que pide corregirlo con el conteo real desde "Cortes de caja".
- Tests: `sec-006-auth-session.spec.ts` verifica que la caja sigue abierta después del logout; `cash-session.integration.test.ts` verifica la etiqueta del auto-cierre.
- En Supabase no había cortes afectados: los 4 cortes cerrados son manuales.
- **Estado "Sin conteo"** (seguimiento de R-08): un día con un corte automático sin corregir ya no sale "Caja cuadrada" en el estado de resultados. Sale **"Sin conteo"** (`SIN_CONTEO`), sin efectivo real ni diferencia. En "Cortes de caja" la columna Diferencia muestra "Sin conteo". Al corregir el corte con el conteo real, su `closingReason` pasa a ser el motivo de la corrección (el original queda en `AuditLog`) y el día vuelve a Cuadrada/Sobrante/Faltante. Constante compartida: `AUTO_CLOSE_REASON` en `backend/src/config/app.ts`. Sin cambios de esquema.
