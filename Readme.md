# Andy's Coffee POS ☕

Punto de venta web de Andy's Coffee para usarse desde el mostrador: ventas, pedidos, caja, inventario, compras, gastos y estado de resultados.

Monorepo con dos aplicaciones independientes que se comunican por una API REST:

| Carpeta | Qué es |
| ------- | ------ |
| [`backend/`](backend/Readme.md) | API en Node.js + Express + Prisma sobre PostgreSQL (Supabase) |
| [`frontend/`](frontend/README.md) | SPA en React + Vite + TanStack Query |
| [`docs/`](docs/) | Documentación de ingeniería (`GPS/`) y técnica (`Project/`) |

## Funciones

- **Venta (POS):** productos, combos, extras y promociones; efectivo, transferencia o tarjeta; pagos pendientes y mandaditos.
- **Pedidos:** `pendiente → en preparación → lista → completada`; cancelación con reversa de caja (las ventas completadas, con aprobación del admin).
- **Caja:** apertura, cierre con conteo, corrección, reapertura auditada y cierre automático.
- **Inventario:** ingredientes, recetas, compras, salidas manuales, conteos físicos y costo promedio.
- **Finanzas:** gastos, gastos fijos y estado de resultados.
- **Administración:** usuarios, roles y permisos, preferencias del negocio y tema claro/oscuro.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · TanStack Query — Node.js · Express 5 · Prisma 6 · Zod · Pino — PostgreSQL y Storage en Supabase — `node:test`, Playwright y Docker para pruebas.

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
- [`docs/Project/FIXED/`](docs/Project/FIXED/): hallazgos resueltos y cambios realizados (p. ej. la auditoría del flujo de ventas del 20/10/2026).
- [`todo.md`](todo.md): estado del proyecto y pendientes.

La documentación se escribe en español.
