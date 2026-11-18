# Auditoría QA integral — Andy's Coffee POS (18/11/2026)

> Estado: **corregido en código, pendiente de despliegue**. Los 11 defectos y los hallazgos S-01 a S-05 están corregidos en el árbol de trabajo, sin commit. Ver la sección 17.
> Rama evaluada: `feature/promotions` (commit `6bdb084`). La base de datos real no se tocó: la migración nueva se ensayó solo en Docker y su paso a producción está en `deployment.md` § 4.2.
> Las secciones 1 a 16 describen el diagnóstico **antes** de las correcciones.

## 1. Resumen ejecutivo

Se ejecutaron **673 pruebas automatizadas** contra una PostgreSQL de pruebas aislada en Docker: las 563 existentes (unitarias, integración, E2E y frontend) y **110 pruebas nuevas** escritas para esta auditoría (`qa-*`), que recorren cada operación por la API real (CSRF, sesión, permisos, validación, servicio, repositorio y BD) y verifican lo que queda guardado.

| Resultado | Pruebas |
|---|---:|
| Aprobadas | 660 |
| Fallidas | 13 |
| Bloqueadas | 0 |
| **Éxito** | **98.1 %** |

Además pasaron lint, TypeScript y build de producción de backend y frontend.

**Veredicto:** el núcleo financiero es sólido. No se encontró ningún defecto **crítico**: no hay pérdida ni corrupción de datos, ventas duplicadas, cobros dobles, fugas de permisos, inyección SQL ni contraseñas expuestas. La idempotencia, la atomicidad de las ventas, las cancelaciones y las transiciones de estado resistieron las pruebas de concurrencia.

Los 13 fallos corresponden a 11 defectos: **4 de severidad ALTA**, 4 MEDIA y 3 BAJA. Los ALTOS se deben corregir antes del siguiente despliegue:

1. **D-09 (ALTO) — No se puede crear una compra de más de 100 kg o 100 lt.** La pantalla convierte a gramos o mililitros, y la API limita la cantidad a 100,000 en la unidad base. Comprar 200 kg de azúcar responde "Error de validación." Esta es la causa más probable del error reportado al confirmar una compra.
2. **D-10 (ALTO) — Los errores de validación no dicen el motivo.** La API pone el motivo en `errors`, pero los toasts solo muestran `message` ("Error de validación."). Afecta a todos los formularios.
3. **D-01 (ALTO)** — Con varias ventas simultáneas, el sistema rechaza algunas con 409: 5 de 8 en una ráfaga. Con 2 o 3 cajas a la vez no falló ninguna. No se corrompe nada, pero hay que volver a cobrar.
4. **D-02 (ALTO)** — Iniciar sesión distingue mayúsculas en el correo: un usuario dado de alta como `Ana@Cafe.mx` no entra escribiendo `ana@cafe.mx`.

El sistema **puede seguir en producción** con su carga actual (una o dos tabletas), pero D-09 bloquea compras reales de mayoreo y debe atenderse primero.

## 2. Arquitectura y entorno evaluados

| Elemento | Detalle |
|---|---|
| Frontend | React 19 + TypeScript + Vite, TanStack Query, enrutador propio (`app/router.tsx`) |
| Backend | Node 22 + Express 5 + TypeScript; Controller → Service → Repository → Prisma 6 |
| Base de datos | PostgreSQL 16 (producción: Supabase) |
| Autenticación | JWT en cookie HttpOnly con `tokenVersion` (revocable), CSRF `tiny-csrf`, rate limit, bcrypt 12 |
| Entorno de prueba | Docker `andys-coffee-test` (`localhost:55432`, TLS verificado, `tmpfs`), migrado con `prisma migrate deploy` y sembrado con `prisma/seed.ts` |
| Aislamiento | `test/setup/test-env.ts` fija `NODE_ENV=test` y rechaza cualquier `DATABASE_URL` que no sea localhost. **No se tocó DEV ni PROD** (Supabase); no se corrieron migraciones fuera de Docker |
| Herramientas | `node:test` + `fetch` (integración HTTP real), Playwright (E2E), Vitest (frontend). No se agregaron dependencias |
| Datos de prueba | Prefijo `qa-<id>`; la BD de Docker se destruye al terminar (`npm run test:db:down`) |
| Configuración respetada | `inventory.consumeOnSale` **no se activó** (valor de la BD de pruebas: `false`) |

## 3. Funcionalidades verificadas

- **Ventas (POS):** menú, cotización vs. cobro, precios Regular/Jumbo, temperatura, extras, cantidades y precios inválidos, manipulación de precio/total desde el cliente, efectivo con cambio, transferencia, tarjeta, pago pendiente y su liquidación, mandadito, ventas programadas, idempotencia secuencial y concurrente, ventas concurrentes, venta sin caja, producto inactivo, historial y detalle, cancelación directa y por solicitud aprobada.
- **Órdenes:** matriz completa 5×5 de transiciones, auditoría, 404/400, permisos por estado, propiedad de la orden, cambios concurrentes, avanzar y cancelar a la vez, filtros, búsqueda, tablero, paginación y visibilidad para otro usuario.
- **Usuarios y autenticación:** alta, consulta, edición, (des)activación, eliminación, política de contraseñas, hashing, exposición de hashes, duplicados, login, cambio de contraseña, rate limit, logout, cambio de rol, escalamiento de privilegios y asignación masiva de campos.
- **Inventario:** CRUD de productos (precio, categoría, SKU, temperatura, Jumbo), activar/desactivar, borrado con historial, imágenes inválidas; CRUD de ingredientes, mínimos/máximos, unidades, duplicados, borrado con relaciones, salidas manuales, movimientos.
- **Proveedores:** CRUD, contacto, validaciones, duplicados (también concurrentes), borrado o desactivación con compras, uso en compras.
- **Integración:** escenarios A–D (venta ↔ inventario, proveedor ↔ compra ↔ costo promedio, usuario ↔ rol ↔ permisos, orden ↔ venta ↔ caja).
- **Seguridad:** barrido automático de las 139 rutas (sin sesión, sin permisos, con ids inexistentes y con ids maliciosos), inyección SQL, CSRF, JWT manipulado, permisos del token, errores sin datos internos, cabeceras, cookies, CORS y tipos inesperados.

## 4–8. Totales

| Suite | Ejecutadas | Aprobadas | Fallidas | Bloqueadas |
|---|---:|---:|---:|---:|
| Backend unitarias (existentes) | 179 | 179 | 0 | 0 |
| Backend integración (existentes) | 138 | 138 | 0 | 0 |
| Backend E2E Playwright (existentes) | 46 | 46 | 0 | 0 |
| Frontend Vitest (existentes) | 120 | 120 | 0 | 0 |
| **Nuevas QA — integración** (`qa-*.integration.test.ts`) | 107 | 94 | 13 | 0 |
| **Nuevas QA — E2E** (`qa-audit.e2e.spec.ts`) | 3 | 3 | 0 | 0 |
| **Total** | **673** | **660** | **13** | **0** |

Porcentaje de éxito: **98.1 %** en total; 88 % en las pruebas nuevas, que se diseñaron para encontrar fallos.

| Verificación estática | Backend | Frontend |
|---|---|---|
| Lint (ESLint) | ✅ | ✅ |
| TypeScript (`tsc --noEmit`) | ✅ | ✅ (dentro de `build`) |
| Build de producción | ✅ esbuild | ✅ Vite |

### Matriz por módulo (pruebas nuevas)

| Módulo | Pruebas | Aprobadas | Fallidas | Bloqueadas | Estado |
|---|---:|---:|---:|---:|---|
| Ventas | 23 | 21 | 2 | 0 | ⚠️ Estable con observaciones (D-01, D-07) |
| Usuarios | 19 | 17 | 2 | 0 | ⚠️ Corregir D-02 |
| Inventario | 18 | 16 | 2 | 0 | ⚠️ Corregir D-03 |
| Proveedores | 9 | 6 | 3 | 0 | ⚠️ Validaciones débiles |
| Compras (creación desde la pantalla) | 10 | 6 | 4 | 0 | ❌ Corregir D-09 y D-10 |
| Órdenes | 10 | 10 | 0 | 0 | ✅ Estable |
| Integraciones | 4 + 3 E2E | 7 | 0 | 0 | ✅ Estable |
| Seguridad | 14 | 14 | 0 | 0 | ✅ Estable |

## 9–12. Defectos encontrados

| ID | Severidad | Módulo | Resumen | Prueba |
|---|---|---|---|---|
| D-09 | **ALTO** | Compras | Compras de más de 100 kg o 100 lt rechazadas: el límite de 100,000 se aplica en g/ml | QA-COM-03 |
| D-10 | **ALTO** | Todos los formularios | El toast dice "Error de validación." sin el motivo (`errors` se ignora) | QA-COM-07 |
| D-11 | MEDIO | Compras / Inventario | El costo por g/ml se redondea a 4 decimales: el valor del inventario no cuadra con lo pagado | QA-COM-02, QA-COM-04 |
| D-01 | **ALTO** | Ventas | Con varias ventas simultáneas, algunas se rechazan con 409 | QA-VEN-12 |
| D-02 | **ALTO** | Usuarios | El login distingue mayúsculas en el correo | QA-USR-06 |
| D-03 | MEDIO | Inventario / Compras | Números con espacios o vacíos provocan 500 en 4 endpoints | QA-INV-10 |
| D-04 | MEDIO | Usuarios / Proveedores | Renombrar con espacios en blanco guarda un nombre vacío `""` | QA-USR-07, QA-PRV-02 |
| D-05 | MEDIO | Compras | Se pueden registrar compras con un proveedor desactivado | QA-PRV-07 |
| D-06 | BAJO | Inventario | El SKU de producto admite duplicados que solo cambian mayúsculas | QA-INV-03 |
| D-07 | BAJO | Ventas (API) | El total de la venta se serializa `"200.5"`; la cotización, `"200.50"` | QA-VEN-02b |
| D-08 | BAJO | Proveedores | El teléfono acepta cualquier texto | QA-PRV-03 |

### D-09 — No se pueden comprar más de 100 kg o 100 lt (ALTO)

- **Reproducción:** `qa-purchases` › QA-COM-03. Con la misma función que usa la pantalla (`buildPurchaseLine`), capturar 200 kg de azúcar por $5,600. La pantalla envía `quantity: 200000` (en gramos) y la API responde `400 {"message":"Error de validación.","errors":{"items":["Debe ser un número mayor a 0 y hasta 100,000."]}}`. Lo mismo pasa con 150 lt de leche (150,000 ml).
- **Archivos:** `backend/src/validators/purchase.validator.ts` (`MAX_QUANTITY = 100_000`, aplicado a la cantidad **en la unidad base**); `frontend/src/features/inventory/utils/purchaseLine.ts` y `unitConversion.ts` (convierten kg→gr y lt→ml ×1000 antes de enviar).
- **Causa:** el límite se pensó en unidades de captura, pero se valida después de convertir a la unidad base. En la práctica el tope real es 100 kg o 100 lt por renglón. Además, el formulario no avisa del límite antes de confirmar.
- **Riesgo:** se bloquean compras reales de mayoreo (bultos de azúcar, leche, vasos o tapas por millar) y el usuario solo ve un mensaje genérico (D-10).
- **Solución propuesta:** subir el límite en la unidad base a un valor acorde con `Decimal(14,4)`. Por ejemplo `MAX_QUANTITY = 10_000_000`, que con `MAX_UNIT_COST` sigue cabiendo en el total `Decimal(14,2)` si se acota el producto `quantity × unitCost ≤ 999,999,999.99` con un `refine` por renglón. En el frontend, validar el mismo límite antes de agregar el renglón y mostrarlo en la unidad capturada.
- **Como alternativa inmediata (sin desplegar):** capturar la compra en varios renglones de hasta 100 kg o 100 lt.

### D-10 — Los errores de validación no dicen el motivo (ALTO)

- **Reproducción:** QA-COM-07. Cantidad fuera de rango, notas de más de 1,000 caracteres o compra sin renglones responden todas `message: "Error de validación."`, y el motivo solo viaja en `errors`.
- **Archivos:** `backend/src/middleware/validate.ts` y `errorHandler.ts` (rama `ZodError`): `message` siempre es genérico. `frontend/src/shared/utils/errors.ts` (`getErrorMessage`) solo lee `response.data.message`.
- **Riesgo:** en cualquier formulario que choque con una regla del backend, el usuario no sabe qué corregir. Es justo lo que pasó al confirmar la compra.
- **Solución propuesta:** en `validate.ts` y en el `errorHandler`, usar como `message` el primer error de campo (por ejemplo `"items: Debe ser un número mayor a 0 y hasta 100,000."`) y mantener `errors` para mostrarlo junto al campo. Como refuerzo, que `getErrorMessage` use el primer valor de `errors` cuando `message` sea genérico.

### D-11 — El costo por gramo o mililitro pierde precisión (MEDIO)

- **Reproducción:** QA-COM-02 y QA-COM-04.
  - 3 kg de azúcar por $100 se guardan como 3000 g × $0.0333 = **$99.90**.
  - 3 kg de sal por $25 se guardan como 3000 g × $0.0083 = **$24.90**.
  - El total de la compra sí queda en $100.00 y $25.00, porque se calcula con el valor sin redondear.
- **Archivos:** `backend/prisma/schema.prisma` (`PurchaseItem.unitCost` e `Ingredient.averageCost` son `Decimal(14, 4)`); `purchase.service.ts` (`receivePurchase` toma el `unitCost` redondeado para el costo promedio).
- **Causa:** con unidades base pequeñas (g, ml), 4 decimales no bastan para costos de centavos por kilo. Insumos baratos como sal, hielo o agua en garrafón pierden entre 0.1 % y 7 % de su costo.
- **Riesgo:** el valor del inventario y el costo de receta (`costSnapshot`, utilidad bruta) quedan ligeramente por debajo de lo pagado, y la diferencia se acumula con cada compra. El gasto del estado de resultados no se afecta (usa `Purchase.total`).
- **Solución propuesta:** subir `unitCost` y `averageCost` (y `InventoryMovement.unitCost`) a `Decimal(18, 8)` con una migración manual `ALTER COLUMN … TYPE NUMERIC(18,8)`, ensayada antes en Docker. Ampliar la precisión no pierde datos.

### D-01 — Con varias ventas simultáneas, algunas se rechazan (ALTO)

- **Reproducción:** `qa-sales` › QA-VEN-12: 8 `POST /api/orders` distintos al mismo tiempo con la caja abierta.
- **Esperado:** 8 ventas creadas. **Obtenido:** 3 creadas y 5 con `409 "La operación no pudo completarse por un conflicto de concurrencia"`. Se repitió igual en cada corrida (3/8 y 3/8).
- **Lo que sí funciona:** `expectedAmount` de la caja coincide exactamente con las ventas creadas, no hay folios repetidos ni cobros parciales, y la prueba realista QA-VEN-12b (seis rondas de 2 y 3 ventas simultáneas) no rechazó ninguna.
- **Archivos:** `backend/src/services/order.service.ts:466-724` (`create`, transacción `serializable` con reintento `attempt < 2`), `backend/src/repositories/cash.repository.ts:255` (`cashSession.update` de `expectedAmount`).
- **Causa probable:** todas las ventas actualizan la misma fila (`cash_sessions.expectedAmount`) dentro de una transacción `Serializable`. Con más de 3 escritores a la vez, los dos reintentos inmediatos (sin espera) se agotan y la venta se devuelve como 409.
- **Riesgo:** en hora pico con varias tabletas, o con la red reintentando, la cajera ve un error y debe volver a cobrar. La clave de idempotencia evita el doble cobro, pero la experiencia y la confianza en la caja se dañan.
- **Solución propuesta:** (1) subir a 5 reintentos con espera aleatoria creciente (por ejemplo 20–150 ms) en `OrderService.create` y en `settlePayment`; (2) en `CashRepository.recordMovement`, usar `expectedAmount: { increment: amount }`, que hace una sola escritura atómica en vez de leer y escribir, y reduce los conflictos. Agregar QA-VEN-12 a la integración continua.

### D-02 — El login distingue mayúsculas en el correo (ALTO)

- **Reproducción:** `qa-users-auth` › QA-USR-06: crear un usuario `qa-…-Mayus@QA.local` e iniciar sesión con el correo en minúsculas.
- **Esperado:** 200. **Obtenido:** `401 "Correo o contraseña incorrectos."`
- **Inconsistencia:** el control de duplicados sí ignora mayúsculas (`findByEmailNormalized`, `mode: 'insensitive'`; QA-USR-05 pasa). El sistema impide crear `ana@x` si ya existe `Ana@x`, pero `ana@x` tampoco puede entrar.
- **Archivos:** `backend/src/repositories/user.repository.ts` (`findForLogin`: `findUnique({ where: { email } })`), `backend/src/services/user.service.ts` (`create`/`update` guardan el correo tal como se escribió).
- **Riesgo:** cuentas que no pueden iniciar sesión, por ejemplo cuando el teclado de la tableta pone en mayúscula la primera letra, con soporte manual en cada caso.
- **Solución propuesta:** normalizar a `trim().toLowerCase()` al crear y editar usuarios y en `loginSchema`. Agregar una migración manual que pase a minúsculas los correos existentes; antes, verificar que no choquen (`SELECT LOWER(email), COUNT(*) … HAVING COUNT(*) > 1`). Como alternativa sin migración, buscar en `findForLogin` con `findFirst` y `mode: 'insensitive'`.

### D-03 — Números con espacios o vacíos provocan 500 (MEDIO)

- **Reproducción:** `qa-inventory` › QA-INV-10.

| Petición | Resultado |
|---|---|
| `POST /api/inventory` con `minimumStock: " 5"` | 500 |
| `POST /api/inventory/exits` con `quantity: "5 "` | 500 |
| `POST /api/purchases` con `quantity: " 2"` | 500 |
| `POST /api/purchases` con `unitCost: ""` | 500 |

- **Log:** `[DecimalError] Invalid argument:  5` (en `inventory.service.ts:246`).
- **Archivos:** `backend/src/validators/inventory.validator.ts` (`stockAmount`, `inventoryExitSchema.quantity`) y `backend/src/validators/purchase.validator.ts` (`positiveDecimal`, `nonNegativeDecimal`).
- **Causa:** el validador aprueba el texto con `Number(v)`, que tolera espacios y convierte `""` en `0`, pero lo deja pasar sin limpiar. Después `new Prisma.Decimal(v)` lo rechaza y lanza una excepción no controlada.
- **Riesgo:** no se corrompen datos (la transacción no llega a escribir), pero un cliente o integración que mande texto recibe un error genérico 500 y se ensucian los logs de errores. El frontend actual manda números, así que hoy no es visible para el usuario.
- **Solución propuesta:** en los cuatro esquemas, transformar con `.transform((v) => String(v).trim())`, rechazar `''` y normalizar con `String(Number(v))` antes de entregar el valor al servicio. Agregar una prueba unitaria en `stabilization-validators.test.ts`.

### D-04 — Un nombre en blanco se guarda vacío (MEDIO)

- **Reproducción:** `PATCH /api/users/:id` con `{ "name": "   " }` responde 200 y en la BD queda `name = ""` (QA-USR-07). `PATCH /api/suppliers/:id` igual (QA-PRV-02).
- **Archivos:** `backend/src/validators/user.validator.ts` (`userUpdateSchema.name`: `z.string().min(1)` sin `trim`), `backend/src/repositories/user.repository.ts` (`update` hace `trim()` después de validar), `backend/src/validators/supplier.validator.ts` (`supplierUpdateSchema.name`).
- **Causa:** la longitud se valida antes de recortar los espacios. Al crear no ocurre porque el servicio comprueba `trim().length === 0`, pero al editar no.
- **Riesgo:** usuarios y proveedores sin nombre en listas, búsquedas, tickets y auditoría.
- **Solución propuesta:** `z.string().trim().min(1)` en `userCreateSchema`, `userUpdateSchema`, `supplierCreateSchema` y `supplierUpdateSchema`.

### D-05 — Compras con proveedor desactivado (MEDIO)

- **Reproducción:** QA-PRV-07: desactivar un proveedor y luego `POST /api/purchases` con su `supplierId` responde 201.
- **Archivo:** `backend/src/services/purchase.service.ts:38-120` (`create` conecta `supplierId` sin comprobar `isActive`).
- **Riesgo:** compras asociadas a proveedores dados de baja, lo que contradice el propósito de desactivarlos e incluye a proveedores con los que ya no se trabaja.
- **Solución propuesta:** si `supplierId` apunta a un proveedor inactivo, lanzar `ValidationError('El proveedor está desactivado.')`, igual que ya se hace con ingredientes inactivos.

### D-06 — SKU de producto duplicado por mayúsculas (BAJO)

- **Reproducción:** QA-INV-03: crear `QA-…-DUP` y luego `qa-…-dup`; ambos devuelven 201.
- **Causa:** `products.sku` es `@unique` con distinción de mayúsculas, sin el índice `LOWER(TRIM())` que sí tienen los nombres de productos, familias y unidades (`20261111130000_catalog_normalization_constraints`).
- **Solución propuesta:** normalizar el SKU a mayúsculas en `createProductSchema` y agregar un índice único `UPPER(TRIM(sku))`. Es una migración manual; antes hay que buscar duplicados en producción.

### D-07 — Formato de dinero inconsistente (BAJO)

- **Reproducción:** QA-VEN-02b: `POST /api/orders/quote` devuelve `total: "200.50"` y `POST /api/orders` devuelve `total: "200.5"` para el mismo carrito.
- **Causa:** `quote()` formatea con `toFixed(2)`; `create()` devuelve el `Decimal` de Prisma, que se serializa sin ceros a la derecha.
- **Riesgo:** bajo. El frontend usa `Number()`, pero integraciones o reportes que comparen textos fallarían.
- **Solución propuesta:** serializar todos los montos con 2 decimales en las respuestas de órdenes, o documentar que el cliente siempre debe usar `Number()`.

### D-08 — Teléfono de proveedor sin validar (BAJO)

- **Reproducción:** QA-PRV-03: `phone: "llámame mañana"` responde 201.
- **Solución propuesta:** `z.string().trim().regex(/^[0-9+()\-.\s]{7,20}$/)` opcional en `supplierCreateSchema` y `supplierUpdateSchema`.

### Hallazgos de revisión estática (sin prueba que falle)

| ID | Severidad | Hallazgo | Archivo | Propuesta |
|---|---|---|---|---|
| S-01 | BAJO | `ProductService.remove` escribe `PRODUCT_DELETED` en el log de auditoría **antes** de borrar. Si el producto tiene ventas, el borrado falla (409, QA-INV-05) pero el log ya dice que se eliminó | `backend/src/services/product.service.ts:276-284` | Registrar después de `ProductRepository.delete` |
| S-02 | BAJO | Al intentar borrar un producto con ventas la API responde el mensaje genérico "La operación entra en conflicto con datos existentes." en vez de sugerir desactivarlo | mismo archivo / `errorHandler` P2003 | Contar `orderItems` antes y lanzar `ConflictError('Tiene ventas; desactívalo')`, como en ingredientes y proveedores |
| S-03 | BAJO | Recibir una compra que ya fue recibida responde 400 (`ValidationError`) y no 409 | `backend/src/services/purchase.service.ts:136` | `ConflictError` |
| S-04 | BAJO | El folio `FAC-AAAA/MM/DD-NNNNN` toma la fecha del reloj del servidor (`new Date().getMonth()`), no del día del negocio. En Render (UTC) una compra después de las 18:00 sale con la fecha del día siguiente. QA-COM-08 pasó solo porque la máquina de pruebas está en hora de México | `backend/src/services/purchase.service.ts` (`create`) | Usar `getTodayInZone()` de `utils/businessDate` |
| S-05 | BAJO | El formulario de compra rechaza costo $0 (`cost <= 0`) aunque la API lo acepta (muestras o regalos del proveedor) | `frontend/src/features/inventory/pages/InventoryAddEntry.tsx:88` | Permitir 0 o documentar la regla |

### Comportamientos confirmados por diseño (no son defectos)

- El rol **CAJERO no tiene `sales.cancel`** (`prisma/seed.ts`): las cancelaciones son del ADMIN. El tablero oculta "Cancelar" al cajero (QA-E2E-02).
- **Cerrar sesión revoca todas las sesiones del usuario** (M-06, `tokenVersion`), también las de otras tabletas abiertas con la misma cuenta. Conviene que cada cajera tenga su propia cuenta.
- **No hay restablecimiento de contraseña por un administrador:** solo existe el cambio de la propia contraseña. Por eso nadie puede cambiar la de otro (✔ seguridad), pero una contraseña olvidada requiere acceso a la BD. Se recomienda como funcionalidad futura (`POST /users/:id/password-reset` con `users.update` y la regla de jerarquía de roles).
- **No se calculan impuestos** (`tax = 0`, QA-VEN-19). La facturación CFDI está fuera del alcance del MVP.
- **Stock negativo permitido** en ventas y salidas (decisión D-1 del plan de inventario en tiempo real); QA-INV-14 lo verifica.
- **La unidad de un ingrediente no se puede cambiar por la API** (QA-INV-16). Esto evita reinterpretar existencias ya registradas. Las conversiones kg→g se hacen al capturar recetas (QA-INT-A: 0.25 kg → 250 g).
- `GET /api/preferences/general` es pública (datos del negocio para la pantalla de login) y las rutas de notificaciones solo actúan sobre las del propio usuario (QA-SEC-14).

## 13. Riesgos para producción

| Riesgo | Probabilidad | Impacto | Defecto |
|---|---|---|---|
| Compras de mayoreo (más de 100 kg o 100 lt por renglón) imposibles de registrar | **Alta (ya ocurrió)** | Alto (inventario) | D-09 |
| El usuario no puede corregir un formulario porque no ve el motivo del error | Alta | Alto (operación) | D-10 |
| Valor de inventario y costo de recetas por debajo de lo pagado | Alta (gradual) | Medio | D-11 |
| Ventas rechazadas en hora pico con 4 o más cajas o reintentos de red | Media al crecer | Alto (operación) | D-01 |
| Usuarios que no pueden iniciar sesión por mayúsculas en el correo | Media | Alto (soporte) | D-02 |
| Errores 500 por entradas de texto en integraciones o futuros formularios | Baja | Medio | D-03 |
| Registros sin nombre o compras a proveedores dados de baja | Baja | Medio | D-04, D-05 |
| Log de auditoría con borrados que no ocurrieron | Baja | Bajo | S-01 |

Riesgos que **no** se encontraron: doble cobro, ventas duplicadas, movimientos parciales, cancelaciones revertidas dos veces, transiciones de estado ilegales, escalamiento de privilegios, acceso entre usuarios, inyección SQL, exposición de hashes o tokens, y respuestas 500 en el barrido de rutas con ids inexistentes o maliciosos.

## 14. Pruebas pendientes / no cubiertas

| Tema | Estado | Motivo |
|---|---|---|
| Venta con `consumeOnSale = true` | NOT TESTED en esta auditoría | El prompt prohíbe activar configuraciones deshabilitadas. Lo cubre la suite existente `inventory-realtime.integration.test.ts` (PASS) |
| Subida real de imágenes a Supabase Storage | NOT TESTED | Storage está simulado en pruebas. Se verificó el rechazo de archivos inválidos (QA-INV-07) y la suite existente `product-images.integration.test.ts` (PASS) |
| Promociones y combos en detalle | Cubierto por suites existentes | `promotions`, `pricing-regressions`, `combo-temperature` (PASS); sin pruebas nuevas |
| Carga sostenida y rendimiento | NOT TESTED | Fuera de alcance (no se hacen ataques de carga). Solo ráfagas cortas de concurrencia |
| Validación de formularios del frontend campo por campo | Parcial | Cubierto por E2E existentes (`admin`, `inventory`) y Vitest; sin pruebas nuevas |
| Último administrador activo | Cubierto por `user-delete-protection.integration.test.ts` | Depende de cuántos ADMIN haya en la BD |

## 15. Recomendaciones de corrección

Las soluciones concretas están en cada defecto (sección 9–12). En resumen, en orden:

0. D-09 y D-10: límite de cantidad acorde con la unidad base y motivo del error visible en el toast.
1. D-01: reintentos con espera aleatoria e `increment` atómico en `expectedAmount`.
2. D-02: normalizar correos a minúsculas, con migración manual de los existentes ensayada antes en Docker.
3. D-03 y D-04: endurecer los esquemas Zod (`trim`, rechazar `''`, normalizar números).
4. D-05: impedir compras con proveedores inactivos.
5. D-06, D-07, D-08, S-01, S-02 y S-03: ajustes menores.

Las pruebas `qa-*` ya están escritas: al corregir cada defecto, su prueba debe pasar sin modificarla.

## 16. Plan de estabilización priorizado

| Fase | Contenido | Esfuerzo | Verificación |
|---|---|---|---|
| **P0 — urgente** | D-09 (límite de cantidad en compras) y D-10 (motivo del error en los toasts) | ~½ día | QA-COM-03 y QA-COM-07 en verde |
| **P0 — antes del próximo despliegue** | D-02 (login sin mayúsculas, con migración de correos ensayada en Docker) y D-01 (reintentos con espera + `increment`) | ~1 día | QA-USR-06, QA-VEN-12 y QA-VEN-12b en verde; suites completas |
| **P1 — siguiente iteración** | D-11 (precisión de costos, migración manual), D-03, D-04, D-05 (validaciones), S-01 y S-04 | ~1 día | QA-COM-02, QA-COM-04, QA-INV-10, QA-USR-07, QA-PRV-02, QA-PRV-07 |
| **P2 — mejora continua** | D-06 (índice de SKU, migración manual), D-07, D-08, S-02, S-03; restablecimiento de contraseña por un administrador | ~1 día | QA-INV-03, QA-VEN-02b, QA-PRV-03 |
| **P3 — proceso** | Incorporar las suites `qa-*` a CI (`npm run test:integration` ya las incluye por el patrón de archivos) | — | Integración continua en verde |

## 17. Correcciones aplicadas (18/11/2026)

Se aplicaron una por una, sin cambiar las pruebas `qa-*` salvo dos ajustes. QA-COM-07 usaba 100,001 como cantidad inválida y ahora usa el nuevo tope, 10,000,001. En QA-INV-03, la BD de Docker tenía duplicados de SKU que habían dejado las corridas anteriores; se borraron para poder aplicar el índice nuevo.

| Defecto | Corrección | Archivos principales | Prueba que lo cubre |
|---|---|---|---|
| D-09 | La cantidad máxima por renglón pasa a 10,000,000 en la unidad base (10 t o 10,000 lt). Se agregan topes por renglón ($100 M) y por compra ($1,000 M) para que los totales sigan cabiendo en la BD. El formulario avisa del límite antes de agregar el renglón. Las salidas manuales usan el mismo límite | `validators/purchase.validator.ts`, `validators/inventory.validator.ts`, `frontend/.../utils/purchaseLine.ts`, `InventoryAddEntry.tsx` | QA-COM-03, `purchase-validator.test.ts`, `purchaseLine.test.ts` |
| D-10 | `message` lleva el primer motivo, con el nombre del campo cuando el mensaje es el genérico de Zod. Los mensajes de Zod salen en español (`z.locales.es`). `getErrorMessage` usa `errors` si `message` llega genérico | `utils/validationErrors.ts`, `middleware/validate.ts`, `middleware/errorHandler.ts`, `frontend/src/shared/utils/errors.ts` | QA-COM-07, `error-handler.test.ts`, `errors.test.ts` |
| D-11 | `averageCost` y `unitCost` (en compras y movimientos) pasan a `NUMERIC(18,8)` | migración `20261118120000_qa_audit_precision_and_normalized_keys`, `schema.prisma`, `config/migrations.ts` | QA-COM-02, QA-COM-04 |
| D-01 | Los conflictos de serialización (P2034) se reintentan hasta 10 veces, con espera exponencial aleatoria de 15 ms hasta un tope de 300–600 ms. Aplica a ventas, liquidación de pagos pendientes, apertura y cierre de caja y gastos (`runSerializableWithRetry`) | `repositories/transaction.ts`, `services/order.service.ts`, `cash.service.ts`, `expense.service.ts` | QA-VEN-12 (8 simultáneas, 3 corridas seguidas en verde), QA-VEN-12b |
| D-02 | Los correos se guardan en minúsculas y sin espacios. El login los busca sin distinguir mayúsculas, así que las cuentas antiguas también entran. Nuevo índice único `LOWER(TRIM(email))` | `validators/user.validator.ts`, `validators/password.validator.ts`, `repositories/user.repository.ts`, migración | QA-USR-06 |
| D-03 | Validador decimal compartido `decimalInput`: acepta número o texto, recorta espacios y rechaza vacío, hex, exponentes y comas con el mensaje del campo. También se acotó `countedQuantity` en conteos físicos | `validators/common.validator.ts`, `purchase`/`inventory`/`inventory-count.validator.ts` | QA-INV-10, `purchase-validator.test.ts` |
| D-04 | `trim()` antes de validar la longitud del nombre (usuarios, perfil, proveedores) | `user.validator.ts`, `password.validator.ts`, `supplier.validator.ts` | QA-USR-07, QA-PRV-02 |
| D-05 | Una compra con proveedor desactivado o inexistente responde 400 con un mensaje claro | `services/purchase.service.ts`, `repositories/supplier.repository.ts` | QA-PRV-07 |
| D-06 | Al crear o editar, el SKU repetido (sin importar mayúsculas) responde 409 indicando qué producto lo usa. Un SKU en blanco cuenta como "sin SKU". Nuevo índice `UPPER(TRIM(sku))` | `services/product.service.ts`, `repositories/product.repository.ts`, migración | QA-INV-03 |
| D-07 | Los importes de todas las respuestas de órdenes salen con 2 decimales | `utils/moneyJson.ts`, `controllers/order.controller.ts` | QA-VEN-02b, `money-json.test.ts` |
| D-08 | El teléfono del proveedor admite dígitos, espacios, `-`, `.`, `()` y `+` (7 a 20 caracteres, extensión opcional). El correo se guarda en minúsculas. El formulario aplica la misma regla | `supplier.validator.ts`, `SupplierFormModal.tsx` | QA-PRV-03 |
| S-01 / S-02 | Un producto con ventas no se borra y la API responde 409 con la sugerencia de desactivarlo. La auditoría registra el borrado solo cuando realmente ocurre | `services/product.service.ts` | QA-INV-05 |
| S-03 | Recibir una compra ya recibida responde 409 | `services/purchase.service.ts` | QA-INT-B |
| S-04 | El folio `FAC-…` usa el día del negocio (`CASH_TIMEZONE`) | `services/purchase.service.ts` | QA-COM-08 |
| S-05 | El formulario de compra acepta costo $0 | `InventoryAddEntry.tsx` | — (revisión manual) |

**Compatibilidad:**
- Los mensajes de error cambian de texto (ahora dicen el motivo), pero conservan la forma `{ message, errors }`.
- Un proveedor que ya tenga guardado un teléfono fuera de la regla nueva solo se rechaza si se vuelve a enviar ese teléfono al editarlo.
- El código anterior funciona con el esquema nuevo, así que es posible revertir el código sin revertir la migración.

**Despliegue:** ver `deployment.md` § 4.2 (verificaciones previas, migración antes del código y prueba rápida).

### Regresión final después de las correcciones

| Suite | Resultado |
|---|---:|
| Backend unitarias | 183 / 183 ✅ |
| Backend integración (existentes + `qa-*`) | 245 / 245 ✅ |
| Backend E2E Playwright (existentes + `qa-audit`) | 49 / 49 ✅ |
| Frontend Vitest | 124 / 124 ✅ |
| Lint, TypeScript y build (backend y frontend) | ✅ |
| **Total** | **601 / 601** |

Notas de la regresión:
- `inventory-flows.integration.test.ts` esperaba `ValidationError` al recibir dos veces la misma compra. Se actualizó a `ConflictError` por el cambio intencional S-03; sigue verificando que se reciba una sola vez.
- La primera corrida E2E falló en `pos-layout` (10 tamaños de pantalla) y `combo-temperature`. La causa no estaba en la aplicación: las suites `qa-*` dejaban su catálogo activo en la BD de pruebas, unas 80 categorías `qa-…` en el POS. Ahora `QaHarness.stop()` desactiva (sin borrar) lo que crea cada suite, y al volver a correr ambas specs pasaron 11 / 11.
- QA-VEN-12 (8 ventas simultáneas) pasó en 3 corridas seguidas.

## Evidencias

- **Pruebas nuevas (sin commit):**
  - `backend/test/integration/qa-http.ts`: utilidades compartidas
  - `qa-sales`, `qa-orders`, `qa-users-auth`, `qa-security`, `qa-inventory`, `qa-suppliers`, `qa-purchases` y `qa-scenarios` (`.integration.test.ts`). `qa-purchases` importa la función real del frontend (`purchaseLine.ts`) para enviar exactamente lo que manda la pantalla
  - `backend/test/e2e/qa-audit.e2e.spec.ts`
- **Reproducir:**
  ```bash
  cd backend
  npm run test:db:up
  # sembrar sin test:db:prepare (en Windows mata node.exe):
  #   DATABASE_URL/DIRECT_URL del contenedor → npx prisma migrate deploy && npx tsx prisma/seed.ts
  npm run test:integration            # existentes + qa-*
  npx playwright test test/e2e/qa-audit.e2e.spec.ts --workers=1
  npm run test:db:down
  ```
- **Determinismo:** la suite completa de integración (existentes + `qa-*`) se corrió dos veces seguidas con los mismos 9 fallos. Las pruebas de concurrencia se repitieron en cada corrida.
- **Logs crudos:** se guardaron en el directorio temporal de la sesión de auditoría (no versionados).
