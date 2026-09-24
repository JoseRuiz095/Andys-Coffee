# Andy's Coffee POS ☕

Punto de venta de Andy's Coffee: ventas, pedidos, caja, inventario, compras, gastos y estado de resultados. Es una aplicación web pensada para usarse desde el mostrador.

El repositorio contiene dos aplicaciones independientes que se comunican por una API REST:

| Carpeta | Qué es | Guía |
| ------- | ------ | ---- |
| [`backend/`](backend/Readme.md) | API en Node.js + Express + Prisma sobre PostgreSQL (Supabase) | [backend/Readme.md](backend/Readme.md) |
| [`frontend/`](frontend/README.md) | SPA en React + Vite + TanStack Query | [frontend/README.md](frontend/README.md) |
| [`docs/`](docs/) | Auditorías, planes de prueba y decisiones | — |
| [`todo.md`](todo.md) | Seguimiento del trabajo y pendientes | — |

---

## Qué hace el sistema

- **Venta (POS):** pedidos con extras, combos y promociones; pago en efectivo, transferencia o tarjeta; pagos pendientes y "mandaditos" (entregas).
- **Pedidos del día:** estados `pendiente → en preparación → lista → completada`, cancelación con reversa de caja e inventario.
- **Caja:** apertura, cierre con conteo, corrección de cortes, reapertura auditada y cierre automático al terminar el día de negocio.
- **Inventario:** ingredientes, recetas por producto y extra, compras a proveedores, salidas manuales (merma, muestras, consumo), conteos físicos y costo promedio.
- **Finanzas:** gastos, gastos fijos diarios y estado de resultados por día, semana, mes o rango.
- **Administración:** usuarios, roles y permisos granulares; preferencias del negocio (nombre, moneda, horario); tema claro/oscuro.

---

## Stack

| Capa | Tecnologías |
| ---- | ----------- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query 5, Axios, framer-motion, recharts, sileo (toasts) |
| Backend | Node.js, Express 5, TypeScript, Prisma 6 (`@prisma/adapter-pg`), Zod 4, Pino, JWT en cookie HttpOnly, CSRF (`tiny-csrf`), Helmet, rate limiting |
| Datos | PostgreSQL en Supabase (TLS verificado); Supabase Storage para imágenes de productos |
| Pruebas | `node:test` + `tsx` (unitarias e integración), Playwright (E2E), PostgreSQL en Docker |

---

## Requisitos

- **Node.js 22 LTS o superior** (el proyecto se desarrolla con Node 24; Vite 8 requiere ≥ 20.19).
- **npm** (cada app tiene su propio `package-lock.json`).
- **Docker Desktop**, solo para las pruebas de integración y E2E.
- Acceso al proyecto de **Supabase** (cadena de conexión, certificado CA y llaves), que te comparte el responsable del proyecto.

---

## Puesta en marcha

```bash
# 1. Dependencias de ambas apps
npm run install:all

# 2. Variables de entorno
cp backend/.env.example backend/.env        # y completar los valores
cp frontend/.env.example frontend/.env      # opcional

# 3. Certificado CA de Supabase (Project Settings → Database → SSL)
#    guardarlo en backend/certs/prod-ca-2021.crt (la carpeta está en .gitignore)

# 4. Cliente de Prisma
cd backend && npm run prisma:generate && cd ..

# 5. Levantar cada app en su propia terminal
npm run dev:backend      # API en http://127.0.0.1:4000
npm run dev:frontend     # App en http://127.0.0.1:5173 (redirige /api al backend)
```

Abre `http://127.0.0.1:5173` e inicia sesión. En una base de datos recién creada, el seed crea `admin@andyscoffee.local` con la contraseña de `ADMIN_SEED_PASSWORD`.

> ⚠️ **`backend/.env` apunta a la base de datos real.** Contra ella solo se aplican migraciones con `npm run prisma:migrate:deploy`. Nunca ejecutes `prisma migrate dev` ni `prisma migrate reset` sin haber leído la sección de base de datos de [backend/Readme.md](backend/Readme.md#base-de-datos-y-migraciones).

---

## Scripts de la raíz

El `package.json` de la raíz solo delega en cada app:

| Script | Qué hace |
| ------ | -------- |
| `npm run install:all` | Instala dependencias de backend y frontend |
| `npm run dev:backend` / `npm run dev:frontend` | Servidores de desarrollo (cada uno en su terminal) |
| `npm run lint` | ESLint en frontend y backend |
| `npm run typecheck` | TypeScript en backend y frontend |
| `npm run build` | Build de producción del frontend |
| `npm test` | Pruebas unitarias del backend |
| `npm run test:db:up` / `test:db:prepare` / `test:db:down` | BD de pruebas en Docker |
| `npm run test:critical` | Unitarias + integración + E2E (requiere la BD de pruebas) |

---

## Arquitectura en una página

```
Navegador (React)
   │  Axios + cookie de sesión + token CSRF
   ▼
Express ──► requireAuth → checkPermission → validate(Zod) → Controller
                                                              │
                                                              ▼
                                            Service (reglas de negocio)
                                                              │
                                                              ▼
                                            Repository (Prisma) ──► PostgreSQL (Supabase)
```

- **Backend:** Controller → Service → Repository → Prisma. Los services nunca usan Prisma directamente (ESLint lo impide) y las operaciones de varios pasos corren en transacciones.
- **Frontend:** Pages → Hooks (TanStack Query) → `features/*/api` → `apiClient`. Los componentes son presentacionales.
- **Permisos:** el backend es quien decide; el frontend solo oculta lo que el usuario no puede usar.

### Reglas de negocio que conviene conocer

- **Día de negocio** en la zona `CASH_TIMEZONE` (por defecto `America/Mexico_City`); el horario (apertura/cierre) se configura en Preferencias del Sistema.
- **Ingreso reconocido** = pedido pagado y no cancelado (`backend/src/utils/revenueRecognition.ts`).
- **Movimientos de caja:** `amount` es el efecto en el cajón con signo (+ entra, − sale); los movimientos de una sesión (sin `CLOSING`) suman su `expectedAmount`.
- **Costos históricos:** cada venta guarda el costo del momento (`costSnapshot`); los días cerrados del estado de resultados quedan congelados.

---

## Pruebas

```bash
npm run test:db:up        # PostgreSQL con TLS en Docker (puerto 55432)
npm run test:db:prepare   # migraciones + seed
npm run test:critical     # unitarias + integración + E2E
npm run test:db:down
```

Las pruebas de integración y E2E se niegan a correr contra cualquier host que no sea `localhost`. Detalles en [backend/Readme.md](backend/Readme.md#pruebas).

---

## Flujo de trabajo con Git

- La rama principal es `master`; no se trabaja directo sobre ella. Crea una rama por tarea (`feature/…`, `fix/…`, `test/…`).
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

---

## Documentación adicional

- [`CLAUDE.md`](CLAUDE.md): convenciones detalladas de arquitectura, temas y seguridad.
- [`docs/auditoria-mvp-2026-09-22.md`](docs/auditoria-mvp-2026-09-22.md): auditoría del MVP, hallazgos y correcciones.
- [`docs/plan-test.md`](docs/plan-test.md): plan de estabilización y pruebas.
- [`todo.md`](todo.md): estado del proyecto y pendientes.
