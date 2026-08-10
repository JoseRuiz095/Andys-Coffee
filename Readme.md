# Andy's Coffee POS ☕

Guía práctica para desarrollar y mantener el sistema de Punto de Venta de Andy's Coffee.

## Propósito

Este README es una guía de referencia para el equipo. Debe responder a:
- ¿Qué contiene cada carpeta?
- ¿Cómo debe fluir la lógica entre capas?
- ¿Qué se debe implementar primero?
- ¿Cómo trabajar con Git?

Usa este documento como mapa antes de empezar cada nueva característica.

---

## Tecnologías principales

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Axios

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- Bcrypt
- zod → validación de entradas.
- helmet → headers de seguridad.
- cors → configuración de acceso frontend/backend.
- dotenv → variables de entorno, si tu configuración actual no lo resuelve.
- Logger estructurado, por ejemplo pino.

---

## Requisitos de desarrollo

- Node.js 18+ o superior
- npm o yarn
- PostgreSQL 14+ o compatible
- Git
- Editor con TypeScript

---

## Inicio rápido

1. Clona el repositorio.
2. Instala dependencias.
3. Configura variables de entorno.
4. Ejecuta migraciones.
5. Levanta backend y frontend por separado desde la raíz.

Ejemplo:

- `npm run dev:backend`
- `npm run dev:frontend`

Si prefieres trabajar por carpetas:

- `cd backend && npm run dev`
- `cd frontend && npm run dev`

---

# Guia de commits:
| Tipo       | Uso                                        |
| ---------- | ------------------------------------------ |
| `feat`     | Nueva funcionalidad                        |
| `fix`      | Corrección de un error                     |
| `refactor` | Cambio interno sin modificar funcionalidad |
| `docs`     | Documentación                              |
| `style`    | Formato, espacios, lint, etc.              |
| `test`     | Pruebas                                    |
| `chore`    | Configuración, dependencias, mantenimiento |
| `perf`     | Mejora de rendimiento                      |



# Estructura del proyecto

```
Andys-Coffee
│
├── frontend
├── backend
├── docs
├── README.md
└── .gitignore
```

El proyecto está dividido en dos aplicaciones independientes:
- `frontend`: interfaz de usuario.
- `backend`: API y lógica de negocio.

---

# Roadmap por fases

## Fase 1: Base

- [ ] Configuración inicial frontend/backend.
- [ ] Autenticación y login.
- [ ] Gestión de usuarios.
- [ ] Roles y permisos.

## Fase 2: Catálogo

- [ ] Categorías.
- [ ] Productos.
- [ ] Extras.
- [ ] Combos.

## Fase 3: Caja y finanzas 

- [ ] Apertura y cierre de caja.
- [ ] Corte de caja.
- [ ] Gastos.
- [ ] Compras.

## Fase 4: Punto de venta

- [ ] Interfaz de caja.
- [ ] Pedidos.
- [ ] Métodos de pago.
- [ ] Ticket de venta.

## Fase 5: Inventario y recetas

- [ ] Inventario.
- [ ] Recetas.
- [ ] Descuento automático de ingredientes.

## Fase 6: Datos y reportes

- [ ] Dashboard.
- [ ] Reportes.
- [ ] Estadísticas.
- [ ] Exportaciones.

---

# Frontend

```
frontend
│
├── public
├── src
│   ├── assets
│   ├── components
│   ├── layouts
│   ├── pages
│   ├── routes
│   ├── hooks
│   ├── services
│   ├── store
│   ├── types
│   ├── utils
│   ├── styles
│   ├── App.tsx
│   └── main.tsx
```

## Descripción de carpetas

- `assets`: imágenes, íconos y fuentes.
- `components`: componentes reutilizables y aislados.
- `layouts`: plantillas de página con estructura compartida.
- `pages`: pantallas completas.
- `routes`: rutas de React Router.
- `hooks`: hooks personalizados.
- `services`: llamadas al backend y funciones de integración.
- `store`: estado global con Zustand.
- `types`: tipos e interfaces TypeScript.
- `utils`: funciones auxiliares.
- `styles`: configuración global y estilos.

## Reglas del frontend

- `components` no debe contener lógica de negocio.
- `pages` ensamblan componentes y manejan el flujo de pantalla.
- `services` contienen llamadas a la API.
- `store` maneja estado global que comparten varias páginas.
- `hooks` abstraen lógica reutilizable.

## Componentes comunes

- `Button`, `Input`, `Modal`, `Card`, `Navbar`, `Sidebar`, `Table`, `Loader`.
- `DashboardLayout`, `AuthLayout`.
- `Login`, `Dashboard`, `Productos`, `Pedidos`, `Caja`, `Inventario`, `Reportes`.
- `useAuth`, `useProducts`, `useOrders`, `useCaja`.
- `auth.service.ts`, `product.service.ts`, `order.service.ts`, `inventory.service.ts`.
- `auth.store.ts`, `cart.store.ts`, `user.store.ts`.
- `formatCurrency`, `formatDate`, `calculateTotal`.

---

# Backend

```
backend
│
├── prisma
│
├── src
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── routes
│   ├── services
│   ├── repositories
│   ├── validators
│   ├── types
│   ├── utils
│   ├── app.ts
│   └── server.ts
│
├── package.json
└── tsconfig.json
```

## Descripción de carpetas

- `prisma`: esquema de base de datos y migraciones.
- `config`: configuración de la aplicación.
- `controllers`: reciben peticiones y responden.
- `middleware`: autenticación, validación y errores.
- `routes`: definición de endpoints.
- `services`: lógica de negocio.
- `repositories`: acceso a datos.
- `validators`: validaciones con Zod.
- `types`: interfaces y DTOs.
- `utils`: utilidades generales.

## Reglas del backend

- `controllers` deben ser delgados: reciben datos, validan y llaman a `services`.
- `services` implementan la lógica del negocio.
- `repositories` realizan consultas a la base de datos.
- `services` no deben usar Prisma directamente.
- `validators` validan datos antes de ejecutar servicios.

## Ejemplos de responsabilidades

- `ProductController`, `OrderController`, `AuthController`.
- `OrderService` crea pedidos y actualiza inventario.
- `CajaService` maneja apertura, cierre y cortes.
- `ProductRepository` y `OrderRepository` acceden a la base de datos.
- Middleware de `auth`, `logger`, `errorHandler`, `roles`.
- Rutas como `GET /products`, `POST /orders`, `PUT /inventory`.
- Validadores como `CreateProductSchema`, `LoginSchema`.
- Utilidades como `generateTicket`, `generateUUID`, `formatMoney`.

---

# Flujo recomendado del backend

1. El cliente hace la petición.
2. `routes` define la ruta.
3. `controller` recibe la petición.
4. `validator` comprueba los datos.
5. `service` aplica la lógica de negocio.
6. `service` usa `repository` para acceder a datos.
7. `repository` usa Prisma.
8. La respuesta regresa al cliente.

No romper este flujo.

---

# Convenciones de desarrollo

## Controllers

- Solo reciben y responden.
- No contienen lógica de negocio.
- No realizan consultas directas complicadas.

## Services

- Contienen la lógica del negocio.
- Orquestan reglas y llamadas a repositorios.

## Repositories

- Encapsulan acceso a datos.
- No aplican reglas de negocio.

## Componentes React

- Pequeños y reutilizables.
- Evitar lógica compleja dentro del componente.
- Usar hooks para estado y efectos.

## Pages

- Ensamblan componentes.
- Muestran estados de carga y errores.
- No deben contener lógica de negocio compleja.

---

# Git

- No trabajar directamente sobre `main`.
- Crear ramas por función o módulo.
- Mantener commits pequeños y descriptivos.
- Revisar PRs antes de mergear.

Ejemplos de ramas:

- `feature/login`
- `feature/products`
- `feature/orders`
- `feature/inventory`
- `feature/dashboard`

---

# Buenas prácticas

- Código legible y consistente.
- Usar TypeScript para tipos estrictos.
- Validar datos en backend.
- Manejar errores centralizadamente.
- Mantener la app responsive.
- Priorizar funcionalidades completas.
- Documentar decisiones importantes.

---

# Objetivo final

Construir un sistema capaz de administrar:
- Ventas
- Pedidos
- Caja
- Inventario
- Recetas
- Compras
- Gastos
- Clientes
- Reportes
- Estadísticas
- Utilidad
- Flujo de efectivo

Todo desde una aplicación web optimizada para iPhone.