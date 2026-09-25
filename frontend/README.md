# Andy's Coffee — Frontend

SPA del punto de venta: React 19 + TypeScript + Vite 8, Tailwind CSS 4 y TanStack Query para los datos del servidor.

---

## Inicio rápido

```bash
npm install
cp .env.example .env     # opcional (ver "Variables de entorno")
npm run dev              # http://127.0.0.1:5173
```

El backend debe estar corriendo (por defecto en `http://127.0.0.1:4000`). En desarrollo, Vite redirige todas las peticiones a `/api` hacia el backend, así que no hay CORS de por medio. `npm run dev` libera el puerto 5173 si está ocupado.

---

## Scripts

| Script | Qué hace |
| ------ | -------- |
| `npm run dev` | Servidor de desarrollo (puerto fijo 5173) |
| `npm run build` | `tsc -b` + build de producción en `dist/` |
| `npm run preview` | Sirve el build en `http://127.0.0.1:4173` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` sin generar el build |

---

## Variables de entorno

Todo lo que empieza con `VITE_` **llega al navegador**: aquí solo van valores públicos. Nunca pongas llaves ni cadenas de conexión.

| Variable | Descripción |
| -------- | ----------- |
| `VITE_SUPABASE_URL` | URL pública de Supabase para mostrar imágenes. Si falta, `vite.config.ts` toma `SUPABASE_URL` de `backend/.env.development` (con `npm run dev`) o de `backend/.env.production` (con `npm run build`) |
| `BACKEND_PROXY_URL` | Backend al que Vite redirige `/api` en desarrollo (por defecto `http://127.0.0.1:4000`) |

En producción, el servidor web que sirve `dist/` debe redirigir `/api` al backend en el mismo dominio, porque la sesión viaja en una cookie.

---

## Estructura

```
src/
├── main.tsx                # punto de entrada y QueryClientProvider
├── index.css               # Tailwind + variables CSS del tema
├── app/
│   ├── api.ts              # apiClient (Axios): cookies, token CSRF, manejo de 401
│   ├── providers.tsx       # ErrorBoundary, ThemeProvider, preferencias del negocio, Toaster
│   └── router.tsx          # router propio (sin React Router)
├── features/               # un módulo por dominio
│   └── <feature>/
│       ├── api/            # llamadas HTTP con apiClient
│       ├── hooks/          # useQuery / useMutation
│       ├── components/     # UI de la feature
│       ├── pages/          # pantallas que ensamblan todo
│       ├── types/          # tipos del dominio
│       └── index.ts        # exportaciones públicas
├── shared/
│   ├── assets/             # theme.ts (ThemeProvider, useTheme, paletas) y logos
│   ├── components/         # Button, Input, Select, Modal, Drawer, ConfirmDialog, ErrorBoundary, LazyView…
│   ├── constants/          # config.ts, routes.ts (APP_ROUTES)
│   ├── contexts/           # preferencias generales del negocio
│   ├── layouts/            # AuthLayout
│   └── utils/              # fechas, moneda, errores, imágenes, invalidación de queries
└── components/ui/          # íconos y primitivas de UI
```

### Features

| Feature | Contenido |
| ------- | --------- |
| `auth` | Login, store de sesión (`auth.store.ts`), `hasPermission` |
| `dashboard` | Pantalla principal: pestañas **Venta** (POS y caja), **Órdenes**, **Inventario** y **Administración**, según los permisos |
| `menu`, `orders`, `daily-orders`, `pending-payments`, `deliveries` | Toma de pedidos, pedidos del día, pagos pendientes y mandaditos |
| `products` | Catálogo de productos y categorías |
| `inventory` | Ingredientes, recetas, compras, proveedores, salidas, movimientos y conteos físicos |
| `expenses`, `income-statement` | Gastos y estado de resultados |
| `settings`, `users`, `roles`, `preferences` | Configuración: perfil, preferencias, preferencias del sistema, usuarios, roles, cortes de caja, gastos y sesión |

---

## Cómo funciona

### Navegación

No hay React Router. `app/router.tsx` decide qué mostrar según `window.location.pathname`: solo existen `/login`, `/dashboard` y `/settings`. Sin sesión todo redirige a `/login`, y cualquier otra ruta redirige a `/dashboard`. Dentro de cada pantalla, las secciones son pestañas.

Las vistas pesadas (Órdenes, Inventario, Administración, Configuración) se cargan bajo demanda con `React.lazy` y `LazyView`. Los vendors se separan en chunks estables (`vendor-react`, `vendor-motion`, `vendor-data`).

### Datos del servidor

- Todas las llamadas usan `apiClient` (`app/api.ts`) desde el archivo `api/` de cada feature. Los componentes nunca llaman a la API directamente.
- `apiClient` envía la cookie de sesión y, antes de cada `POST`/`PUT`/`PATCH`/`DELETE`, pide un token CSRF a `/api/auth/csrf`. Ante un 401 limpia la sesión y muestra "Sesión expirada".
- Estado del servidor con **TanStack Query** (`useQuery` / `useMutation`) dentro de los `hooks/` de cada feature; nada de `useState` + `useEffect` para cargar datos.
- Cuando una mutación mueve dinero o inventario (venta, cancelación, liquidación, gasto…), llama a `invalidateMoneyAndStockQueries(queryClient)` (`shared/utils/queryInvalidation.ts`) para refrescar caja, pedidos, inventario y estado de resultados a la vez.

### Sesión y permisos

- La sesión vive en una cookie HttpOnly que JavaScript no puede leer. El usuario actual se guarda en un store singleton (`features/auth/store/auth.store.ts`) que se sincroniza con el evento `auth:changed` de `window`.
- Para mostrar u ocultar UI se usa `hasPermission(currentUser, 'recurso.accion')` (`features/auth/utils/permissions.ts`). Es solo cosmética: **el backend es quien autoriza**.

### Notificaciones y errores

- Resultado de mutaciones con **sileo**: `sileo.success({ title, description })` / `sileo.error({ title, description })`.
- El mensaje de error se obtiene con `getErrorMessage(error, 'texto por defecto')` (`shared/utils/errors.ts`), que lee `response.data.message` del backend.
- `ErrorBoundary` envuelve las pantallas; si algo falla al renderizar, muestra un respaldo con el botón "Reintentar".
- Antes de acciones destructivas (eliminar, cancelar) se usa `ConfirmDialog`.

### Tema claro / oscuro

- `ThemeProvider` y `useTheme()` están en `shared/assets/theme.ts`. La preferencia se guarda en `localStorage` (`andy-theme`); si no hay ninguna, se usa la del sistema.
- Los colores son **variables CSS semánticas** (`--color-primary`, `--color-surface`, `--color-text-primary`, `--color-danger`…) definidas en `index.css`. **No se escriben colores fijos** en los componentes.

---

## Convenciones

1. Los **componentes** son presentacionales: reciben props y no llaman a la API ni tienen reglas de negocio.
2. Las **pages** ensamblan componentes, conectan hooks y manejan los estados de carga, error y vacío.
3. Los **hooks** encapsulan queries y mutaciones reutilizables.
4. **TypeScript estricto**: nada de `any`; se tipan props, estado y respuestas de la API.
5. **Sin datos ficticios** en el código de producción.
6. **Sin `localStorage` directo**: se accede mediante hooks o stores (el tema ya lo resuelve `useTheme`).
7. **Estilos con Tailwind** y las variables del tema; CSS propio solo si es necesario.
8. La app está optimizada para escritorio (≥ 1024 px) con patrones que funcionan en pantallas pequeñas.

---

## Pruebas

Las pruebas E2E del flujo completo (Playwright) están en el backend (`backend/test/e2e`) y levantan este Vite en el puerto 5173. Ver [backend/Readme.md](../backend/Readme.md#pruebas).

Antes de subir cambios de UI, revisa manualmente:

- [ ] La funcionalidad en tema claro y en tema oscuro
- [ ] Sin errores en la consola
- [ ] Las peticiones responden bien (pestaña Network)
- [ ] Validaciones de formularios y mensajes de error del backend en los toasts
- [ ] La UI se muestra u oculta según los permisos del usuario
- [ ] Estados de carga, vacío y error
- [ ] `npm run lint` y `npm run typecheck` sin errores
