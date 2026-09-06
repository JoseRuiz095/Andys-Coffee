# TODO de remediación técnica y de seguridad

## P0 — Inmediato

### [x] SEC-001 — Eliminar el fallback del secreto JWT

**Estado de revisión:** Parcialmente implementado, no marcar como completo.

- Ya se rechaza `JWT_SECRET` ausente, corto o igual al fallback conocido.
- Ya se validan entropía mínima, algoritmo (`HS256`), emisor y audiencia en `verifyJwtToken`.
- La rotación se realiza cambiando `JWT_SECRET`; como no se aceptan claves anteriores, los tokens firmados con la clave anterior quedan inválidos. Falta ejecutar esta comprobación en el entorno desplegado.

- **Problema:** `backend/src/config/security.ts` firma tokens con un secreto conocido cuando falta `JWT_SECRET`.
- **Solución:** hacer que la aplicación falle al iniciar si falta el secreto; exigir longitud y entropía mínimas; validar algoritmo, emisor, audiencia y expiración; rotar cualquier secreto que haya sido expuesto.
- **Archivos:** `backend/src/config/security.ts`, configuración del entorno.
- **Criterio de cierre:** sin secretos por defecto; el backend no inicia con `JWT_SECRET` ausente o inválido; los tokens antiguos quedan invalidados tras la rotación.
- **Evidencia local:** `backend/npm test` cubre secreto ausente/inseguro, issuer, audience, algoritmo, expiración y rechazo de tokens con la clave anterior tras rotación.

### [x] SEC-002 — Restaurar TLS seguro para PostgreSQL

**Estado de revisión:** Parcialmente implementado, no marcar como completo.

- Ya no se fuerza `NODE_TLS_REJECT_UNAUTHORIZED=0`, no se convierte `sslmode=require` a `disable` y se eliminó `ssl:false`.
- Ahora se exige un parámetro `sslmode` distinto de `disable` en todos los entornos y ya no se fuerza TLS inseguro.
- `npx prisma validate` pasa con el schema actual.
- Falta probar la conexión real con certificado válido e inválido en el entorno desplegado.

- **Problema:** `backend/src/config/prisma.ts` desactiva TLS globalmente y convierte `sslmode=require` en `sslmode=disable`.
- **Solución:** eliminar `NODE_TLS_REJECT_UNAUTHORIZED=0`, mantener TLS habilitado y validar el certificado/CA del proveedor; separar correctamente URL directa y URL de pool.
- **Archivos:** `backend/src/config/prisma.ts`, configuración del entorno.
- **Criterio de cierre:** conexión cifrada y validada en producción; conexión rechazada ante certificado inválido; ninguna degradación automática de `sslmode`.

### [x] SEC-003 — Restringir CORS y proteger mutaciones con cookie

**Estado de revisión:** Parcialmente implementado, no marcar como completo.

- La allowlist CORS, `cookieParser`, endpoint `/api/auth/csrf`, middleware CSRF y envío del header desde Axios están activos.
- Falta prueba end-to-end de login y mutaciones con/sin token, y verificar HTTPS en producción.

- **Problema:** `backend/src/app.ts` usa `origin: true` junto con `credentials: true`.
- **Solución:** utilizar una allowlist explícita por entorno; rechazar orígenes desconocidos; usar HTTPS y `secure: true`; añadir protección CSRF para operaciones autenticadas mediante cookie.
- **Archivos:** `backend/src/app.ts`, `backend/src/controllers/auth.controller.ts`, configuración del entorno.
- **Criterio de cierre:** solo los frontends autorizados reciben CORS; una petición cross-site no puede ejecutar mutaciones autenticadas.

### [x] SEC-004 — Proteger el CRUD de productos

**Estado de revisión:** Parcialmente implementado, no marcar como completo.

- Las tres mutaciones ahora incluyen `requireAuth` y `checkPermission('manage:products')`.
- `requireAuth` ahora adjunta los permisos incluidos en el JWT y las mutaciones también verifican permiso dentro de `ProductService`; se añadió logging básico de actor y cambios.
- El backend ya compila con `npx tsc --noEmit`.
- Los tests de integración cubren 401/403/404, pero se omiten cuando `RUN_INTEGRATION_TESTS` no está habilitado; falta ejecutarlos contra PostgreSQL real.

- **Problema:** `POST`, `PATCH` y `DELETE /api/products` son públicos.
- **Solución:** añadir `requireAuth` y permisos específicos de catálogo; aplicar la autorización también dentro del servicio; registrar quién cambió precio, coste, stock lógico, estado o imagen.
- **Archivos:** `backend/src/routes/product.routes.ts`, `backend/src/services/product.service.ts`, middleware de autorización y logger.
- **Criterio de cierre:** un usuario anónimo recibe 401; un usuario sin permiso recibe 403; solo roles autorizados pueden modificar catálogo.

### [x] SEC-005 — Corregir IDOR y autorización de pedidos

**Estado de revisión:** Parcialmente implementado, no marcar como completo.

- Se añadieron comprobaciones de permisos, propiedad y transiciones en el servicio.
- `requireAuth` ahora carga los permisos actuales del rol desde la BD y el servicio comprueba permisos y transiciones.
- Las rutas de lectura exigen `view:orders`; debe confirmarse si un usuario propietario debe poder consultar su pedido sin ese permiso y ajustar la política si corresponde.
- `req.params.id` ya se normaliza y `AuthorizationError` se mapea a 403 en el handler de aplicación.
- Los tests de integración cubren 401/403/404/409 e IDOR, pero se omiten cuando `RUN_INTEGRATION_TESTS` no está habilitado; falta ejecutarlos contra PostgreSQL real y verificar eventos en el agregador de logs.

- **Problema:** cualquier usuario autenticado puede listar todos los pedidos, consultar cualquier ID y cambiar estados sin permiso ni transición válida.
- **Solución:** definir permisos por operación y visibilidad; aplicar autorización en rutas y servicios; imponer transiciones válidas (`pending` a estados permitidos); registrar estado anterior y nuevo.
- **Archivos:** `backend/src/routes/order.routes.ts`, `backend/src/controllers/order.controller.ts`, `backend/src/services/order.service.ts`.
- **Criterio de cierre:** cada endpoint tiene una política verificable; no se puede leer o modificar un pedido fuera del alcance del usuario; se rechazan transiciones inválidas con 409.

### [x] SEC-008 — Hacer íntegra la operación venta-pago-caja-inventario

**Estado de revisión:** Parcialmente implementado; falta evidencia E2E, de concurrencia y de reglas financieras.

- `OrderService.create` vuelve a crear líneas, combos, extras, totales, promociones y pagos dentro de una transacción.
- La transacción exige una caja abierta, descuenta ingredientes de recetas con control atómico de stock, registra movimientos de inventario/caja y actualiza `inventoryProcessed`.
- `X-Idempotency-Key`, la restricción única por usuario y la recuperación de conflictos reducen duplicados en reintentos; el aislamiento serializable se reintenta ante conflictos concurrentes.
- El frontend genera la clave automáticamente; la selección explícita de caja queda soportada mediante `cashSessionId` opcional.
- Falta ejecutar pruebas de importe/método de pago, rollback por stock/caja, cancelación con reversión y concurrencia contra PostgreSQL real.

- **Problema:** crear un pedido no descuenta inventario ni genera movimiento de caja, no exige caja abierta y no valida completamente pagos.
- **Solución:** diseñar un caso de uso transaccional que valide precios y activos, reserve/descuente stock con control de concurrencia, registre pago y movimiento de caja, y actualice `inventoryProcessed`; añadir idempotency key para reintentos.
- **Archivos:** `backend/src/services/order.service.ts`, servicios de inventario/caja, `backend/prisma/schema.prisma`, migraciones necesarias.
- **Criterio de cierre:** una venta confirmada actualiza todas las entidades o revierte completamente; no existe overselling bajo concurrencia; reintentar la misma operación no duplica pago, stock ni caja.

## P1 — Alta prioridad

### [ ] SEC-006 — Unificar y endurecer la gestión de sesiones

- **Problema:** el token se devuelve en JSON y se guarda en `localStorage`; la cookie usa `secure: false`; el logout solo limpia el estado local.
- **Solución:** usar cookie HttpOnly/Secure/SameSite apropiada como fuente primaria; retirar el token persistido en JavaScript; implementar `POST /api/auth/logout` que expire la cookie; configurar Axios con una política de credenciales coherente.
- **Archivos:** `backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`, `frontend/src/app/api.ts`, `frontend/src/features/auth/store/auth.store.ts`.
- **Criterio de cierre:** logout invalida la sesión del navegador; el token no aparece en `localStorage`; `/auth/me` valida la sesión real antes de mostrar el dashboard.

### [ ] SEC-007 — Endurecer la validación de pedidos

- **Problema:** los items pueden contener producto y combo simultáneamente, o ninguno; IDs y cantidades tienen validación incompleta; extras no se vinculan al producto.
- **Solución:** exigir exactamente un `productId` o `comboId`; validar UUID, cantidades máximas, texto y método de pago enumerado; exigir productos/extras activos y relaciones válidas; rechazar campos desconocidos cuando corresponda.
- **Archivos:** `backend/src/validators/order.validator.ts`, `backend/src/services/order.service.ts`.
- **Criterio de cierre:** entradas ambiguas, IDs inexistentes, extras no asociados, productos inactivos y cantidades fuera de rango reciben 400; el servidor calcula todos los precios.

### [ ] SEC-009 — Asegurar la carga de imágenes

- **Problema:** Multer usa memoria sin límite y acepta MIME, extensión y contenido proporcionados por el cliente.
- **Solución:** establecer límites de tamaño y campos; permitir formatos concretos; validar magic bytes y dimensiones; generar extensión segura; usar almacenamiento privado o URLs firmadas; limpiar archivos si falla la persistencia.
- **Archivos:** `backend/src/routes/product.routes.ts`, `backend/src/services/upload.service.ts`, configuración de Supabase.
- **Criterio de cierre:** archivos grandes, MIME falso y formatos no permitidos se rechazan; un fallo de BD no deja archivos huérfanos.

### [ ] SEC-010 — Separar DTOs públicos y administrativos

- **Problema:** menú y detalle de producto pueden devolver coste, SKU, recetas, ingredientes y datos de inventario.
- **Solución:** seleccionar campos explícitos y crear DTOs públicos mínimos; reservar costes, recetas, stock y metadatos internos para endpoints autorizados.
- **Archivos:** `backend/src/services/menu.service.ts`, `backend/src/services/product.service.ts`, controladores y tipos frontend.
- **Criterio de cierre:** las respuestas públicas contienen únicamente datos necesarios para vender; una prueba de contrato confirma que no aparecen `cost`, recetas ni stock.

### [ ] SEC-011 — Unificar y validar el motor de promociones

- **Problema:** menú y pedidos aplican distintos tipos promocionales y no existen límites suficientes para evitar descuentos inválidos.
- **Solución:** centralizar pricing en un único servicio server-side; implementar todos los tipos soportados; definir acumulación, redondeo y prioridad; validar porcentajes, precios y descuento máximo; impedir totales negativos.
- **Archivos:** `backend/src/services/menu.service.ts`, `backend/src/services/order.service.ts`, validadores y modelos de promoción.
- **Criterio de cierre:** precio mostrado y cobrado usan las mismas reglas; todos los tipos tienen pruebas de tabla; ningún descuento genera total negativo.

### [ ] TECH-002 — Resolver la concurrencia del nombre de cliente

- **Problema:** `Cliente N` se obtiene leyendo el último pedido y sumando uno, lo que puede colisionar bajo concurrencia.
- **Solución:** usar una secuencia o contador atómico en PostgreSQL, o abandonar el nombre secuencial y generar un identificador garantizado único.
- **Archivos:** `backend/src/services/order.service.ts`, `backend/prisma/schema.prisma`, migración si aplica.
- **Criterio de cierre:** pruebas concurrentes no producen duplicados ni errores de unicidad.

### [ ] TECH-003 — Crear pruebas para las áreas críticas

- **Problema:** ya existen pruebas unitarias, integración y un spec E2E, pero las de integración se omiten sin PostgreSQL y el spec E2E aún no compila; no hay evidencia de ejecución completa en CI.
- **Solución:** priorizar autorización, autenticación, pricing, promociones, pagos, stock, transacciones, concurrencia, uploads y logout.
- **Archivos:** `backend/package.json`, nueva estructura de tests backend/frontend.
- **Criterio de cierre:** las pruebas críticas se ejecutan en CI y cubren casos válidos, inválidos, no autorizados, rollback e idempotencia.

## P2 — Prioridad media

### [ ] TECH-001 — Unificar el manejo de errores

- **Problema:** `backend/src/middleware/errorHandler.ts` no se monta y `app.ts` tiene otro handler que convierte demasiados errores en 500.
- **Solución:** montar un único handler; mapear Zod a 400, autenticación a 401, autorización a 403, ausencia a 404, conflictos Prisma a 409 y errores desconocidos a 500; no filtrar detalles internos.
- **Archivos:** `backend/src/app.ts`, `backend/src/middleware/errorHandler.ts`, controladores y servicios.
- **Criterio de cierre:** status codes consistentes y respuestas sin stack traces, SQL, tokens o secretos.

### [ ] PERF-001 — Limitar y validar paginación y filtros

- **Problema:** `page` y `limit` son strings sin rangos; pueden producir `NaN`, valores negativos o consultas demasiado grandes.
- **Solución:** validar enteros positivos, aplicar máximos, normalizar búsquedas y rechazar filtros inválidos; seleccionar solo columnas necesarias.
- **Archivos:** `backend/src/validators/product.validator.ts`, `backend/src/validators/order.validator.ts`, servicios de producto/pedido.
- **Criterio de cierre:** entradas inválidas reciben 400 y ningún request puede solicitar un volumen ilimitado.

### [ ] PERF-002 — Mejorar consultas de menú y creación de pedidos

- **Problema:** el menú filtra días en memoria y devuelve objetos amplios; pedidos insertan líneas y extras uno a uno.
- **Solución:** reducir `select/include`, filtrar en BD cuando sea viable, usar operaciones por lote y medir consultas; mantener la transacción alrededor de las invariantes.
- **Archivos:** `backend/src/services/menu.service.ts`, `backend/src/services/order.service.ts`.
- **Criterio de cierre:** benchmark con pedido grande y menú real demuestra tiempos y cantidad de queries aceptables.

### [ ] CONFIG-001 — Completar configuración segura de entornos

- **Problema:** no existe `.env.example`; `prisma.config.ts` exige `DIRECT_URL` mientras el cliente acepta también `DATABASE_URL`; el frontend se sirve en `0.0.0.0`.
- **Solución:** crear documentación de variables sin secretos, validar configuración al arranque, documentar runtime Node y restringir host/preview fuera de desarrollo.
- **Archivos:** `.env.example` si se decide incorporarlo, `backend/prisma.config.ts`, `backend/src/config/*`, `frontend/vite.config.ts`.
- **Criterio de cierre:** despliegue reproducible sin valores por defecto inseguros y sin secretos en el frontend.

### [ ] FRONT-001 — Alinear sesión, estados y caché del frontend

- **Problema:** router manual protege por token local, los estados frontend/backend no coinciden por completo y las mutaciones no invalidan siempre queries.
- **Solución:** validar sesión contra backend, compartir tipos de contrato, mapear todos los estados válidos, manejar errores de mutación y definir invalidación/refetch explícita.
- **Archivos:** `frontend/src/app/router.tsx`, `frontend/src/app/api.ts`, hooks y servicios de auth/orders/menu.
- **Criterio de cierre:** refresh, expiración, logout, cambio de estado y actualización de catálogo producen UI consistente.

### [ ] DATA-001 — Revisar esquema y migraciones de Prisma

- **Problema:** `CashSession.cashRegisterId @unique` limita el historial; varios estados son `String`; `Ingredient.sku` no es único; hay migraciones con posible pérdida o cambio restrictivo de datos.
- **Solución:** confirmar reglas históricas, añadir constraints/enums solo con plan de migración y revisar datos afectados antes de aplicar cambios.
- **Archivos:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/*`.
- **Criterio de cierre:** modelo y migraciones reflejan sesiones históricas, estados válidos, importes/cantidades permitidos y plan de rollback.

### [ ] OBS-001 — Mejorar logging y auditoría de negocio

- **Problema:** Pino registra arranque y errores, pero no existe trazabilidad suficiente de quién, qué y cuándo en login, permisos, ventas, cancelaciones, inventario, caja, gastos y compras.
- **Solución:** añadir eventos estructurados con actor, acción, entidad, estado anterior/nuevo, importe, timestamp y request ID; excluir secretos, contraseñas y tokens.
- **Archivos:** `backend/src/utils/logger.ts`, auth/order/product/inventory/cash services.
- **Criterio de cierre:** una operación crítica puede reconstruirse sin consultar logs ambiguos ni exponer datos sensibles.

## P3 — Baja prioridad

### [ ] DEBT-001 — Sincronizar documentación con la implementación

- **Problema:** README menciona tecnologías y capacidades no presentes o no completas, como React Router, Zustand, React Hook Form, Helmet y repositorios.
- **Solución:** actualizar documentación para describir el sistema real y registrar explícitamente módulos aún no implementados.
- **Archivos:** `Readme.md`, `backend/Readme.md`, documentación del proyecto.
- **Criterio de cierre:** documentación, scripts y arquitectura descrita coinciden con el código.

### [ ] DEBT-002 — Revisar código y dependencias potencialmente duplicados

- **Problema:** `checkPermission`, `CategoryService`, el error handler separado y módulos de dominio sin rutas pueden estar desconectados; `motion` y `framer-motion` podrían solaparse.
- **Solución:** comprobar usos reales, integrar lo necesario o documentar su estado; retirar únicamente elementos confirmados como huérfanos después de pruebas.
- **Archivos:** middleware, services, componentes y `frontend/package.json`.
- **Criterio de cierre:** no quedan APIs abandonadas ni dependencias duplicadas sin justificación.

### [ ] PERF-003 — Ajustar polling y frescura del menú

- **Problema:** notificaciones hacen polling en background y el menú usa `staleTime: Infinity`.
- **Solución:** pausar polling cuando la aplicación no sea visible, usar invalidación tras cambios de catálogo y definir una política de frescura acorde al negocio.
- **Archivos:** `frontend/src/features/dashboard/hooks/useNotifications.ts`, `frontend/src/features/menu/hooks/useMenu.ts`.
- **Criterio de cierre:** tráfico de background controlado y cambios de menú visibles sin recarga manual indebida.

## Validación final

### [ ] Ejecutar la validación de seguridad

- [x] `npm run lint` en frontend.
- [x] `npm run build` en frontend.
- [ ] `npx tsc --noEmit` en backend: falla por un error de tipos en `backend/test/e2e/sec-003.e2e.spec.ts`.
- [x] `npx prisma validate` en backend.
- [ ] `npx prisma generate` en backend: no ejecutado en esta revisión.
- [x] `npm test` en backend: 10 tests pasan y 11 se omiten por depender de integración.
- [ ] `npm run test:integration` en backend con PostgreSQL real.
- [ ] `npm run test:e2e:security`: pendiente; el spec actual tiene un error de tipos en los headers.
- Tests unitarios, integración y E2E críticos.
- Verificación de CORS, cookies, JWT, autorización, uploads, errores y límites HTTP.
- Revisión de secretos en archivos, historial y artefactos de build.
- Revisión de consultas críticas, transacciones, stock, caja y pagos.

**Resultado de la última revisión (2026-09-05):**

La implementación P0 cubre en código el rechazo de secretos inseguros, TLS obligatorio, allowlist CORS/CSRF, autorización de productos y pedidos, y el flujo transaccional de venta con stock, caja, pago e idempotencia. Los tests unitarios verifican localmente JWT/rotación conceptual, configuración TLS/CA, CORS, CSRF, autenticación de rutas y validación de pedidos. Esto no equivale todavía al cierre de auditoría: 11 tests de integración se omitieron y el E2E de seguridad aún no compila.

- `npx tsc --noEmit` en backend: pasa.
- `npx prisma validate` en backend: pasa.
- `npm run build` en frontend: pasa, con warning de bundle grande.
- `npm run lint` en frontend: pasa.
- `npm test` en backend: pasa; 10 tests pasan y 11 tests se omiten por requerir integración.
- `npx tsc --noEmit` en backend: falla por un error de tipos en `backend/test/e2e/sec-003.e2e.spec.ts`.
- `npm run test:integration` contra PostgreSQL real: pendiente.
- `npm run test:e2e:security`: pendiente hasta corregir el error de tipos y ejecutar servicios reales.
- Pruebas end-to-end de CORS, CSRF, TLS, autorización, concurrencia, rollback e idempotencia: pendientes.

### [ ] Criterio global de terminado

- Ningún hallazgo P0 abierto.
- Los hallazgos P1 tienen pruebas automatizadas y evidencia de cierre.
- Secretos reales no aparecen en el repositorio, navegador, logs ni respuestas API.
- Catálogo, pedidos, pagos, caja e inventario tienen autorización e integridad transaccional.
- Los contratos frontend/backend están alineados.
- Build, lint frontend, Prisma y tests unitarios pasan; compilación completa backend, tests de integración y pruebas end-to-end aún deben pasar en CI.