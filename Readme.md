# Andy's Coffee POS ☕

Punto de venta web de Andy's Coffee para usarse desde el mostrador: ventas, pedidos, caja, inventario, compras, gastos y estado de resultados.

Monorepo con dos aplicaciones independientes que se comunican por una API REST:

| Carpeta | Qué es |
| ------- | ------ |
| [`backend/`](backend/Readme.md) | API en Node.js + Express + Prisma sobre PostgreSQL (Supabase) |
| [`frontend/`](frontend/README.md) | SPA en React + Vite + TanStack Query |
| [`docs/`](docs/) | Documentación de ingeniería (`GPS/`) y técnica (`Project/`) |

## Funciones

### Venta (POS)
- **Pensado para tableta y laptop.** La pantalla se ajusta a la ventana y el total y "Procesar orden" siempre quedan a la vista. Los controles táctiles miden 44 px.
- **Menú:**
  - rejilla de 4 columnas (3 en tableta vertical);
  - categorías en píldoras;
  - búsqueda en todo el menú, sin distinguir acentos;
  - fotos de productos;
  - indicador de cuántas unidades de cada producto lleva la orden.
- **Productos:**
  - familias con variantes (sabores);
  - bebidas calientes, frías o de ambas formas;
  - tamaño Jumbo;
  - extras por unidad.
- **Combos:** al venderlos se elige si cada bebida va caliente o fría.
- **Promociones:** 2x1, precio por categoría y paquetes. El precio lo calcula siempre el servidor: el total que ve el cajero es el que se cobra.
- **Cobro:**
  - efectivo, con montos rápidos y cambio;
  - transferencia o tarjeta;
  - **pago pendiente**, que se liquida después.
- **Pedidos:** **programados** para una hora futura, notas por orden y por línea, y **mandaditos** (quién cobra el envío y cómo se paga).
- **Protección contra cobros dobles:** reintentar o dar doble clic nunca cobra dos veces (idempotencia).

### Pedidos
- **Tablero del día:** `pendiente → en preparación → lista → completada`, con tiempos objetivo por tamaño del pedido.
- **Cancelación:** revierte la caja y el inventario. Si la venta ya se completó, requiere la aprobación de un administrador.
- **Pagos pendientes y mandaditos:** tienen su propia vista, para liquidarlos y entregarlos.

### Caja
- **Ciclo de la caja:** apertura con fondo, movimientos de entrada y salida, y cierre con conteo y diferencia.
- **Correcciones:** se pueden corregir cierres y reabrir cortes; ambas acciones quedan auditadas.
- **Cierre automático:** al terminar el día de negocio, según el horario configurado.
- **Integridad:** la suma de los movimientos siempre cuadra con el efectivo esperado.

### Inventario
- **Insumos:**
  - se guardan en unidad base (gr, ml, pz); la compra se puede capturar en kg o lt;
  - tienen stock mínimo y máximo y costo promedio.
- **Recetas por producto**, por tamaño (Regular/Jumbo) y temperatura (líneas fría y caliente), con un costo sugerido según la receta.
- **Descuento automático al vender** (se activa en Ajustes del inventario):
  - cada venta descuenta su receta y sus extras, y se permite el stock negativo;
  - cancelar devuelve los insumos o los registra como merma, según cuándo se cancele;
  - mientras esté apagado, Existencias lo avisa.
- **Existencias:**
  - resumen y estado (normal, bajo, agotado);
  - avisos de stock bajo y de productos sin receta;
  - **filtro por producto, con para cuántas piezas alcanza el stock y qué insumo lo limita.**
- **Compras:**
  - proveedores;
  - nueva compra con costo total por línea;
  - borradores "Por recibir" que suman al inventario al recibirse.
- **Sugerencias de compra:**
  - se basan en el consumo real de los últimos 7, 14 o 30 días;
  - filtro por producto, que incluye lo que no alcanza para una pieza;
  - proveedor obligatorio por línea;
  - crean un borrador por proveedor.
- **Salidas manuales:** merma, muestra, consumo interno y donación.
- **Conteo físico:** aplica la diferencia medida al contar.
- **Historial de movimientos:** cada cambio de stock queda registrado con su saldo resultante.
- **Saldo inicial:** script con vista previa (`npm run seed:inventory`).

### Finanzas y administración
- **Gastos:** los gastos en efectivo salen de la caja abierta. Los gastos fijos diarios (luz, sueldos) entran al estado de resultados.
- **Estado de resultados:**
  - por día, semana, mes o rango;
  - los días cerrados quedan congelados;
  - incluye saldos acumulados y la distribución de utilidades.
- **Panel de administración:**
  - **Resumen:** ventas, tendencia y movimientos de inventario;
  - **Finanzas:** costos por producto, evolución de costos y gastos por categoría;
  - **Pendientes.**
- **Notificaciones:** pedidos nuevos y programados, stock bajo, solicitudes de cancelación (y su resultado) y eventos de caja.
- **Configuración:**
  - **Mi cuenta:** perfil y contraseña;
  - **Negocio:** datos, horario y finanzas;
  - **Accesos:** usuarios, roles y permisos granulares.
  - Además: tema claro/oscuro.
- **Seguridad:**
  - sesión con JWT en una cookie HttpOnly;
  - protección CSRF;
  - límite de intentos de inicio de sesión;
  - los permisos se revalidan en cada petición.

### No incluido (planeado o fuera de alcance)
Facturación CFDI, modo sin conexión, impresoras de tickets y cajón de dinero, respaldos automáticos, módulo de reportes con exportación a PDF/Excel, pantalla para administrar promociones (hoy solo por seed o BD) y rol de barista. Los roles existentes son `ADMIN` y `CAJERO`.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · TanStack Query — Node.js · Express 5 · Prisma 6 · Zod · Pino — PostgreSQL en Supabase — `node:test`, Playwright y Docker para pruebas.

## Puesta en marcha

Requisitos: Node.js 22 o superior, npm y, para las pruebas, Docker Desktop.

```bash
npm run install:all
cp backend/.env.example backend/.env.development   # completar los valores
cd backend && npm run prisma:generate && cd ..
npm run dev:backend    # API en http://127.0.0.1:4000
npm run dev:frontend   # App en http://127.0.0.1:5173
```

El detalle de variables de entorno, certificados de Supabase, migraciones y pruebas está en [backend/Readme.md](backend/Readme.md) y [frontend/README.md](frontend/README.md).

## Pruebas

```bash
npm run lint && npm run typecheck   # ambas apps
npm test                            # unitarias del backend
npm run test:critical               # unitarias + integración + E2E (BD de pruebas en Docker)
```

## Flujo de trabajo con Git

- La rama principal es `master`; trabaja en una rama por tarea (`feature/…`, `fix/…`, `docs/…`).
- Antes de abrir un PR: `npm run lint`, `npm run typecheck` y, si tocaste backend, `npm run test:critical`.
- Commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/):

| Tipo | Uso |
| ---- | --- |
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de un error |
| `refactor` | Cambio interno sin modificar el comportamiento |
| `docs` | Documentación |
| `style` | Formato, lint, espacios |
| `test` | Pruebas |
| `chore` | Configuración, dependencias, mantenimiento |
| `perf` | Rendimiento |

Ejemplo: `feat: agregar liquidación de pagos pendientes`.

## Documentación

- [`docs/GPS/`](docs/GPS/): entregables de ingeniería del proyecto (alcance, EDT, casos de uso).
- [`docs/Project/AUDIT/`](docs/Project/AUDIT/): auditorías técnicas.
- [`docs/Project/AUDIT/auditoria-qa-integral-2026-11-18.md`](docs/Project/AUDIT/auditoria-qa-integral-2026-11-18.md): auditoría QA integral (18/11/2026): 673 pruebas automatizadas sobre Docker, matriz por módulo, 11 defectos (4 altos) con causa y solución propuesta, y plan de estabilización. Corregidos en código; el despliegue está en `deployment.md` § 4.2.
- [`docs/Project/FIXED/`](docs/Project/FIXED/): hallazgos resueltos y cambios realizados (p. ej. la auditoría del flujo de ventas y el nuevo flujo de imágenes de productos, ambos del 20/10/2026).
- [`docs/Project/FIXED/[FIXED] auditoria-ux-inventario 13-11-26.md`](<docs/Project/FIXED/[FIXED] auditoria-ux-inventario 13-11-26.md>): auditoría UX/UI y simplificación del módulo de Inventario (13/11/2026): navegación en 5 secciones, existencias sin saturación, formularios por secciones y pruebas E2E del módulo.
- [`docs/Project/FIXED/[FIXED] auditoria-ux-administracion 14-11-26.md`](<docs/Project/FIXED/[FIXED] auditoria-ux-administracion 14-11-26.md>): auditoría UX/UI de Administración y Configuración (14/11/2026): 3 secciones en Administración, Configuración agrupada, permisos legibles y alineados con el backend, reapertura de cortes y pruebas E2E del módulo.
- [`docs/Project/FIXED/[FIXED] mejora-ui-pos 16-11-26.md`](<docs/Project/FIXED/[FIXED] mejora-ui-pos 16-11-26.md>): mejora UI/UX del punto de venta (16/11/2026): pantalla ajustada a la ventana con total y cobro siempre visibles, catálogo compacto, búsqueda en todo el menú, controles táctiles para tabletas, montos rápidos en efectivo y prueba E2E de distribución en 10 resoluciones.
- [`docs/Project/FIXED/[FIXED] estabilizacion-integral 14-11-26.md`](<docs/Project/FIXED/[FIXED] estabilizacion-integral 14-11-26.md>): auditoría integral y estabilización (14/11/2026): guardas contra borrar producción, cierre automático de caja, fotos del estado de resultados, movimientos de caja de mandaditos y gastos, idempotencia, permisos (`settings.manage`), validaciones y `/ready`.
- [`docs/Project/deployment.md`](docs/Project/deployment.md): despliegue a producción: arquitectura, variables, `/ready`, orden obligatorio (respaldo → migraciones → seed de permisos → imagen → smoke test) y rollback.
- [`docs/Project/plan-inventario-tiempo-real.md`](docs/Project/plan-inventario-tiempo-real.md): plan técnico del inventario en tiempo real y la normalización del catálogo (aprobado el 11/11/2026).
- [`todo.md`](todo.md): estado del proyecto y pendientes.

La documentación se escribe en español.
