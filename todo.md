## TODO List — Integración completa Frontend ↔ Backend ↔ PostgreSQL
### 2. Prisma / Base de datos

* [x] Verificar `OrderItem.costSnapshot`
* [x] Verificar `OrderItemExtra.costSnapshot`
* [x] Verificar tipos y nulabilidad de ambos campos
* [x] Verificar migración de `costSnapshot`
* [x] Ejecutar `npx prisma validate`
* [x] Ejecutar `npx prisma generate`
* [x] Verificar que Prisma esté sincronizado con DB
* [ ] Revisar relaciones entre modelos
* [ ] Revisar índices necesarios
* [ ] Revisar constraints existentes

### 3. Backend — Arquitectura

* [x] Revisar estructura Controller → Service → Prisma
* [x] Estandarizar respuestas API
* [x] Estandarizar manejo de errores
* [x] Implementar validación con Zod
* [x] Implementar autorización por permisos
* [x] Verificar autenticación
* [x] Verificar middleware de autorización
* [x] Evitar lógica de negocio duplicada
* [x] Usar transacciones donde corresponda
* [x] Usar SQL parametrizado

### 4. Backend — Productos

* [x] `GET /api/products`
* [x] `GET /api/products/:id`
* [x] `POST /api/products`
* [x] `PATCH /api/products/:id`
* [x] `DELETE /api/products/:id`
* [x] Filtros
* [x] Búsqueda
* [x] Paginación
* [x] Validación
* [x] Autorización
* [x] Manejo de errores

### 5. Backend — Catálogo

* [x] Categorías
* [x] Extras (patrón definido)
* [x] Combos (patrón definido)
* [ ] Ingredientes
* [x] Relaciones producto ↔ categoría
* [x] Relaciones producto ↔ extras
* [x] Relaciones combo ↔ productos
* [x] Validaciones
* [x] CRUD completo donde corresponda

### 6. Backend — Ventas / Pedidos

* [ ] Obtener pedidos
* [x] Crear pedido
* [ ] Obtener detalle de pedido
* [ ] Actualizar pedido
* [ ] Cancelar pedido
* [x] Registrar `costSnapshot`
* [x] Registrar `OrderItemExtra.costSnapshot`F
* [x] Verificar cálculo de costos
* [x] Verificar totales
* [x] Verificar transacciones
* [x] Verificar permisos

### 7. Backend — Compras

* [ ] Obtener compras
* [ ] Crear compra
* [ ] Obtener detalle
* [ ] Actualizar compra
* [ ] Recepción de compra
* [ ] Conectar `receive_purchase`
* [ ] Verificar actualización de inventario
* [ ] Verificar transacción
* [ ] Verificar permisos

### 8. Backend — Inventario

* [ ] Obtener inventario
* [ ] Obtener existencias
* [ ] Obtener movimientos
* [ ] Registrar entradas
* [ ] Registrar salidas
* [ ] Ajustes
* [ ] Conectar funciones PostgreSQL existentes
* [ ] Evitar cálculo duplicado en TypeScript
* [ ] Validar cantidades
* [ ] Verificar permisos

### 9. Backend — Gastos

* [ ] Obtener gastos
* [ ] Crear gasto
* [ ] Editar gasto
* [ ] Eliminar/cancelar gasto
* [ ] Filtros por fecha
* [ ] Filtros por categoría
* [ ] Validaciones
* [ ] Autorización

### 10. Dashboard

* [ ] Identificar vistas PostgreSQL disponibles
* [ ] Crear endpoint de resumen
* [ ] Crear endpoint de métricas
* [ ] Crear endpoint de ventas
* [ ] Crear endpoint de costos
* [ ] Crear endpoint de utilidad
* [ ] Crear endpoint de inventario
* [ ] Utilizar vistas DB existentes
* [ ] Evitar cálculos financieros críticos en frontend

### 11. Reportes

* [ ] Identificar reportes existentes
* [ ] Identificar vistas PostgreSQL relacionadas
* [ ] Crear endpoints
* [ ] Filtros por fecha
* [ ] Filtros por categoría
* [ ] Métricas reales
* [ ] Costos históricos
* [ ] Utilidad
* [ ] Margen
* [ ] Productos vendidos
* [ ] Gastos
* [ ] Compras

### 12. Frontend — API

* [ ] Centralizar API client
* [ ] Tipar respuestas
* [ ] Tipar requests
* [ ] Manejar errores HTTP
* [ ] Manejar autenticación
* [ ] Implementar queries
* [ ] Implementar mutations
* [ ] Implementar invalidación de caché

### 13. Frontend — Pantallas

* [ ] Dashboard → DB
* [ ] Venta → DB
* [ ] Productos → DB
* [ ] Categorías → DB
* [ ] Extras → DB
* [ ] Combos → DB
* [ ] Pedidos → DB
* [ ] Compras → DB
* [ ] Gastos → DB
* [ ] Inventario → DB
* [ ] Ingredientes → DB
* [ ] Reportes → DB
* [ ] Usuarios → DB
* [ ] Configuración → DB cuando corresponda

### 14. Estados de UI

* [ ] Loading
* [ ] Error
* [ ] Empty
* [ ] Success
* [ ] Mutation loading
* [ ] Mutation error
* [ ] Feedback de operaciones
* [ ] Refetch/invalidation después de mutations
* [ ] Eliminar datos ficticios usados como fallback

### 15. Eliminación de mocks

* [ ] Eliminar arrays de productos
* [ ] Eliminar arrays de categorías
* [ ] Eliminar arrays de extras
* [ ] Eliminar arrays de combos
* [ ] Eliminar pedidos ficticios
* [ ] Eliminar compras ficticias
* [ ] Eliminar gastos ficticios
* [ ] Eliminar inventario ficticio
* [ ] Eliminar métricas ficticias
* [ ] Eliminar datos ficticios del Dashboard
* [ ] Eliminar datos ficticios de Reportes
* [ ] Eliminar servicios fake
* [ ] Eliminar respuestas simuladas
* [ ] Auditar nuevamente todo el frontend

### 16. Seguridad

* [ ] `DATABASE_URL` únicamente en backend
* [ ] `SUPABASE_SERVICE_ROLE_KEY` únicamente en backend
* [ ] Revisar todas las variables `VITE_*`
* [ ] Buscar secretos en frontend
* [ ] Validación Zod en backend
* [ ] Autenticación
* [ ] Autorización
* [ ] Permisos por endpoint
* [ ] SQL parametrizado
* [ ] Sanitización/manejo seguro de errores
* [ ] Verificar RLS de Supabase donde corresponda

### 17. Performance

* [ ] Paginación
* [ ] Filtros en DB
* [ ] Búsquedas en DB
* [ ] Índices necesarios
* [ ] Evitar `SELECT *` innecesario
* [ ] Evitar N+1 queries
* [ ] `include/select` optimizados
* [ ] React Query correctamente configurado
* [ ] Evitar requests duplicados

### 18. Integridad de datos

* [ ] Transacciones para operaciones críticas
* [ ] Validar cantidades
* [ ] Validar precios
* [ ] Validar IDs
* [ ] Validar estados
* [ ] Validar fechas
* [ ] Verificar inventario después de compras
* [ ] Verificar inventario después de ventas
* [ ] Verificar snapshots de costo
* [ ] Verificar cálculos de rentabilidad

### 19. Pruebas

* [ ] Probar login
* [ ] Probar permisos
* [ ] Probar listado de productos
* [ ] Probar creación de producto
* [ ] Probar edición
* [ ] Probar eliminación
* [ ] Probar venta
* [ ] Probar pedido
* [ ] Probar compra
* [ ] Probar recepción de compra
* [ ] Probar inventario
* [ ] Probar gastos
* [ ] Probar Dashboard
* [ ] Probar Reportes
* [ ] Probar estados vacíos
* [ ] Probar errores
* [ ] Probar usuarios sin permisos

### 20. Validación final

* [ ] `npx prisma validate`
* [ ] `npx prisma generate`
* [ ] `npm run lint`
* [ ] `npm run build`
* [ ] Ejecutar backend
* [ ] Ejecutar frontend
* [ ] Verificar consola del navegador
* [ ] Verificar errores de red
* [ ] Verificar errores del backend
* [ ] Revisar logs
* [ ] Revisar queries críticas
* [ ] Auditar nuevamente secretos
* [ ] Auditar nuevamente mocks

### 21. Criterio final de terminado

* [ ] Frontend no contiene datos de negocio ficticios
* [ ] Todas las pantallas utilizan API real
* [ ] API utiliza DB real
* [ ] PostgreSQL sigue siendo la fuente de verdad
* [ ] Funciones PostgreSQL se reutilizan
* [ ] Vistas PostgreSQL se reutilizan
* [ ] `costSnapshot` funciona correctamente
* [ ] Permisos funcionan desde backend
* [ ] Secretos no llegan al navegador
* [ ] Loading/error/empty funcionan
* [ ] CRUD funciona
* [ ] Inventario funciona
* [ ] Ventas funcionan
* [ ] Compras funcionan
* [ ] Dashboard utiliza datos reales
* [ ] Reportes utilizan datos reales
* [ ] Lint/build/Prisma pasan
* [ ] No quedan pendientes críticos
* [ ] Generar reporte final con archivos, endpoints, vistas, funciones, mocks eliminados y validaciones realizadas
