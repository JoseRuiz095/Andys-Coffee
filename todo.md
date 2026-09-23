## TODO List — Andy's Coffee POS (Actualizado Sept 22, 2026)

Este documento registra el progreso del proyecto: 11 fases de desarrollo + auditoría integral y testing (Sept 22) + pendientes.
Detalle completo de la auditoría: [docs/auditoria-mvp-2026-09-22.md](docs/auditoria-mvp-2026-09-22.md).

---

## ✅ COMPLETADO — Fases 1-12

### Phase 1: Base ✅
- [x] Configuración inicial frontend/backend
- [x] Autenticación JWT con HttpOnly cookies
- [x] Gestión de usuarios (CRUD)
- [x] Roles y permisos basados en RBAC
- [x] Middleware de autorización por permisos
- [x] Filtrado de menú principal según rol (ADMIN/CAJERO)
- [x] Rate limiting (login: 5 intentos/15min, password: 3 intentos/15min)
- [x] Password hashing con bcrypt (12 rounds)
- [x] Session revalidación (re-fetch usuario en cada request)

### Phase 2: Catálogo ✅
- [x] Categorías (CRUD)
- [x] Productos (CRUD con filtros y búsqueda)
- [x] Extras (CRUD)
- [x] Combos (CRUD)
- [x] Relaciones producto ↔ categoría
- [x] Relaciones producto ↔ extras
- [x] Relaciones combo ↔ productos
- [x] Validación con Zod en backend
- [x] Paginación
- [x] Búsqueda y filtrado en BD

### Phase 3: Cash Management ✅
- [x] Apertura de sesión de caja
- [x] Cierre de sesión de caja
- [x] Corrección de cierre
- [x] Auto-cierre a la hora de cierre configurada en Preferencias del Sistema (hoy 14:00); queda marcado como "Cierre automático sin conteo"
- [x] Transacciones atómicas con isolation level Serializable
- [x] CashService con lógica de negocio
- [x] Endpoints: `POST /api/cash-register/sessions`, `PATCH /api/cash-register/sessions/:id/close`, etc.
- [x] Verificación de permisos por endpoint
- **Pendiente**: Cash cuts y expenses (próxima iteración)

### Phase 4: POS Interface Foundational ✅
- [x] Estructura básica de interfaz de caja
- [x] Componentes de pago (placeholders)
- [x] Componentes de recibos (placeholders)
- [x] Componentes de display de órdenes (placeholders)
- **Pendiente**: Integración completa de flujo de pagos

### Phase 5: Inventory Management ✅
- [x] Proveedores (CRUD)
- [x] Ingredientes/Productos de inventario (CRUD)
- [x] Conteos físicos (crear, actualizar, completar)
- [x] Recepción de compras (inventory intake)
- [x] Historial de movimientos de inventario
- [x] Transacciones para operaciones críticas
- [x] Endpoints: `GET/POST /api/inventory`, `/api/inventory-count/*`, `/api/purchases/:id/receive`
- [x] Validación de cantidades
- [x] Verificación de permisos

### Phase 6: Orders ✅
- [x] Crear pedido
- [x] Registrar costSnapshot para OrderItem
- [x] Registrar costSnapshot para OrderItemExtra
- [x] Cálculo correcto de totales
- [x] Verificación de transacciones
- [x] Verificación de permisos (sales.create, sales.read, sales.cancel)
- [x] OrderService con lógica de negocio
- **Pendiente**: Obtener/actualizar/cancelar pedidos (próxima iteración)

### Phase 7: Manual Inventory Exits ✅
- [x] Registrar salidas manuales (mermas, muestras, consumo, donaciones)
- [x] Campo `reason` estructurado con opciones predefinidas
- [x] Transacciones atómicas
- [x] Actualización correcta de inventario
- [x] Permisos de autorización
- [x] Histórico de salidas

### Phase 8: Frontend Refactoring & Dynamic Theme ✅
- [x] Sistema de temas light/dark dinámico
- [x] ThemeProvider con Context API
- [x] ThemeMode: light | dark
- [x] Paleta de colores: 21 colores semánticos
- [x] Persistencia en localStorage ('andy-theme')
- [x] Fallback a preferencia del sistema (prefers-color-scheme)
- [x] CSS variables para colores (--color-primary, --color-surface, etc.)
- [x] Hook useTheme() para acceso en componentes
- [x] Soporte en index.css con html[data-theme]
- [x] Refactorización de componentes para usar tema
- [x] Feature de preferencias para toggle de tema

### Phase 9: Cash Cuts & Expenses ✅
- [x] Backend: Validadores con Zod
- [x] Backend: Repository para gastos (CRUD)
- [x] Backend: Service con lógica de negocio
- [x] Backend: Controller para endpoints
- [x] Backend: Routes `/api/expenses`
- [x] Backend: Permisos (expenses.read/create/update/delete)
- [x] Backend: Integración con sesión de caja
- [x] Backend: CashMovement audit trail para gastos
- [x] Backend: Validación de permisos
- [x] Frontend: ExpenseFormModal (form manual con validación)
- [x] Frontend: ExpenseList (tabla con acciones)
- [x] Frontend: ExpenseFilters (categoría + rango de fechas)
- [x] Frontend: ExpensesPage (integración completa)
- [x] Frontend: Integración en SettingsPage → pestaña Gastos
- [x] Frontend: TanStack Query hooks (useExpenses)
- [x] Frontend: API client (ExpenseAPI)
- [x] Bug fix: Endpoint de historial de caja (`GET /cash-register/sessions`)
- [x] Bug fix: Corrección de contrato de corrección (`correctedAmount`, `reason` requerido)
- [x] Bug fix: P2034 mapping en error handler (Serializable conflicts → 409)

### Phase 10: Dashboard ✅
- [x] Auditoría completa del modelo de datos
- [x] Búsqueda de PostgreSQL views (NO existen)
- [x] Identificación de métricas factibles
- [x] Backend: Validadores (período, rango de fechas, filtros)
- [x] Backend: Repository con queries optimizadas (sin N+1)
- [x] Backend: Service con cálculos financieros
- [x] Backend: Controller para endpoints
- [x] Backend: 4 endpoints implementados:
  - [x] `GET /api/dashboard/summary` — KPIs
  - [x] `GET /api/dashboard/sales` — Ventas + top productos
  - [x] `GET /api/dashboard/inventory` — Stock bajo/agotados
  - [x] `GET /api/dashboard/costs` — COGS, márgenes, ganancia
- [x] Backend: Soporte de períodos (today/yesterday/week/month/customRange)
- [x] Backend: Permiso dashboard.read
- [x] Frontend: API client (DashboardAPI)
- [x] Frontend: TanStack Query hooks (useDashboard*)
- [x] Frontend: DashboardSummary (cards de KPIs)
- [x] Frontend: TopProducts (top 5 con gráfica)
- [x] Frontend: InventoryStatus (stock bajo/agotado)
- [x] Frontend: CostsOverview (desglose financiero)
- [x] Frontend: MetricsPage (página principal con selector de período)
- [x] TypeScript: Backend compila sin errores
- [x] TypeScript: Frontend compila sin errores

---

### Phase 11: Code Cleanup & Bug Fixes ✅
- [x] Auditoría y remoción de código muerto (fases 1-7)
- [x] Eliminar repository method: `InventoryRepository.findAll()`
- [x] Eliminar componentes frontend: `ProductsCatalogPage`, `ProductFormModal`, `ProductsTable`
- [x] Eliminar modelos Prisma: `Ticket`, `PurchaseInvoiceCounter` (⚠️ `PromotionOnProduct`/`PromotionOnCategory` sí se usaban: restaurados el 22/09, ver N-01)
- [x] Crear migración para eliminar tablas obsoletas
- [x] Actualizar `menu.service.ts` (promociones globales)
- [x] Actualizar `order.service.ts` (referencias removidas)
- [x] TypeScript válido post-cleanup
- [x] Bug fix: Drawer visual (Portal pattern para escapar stacking contexts)
- [x] Bug fix: Combo prices distribution (dividir precio equitativamente)
- [x] Bug fix: Corrección de órdenes existentes con script
- [x] Bug fix: Validación Zod en `/api/orders/by-date` (z.strictObject → z.object)

### Fase 12: Auditoría integral, estabilización y testing ✅ (Sept 22, 2026)
Plan: [docs/plan-test.md](docs/plan-test.md) · Reporte: [docs/auditoria-mvp-2026-09-22.md](docs/auditoria-mvp-2026-09-22.md)

- [x] Auditoría Fases 0-5: 2 críticos, 6 altos, 11 medios, 11 bajos, código muerto, riesgos
- [x] Críticos: gastos con fecha que desaparecían del estado de resultados (C-01); cancelar ventas de cajas cerradas alteraba el corte (C-02)
- [x] Altos: permiso `sales.create` al crear ventas; doble cobro por liquidaciones simultáneas; pagos pendientes de pedidos cancelados; snapshots no invalidados; activar/desactivar ingredientes; rate limit de login evadible
- [x] Medios: catálogo con costos ya no es público, reapertura de caja auditada, conciliación de caja, escalamiento de privilegios al asignar roles, `helmet`, revocación de sesión (M-06), invalidación de caché en el frontend, seed seguro, pestaña "Cortes de caja"
- [x] Formato de error unificado `{ message, errors? }` (el frontend ya muestra los mensajes reales)
- [x] Código muerto confirmado eliminado
- [x] BD de pruebas aislada en Docker (`npm run test:db:up` / `test:db:prepare`) que nunca toca Supabase
- [x] Suite: 71 unit + 61 integración + 6 E2E pasando (`npm run test:critical`)
- [x] Migraciones aplicadas en Supabase: `remove_unused_models`, `add_user_token_version`, `add_snapshot_expenses_outside_hours`, `restore_promotion_links`

**Decisiones de negocio tomadas:**
- [x] R-02: una venta cuenta como ingreso cuando está pagada, sin importar su estado en cocina (los cancelados nunca)
- [x] R-03: todos los gastos/compras del día cuentan; los de fuera de horario se muestran aparte
- [x] R-04: el formulario de producto sugiere el costo según receta × costo promedio (botón "Usar"); el costo sigue siendo manual
- [x] R-08: cerrar sesión ya no cierra la caja; el auto-cierre queda como "Sin conteo" hasta corregirlo con el conteo real
- [x] N-01: cada promoción aplica solo a sus productos/categorías (lunes: Latte Andy's; miércoles: Bagels; viernes: 8 lattes de sabor)

---

## 🔴 PENDIENTE — ACCIÓN DEL DESARROLLADOR

- [x] Agregar `SUPABASE_SERVICE_ROLE_KEY` a `backend/.env` (Supabase → Project Settings → API). Sin ella falla la subida de imágenes de productos. Nunca en el frontend
- [x] Commit de los cambios de la auditoría (revisar `backend/.gitignore` y decidir si `backend/prisma/backups/` va al repo)
- [x] Levantar un solo backend y un solo frontend (`npm run dev` en cada carpeta); antes había 3 backends duplicados
- [x] Apagar la BD de pruebas al terminar: `cd backend && npm run test:db:down`

---

## 🟠 BUGS ENCONTRADOS DURANTE LA DEUDA TÉCNICA (resueltos Sept 22)

- [x] N-02: la pantalla de login pedía las preferencias sin sesión → aviso "Sesión expirada" al abrir la app; los cajeros veían nombre/moneda por defecto. `GET /api/preferences/general` ahora es público (solo lectura)
- [x] N-03: **registrar un gasto por HTTP siempre fallaba (500)** por un `refine` asíncrono en el esquema; `validate()` ahora usa `parseAsync`
- [x] N-04: la pantalla de Gastos no estaba montada en ninguna parte; vuelve a Configuración → Gastos (`expenses.read`)
- [x] Filtro de pedidos: agregados "En preparación" y "Lista"
- [x] Tipos reales que ocultaban los `any` (categorías, entradas de inventario, estado de pedidos)

## 🟡 BUGS MENORES (resueltos Sept 22)

- [x] Panel del pedido: la imagen de respaldo (logo) no se mostraba cuando el producto no tiene imagen
- [x] Dashboard: las gráficas de tendencia de ventas y de costos agrupaban por día UTC; ahora por día de negocio
- [x] Estado de resultados (tabla por periodo): "Estado de Caja" mostraba el código (`SIN_CONTEO`, `CUADRADA`); ahora muestra el texto legible

---

## 📋 PRÓXIMAS FUNCIONALIDADES

### Reportes (fuera del MVP — decisión Sept 22)
- [ ] Definir reportes necesarios
- [ ] Reporte de ventas (productos, cantidades, ingresos) con filtros por fecha y categoría
- [ ] Reporte de compras (proveedores, costos)
- [ ] Reporte de gastos
- [ ] Reporte de inventario (movimientos, niveles)
- [ ] Margen y utilidad
- [ ] UI para reportes

### Compras
- [ ] Editar una compra en borrador (`PATCH /api/purchases/:id`; hoy solo se puede crear, recibir y eliminar)

### Inventario
- [ ] Proyecciones de stock

### Promociones
- [ ] UI para administrar promociones y sus productos/categorías (hoy solo existen por seed/BD)

---

## 🧹 DEUDA TÉCNICA

- [x] Lint limpio: frontend 71 → 0 errores; backend con ESLint configurado (41 → 0). Sin `any` en código de la app
- [ ] Services que usan Prisma directamente (`order.service` 67 usos, `expense.service` 13, `cash`, `auth`, `menu`, job de conciliación) → mover a repositories
- [ ] Autorización y validación uniformes: `checkPermission` + `validate()` en todas las rutas; quitar los try/catch repetidos de los controllers
- [ ] Estados como texto libre → enums (`Payment.status`, `CashMovement.type`, `deliveryResponsible`, `Expense.category`); FK para `Expense.sourceOrderId`
- [ ] Convención de signos uniforme en `CashMovement.amount`
- [ ] Drift previo de la tabla `ingredients` entre BD y esquema (índice parcial de `sku`, tipo de `deletedAt`)
- [x] Code splitting: bundle inicial 1,774 kB → 183 kB de app + vendors cacheables; Órdenes, Inventario, Administración y Configuración se cargan bajo demanda
- [x] `package.json` en la raíz (`npm run lint`, `typecheck`, `test:critical`, `dev:*`) y `.env.example` en backend y frontend
- [ ] Cobertura de tests (69% de líneas): subir categorías, dashboard, notificaciones y controllers de inventario

---

## 📊 CRITERIO FINAL DE TERMINADO

- [x] Frontend **NO** contiene datos de negocio ficticios (verificado Sept 22)
- [x] Todas las pantallas utilizan API real
- [x] API utiliza BD real (PostgreSQL)
- [x] PostgreSQL es la fuente de verdad
- [x] costSnapshot funciona correctamente (incluye extras)
- [x] Permisos funcionan desde backend (incluida la creación de ventas)
- [x] Secretos no llegan al navegador (único `VITE_*`: URL pública de Supabase)
- [x] Estados (loading/error/empty/success) funcionales
- [x] CRUD funcional para entidades principales
- [x] Inventario funcional (entradas, salidas, conteos)
- [x] Ventas funcionales (crear, listar, cancelar)
- [x] Compras funcionales (crear, listar, recibir)
- [x] Caja funcional (abrir, cerrar, corregir, auto-cierre)
- [x] Gastos funcionales
- [x] Dashboard utiliza datos reales
- [x] ~~Reportes utilizan datos reales~~ — módulo de reportes fuera del alcance del MVP
- [x] Sistema de temas (light/dark) funcional
- [x] Preferencias de usuario persistidas
- [x] Build/Prisma validan correctamente
- [x] Lint limpio (frontend y backend)
- [x] Tests críticos pasan (`npm run test:critical`)
- [x] No hay pendientes críticos de seguridad

---

## 📝 NOTAS TÉCNICAS

### Arquitectura
- **Backend**: Controller → Service → Repository → Prisma ORM (con las excepciones listadas en Deuda técnica)
- **Frontend**: Components → Hooks → Pages → API (`app/api.ts` + `features/*/api`); router propio en `app/router.tsx`
- **State**: store de auth basado en eventos, TanStack Query para datos del servidor, Theme Context para el tema
- **Validación**: Zod en backend (fuente de verdad)
- **Reglas financieras**: ingreso = pedido pagado y no cancelado (`backend/src/utils/revenueRecognition.ts`)

### Comandos útiles
```bash
# Backend
cd backend && npm run dev              # Servidor con hot reload
npm run prisma:migrate                 # Crear/aplicar migraciones (desarrollo)
npx prisma migrate deploy              # Aplicar migraciones (Supabase)

# Tests (requiere Docker)
npm run test:db:up && npm run test:db:prepare
npm run test:critical                  # unit + integración + E2E
npm run test:db:down

# Frontend
cd frontend && npm run dev             # Vite
npm run build                          # Build de producción
```

---

## 🎯 RESUMEN DE PROGRESO

**Completado**: 11 fases de desarrollo + Fase 12 (auditoría, estabilización y testing)
**Siguiente**: acciones del desarrollador y deuda técnica (reportes quedan fuera del MVP)
**Status general**: MVP auditado; sin pendientes críticos ni altos; 138 tests automatizados pasando

### Ciclo Sept 22, 2026 — Auditoría y testing ✅
- ✅ Auditoría integral (backend, BD, API/seguridad, frontend, flujos de negocio)
- ✅ Todos los hallazgos críticos, altos y medios corregidos o aplicados
- ✅ 4 migraciones aplicadas en Supabase, con respaldo previo de datos
- ✅ Infraestructura de tests aislada + 138 tests

### Ciclo Sept 21, 2026 ✅
- ✅ Auditoría de código muerto (8 elementos; los vínculos de promociones se restauraron el 22/09)
- ✅ Bug fixes: Drawer (Portal), precios de combos, órdenes históricas, validación `/api/orders/by-date`

Última actualización: **Sept 22, 2026**
