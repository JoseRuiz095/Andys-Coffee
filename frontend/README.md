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
| `npm run test` | Pruebas unitarias y de componentes (Vitest + Testing Library) |
| `npm run test:watch` | Vitest en modo observación |

---

## Variables de entorno

Todo lo que empieza con `VITE_` **llega al navegador**: aquí solo van valores públicos. Nunca pongas llaves ni cadenas de conexión.

| Variable | Descripción |
| -------- | ----------- |
| `BACKEND_PROXY_URL` | Backend al que Vite redirige `/api` en desarrollo (por defecto `http://127.0.0.1:4000`) |

En producción, el servidor web que sirve `dist/` debe redirigir `/api` al backend en el mismo dominio, porque la sesión viaja en una cookie.

---

## Estructura

```
src/
├── main.tsx                # punto de entrada y QueryClientProvider
├── index.css               # Tailwind + variables CSS del tema
├── app/
│   ├── api.ts              # apiClient (Axios): cookies, token CSRF, timeout, manejo de 401
│   ├── queryClient.ts      # QueryClient compartido (política de reintentos)
│   ├── navigation.ts       # navigateTo() del router propio
│   ├── providers.tsx       # ErrorBoundary, MotionConfig, ThemeProvider, preferencias del negocio, Toaster
│   └── router.tsx          # router propio (sin React Router)
├── features/               # un módulo por dominio
│   └── <feature>/
│       ├── api/            # llamadas HTTP con apiClient
│       ├── hooks/          # useQuery / useMutation
│       ├── components/     # UI de la feature
│       ├── pages/          # pantallas que ensamblan todo
│       ├── utils/          # lógica pura de la feature (con pruebas *.test.ts)
│       └── types/          # tipos del dominio
├── shared/
│   ├── assets/             # theme.ts (ThemeProvider, useTheme, paletas) y logos
│   ├── components/         # Button, Input, Select, Modal, Drawer, ConfirmDialog, PageHeader, FormField, FilterBar, SectionTabs, SegmentedTabs, RowActions, PermissionNotice, Pagination, QueryErrorState, ErrorBoundary, LazyView…
│   ├── hooks/              # useUrlParam, useFocusTrap, useDebouncedValue, useSessionState, usePrevious…
│   ├── constants/          # config.ts, routes.ts (APP_ROUTES)
│   ├── contexts/           # preferencias generales del negocio
│   ├── layouts/            # AuthLayout
│   └── utils/              # fechas, moneda, números, errores, imágenes, invalidación de queries, lazyWithReload
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

No hay React Router. `app/router.tsx` decide qué mostrar según `window.location.pathname`: solo existen `/login`, `/dashboard` y `/settings`. Sin sesión todo redirige a `/login`, y cualquier otra ruta redirige a `/dashboard`. Para navegar se usa `navigateTo()` (`app/navigation.ts`).

Las pestañas viven en la URL con `useUrlParam` (`shared/hooks/useUrlParam.ts`): `?view=venta|ordenes|inventario|admin`, `&inv=…` (Inventario), `&gestion=…` (Gestión), `&admin=…` (Administración) y `/settings?tab=…`. Recargar conserva la pantalla, el botón Atrás regresa a la pestaña anterior y un enlace a una pestaña sin permiso cae en la primera permitida.

Las vistas pesadas (Órdenes, Inventario, Administración, Configuración) se cargan bajo demanda con `lazyWithReload` y `LazyView`: si tras un deploy el navegador pide un chunk que ya no existe, la página se recarga una vez; cada vista tiene su propio `ErrorBoundary`. Los vendors se separan en chunks estables (`vendor-react`, `vendor-motion`, `vendor-data`).

### Datos del servidor

- Todas las llamadas usan `apiClient` (`app/api.ts`) desde el archivo `api/` de cada feature. Los componentes nunca llaman a la API directamente.
- `apiClient` envía la cookie de sesión y, antes de cada `POST`/`PUT`/`PATCH`/`DELETE`, pide un token CSRF a `/api/auth/csrf`. Las peticiones tienen un timeout de 20 s (2 min para subir fotos). Un 401 con sesión activa (que no sea el propio login) limpia la sesión, vacía la caché de consultas y muestra "Sesión expirada" una sola vez.
- `app/queryClient.ts` no reintenta errores 4xx; los de red y 5xx se reintentan hasta dos veces. Las mutaciones nunca se reintentan solas.
- Estado del servidor con **TanStack Query** (`useQuery` / `useMutation`) dentro de los `hooks/` de cada feature; nada de `useState` + `useEffect` para cargar datos.
- Una lista que falla muestra `QueryErrorState` (mensaje del servidor + "Reintentar"), **nunca** el estado vacío. Las listas paginadas usan `Pagination`. Un formulario de configuración que no carga tampoco muestra valores por defecto que se puedan guardar.
- Cada pantalla abre con `PageHeader` (título, una línea y la acción principal a la derecha); los filtros van en `FilterBar`, las acciones de fila en `RowActions` y los campos de formulario en `FormField` (label asociado y error junto al campo). Los módulos con varias pantallas usan `SectionTabs` (secciones) + `SegmentedTabs` (vistas de una sección).
- Cuando una mutación mueve dinero o inventario (venta, cancelación, liquidación, compra recibida, conteo aplicado, apertura o cierre de caja, gasto…), llama a `invalidateMoneyAndStockQueries(queryClient)` (`shared/utils/queryInvalidation.ts`) para refrescar caja, pedidos, inventario y estado de resultados a la vez.

### Sesión y permisos

- La sesión vive en una cookie HttpOnly que JavaScript no puede leer. El usuario actual se guarda en un store singleton (`features/auth/store/auth.store.ts`) que se sincroniza con el evento `auth:changed` de `window`; los componentes lo leen con `useCurrentUser()`, que se actualiza al iniciar o cerrar sesión y cuando cambian los permisos (la sesión se revalida cada 30 min, al instante si editas tu propio rol y, como máximo una vez por minuto, después de un 403).
- Al cerrar sesión se vacía la caché de React Query: en una terminal compartida, el siguiente usuario no ve datos del anterior.
- Para mostrar u ocultar UI se usa `hasPermission(currentUser, 'recurso.accion')` (`features/auth/utils/permissions.ts`). Es solo cosmética: **el backend es quien autoriza**.
- Las reglas de roles del backend (nadie otorga un permiso que no tiene; los roles del sistema requieren `roles.manage_system_permissions`; un rol solo se asigna si el actor tiene todos sus permisos) están replicadas en `features/roles/utils/permissionRules.ts`: la interfaz ofrece solo lo que el servidor acepta. Las etiquetas y notas legibles de cada permiso están en `features/roles/utils/permissionGroups.ts`.
- Sin permiso para una acción, se oculta el botón; si la pantalla entera es un formulario, se muestra `PermissionNotice` y los campos quedan de solo lectura.

### Notificaciones y errores

- Resultado de mutaciones con **sileo**: `sileo.success({ title, description })` / `sileo.error({ title, description })`.
- El mensaje de error se obtiene con `getErrorMessage(error, 'texto por defecto')` (`shared/utils/errors.ts`), que lee `response.data.message` del backend.
- `ErrorBoundary` envuelve la app y cada vista cargada bajo demanda; si algo falla al renderizar, muestra un respaldo con "Reintentar" y "Recargar página".
- Antes de acciones destructivas o difíciles de deshacer (eliminar, cancelar, desactivar, completar un conteo, corregir un corte) se usa `ConfirmDialog`.
- Los diálogos (`Modal`, `Drawer`, `ConfirmDialog` y el `Dialog` de `components/ui/dialog.tsx`, que envuelve a `Modal`) atrapan el foco, se cierran con Escape y devuelven el foco al botón que los abrió.

### Tema claro / oscuro

- `ThemeProvider` y `useTheme()` están en `shared/assets/theme.ts`. La preferencia se guarda en `localStorage` (`andy-theme`); si no hay ninguna, se usa la del sistema.
- Los colores son **variables CSS semánticas** (`--color-primary`, `--color-surface`, `--color-text-primary`, `--color-danger`…) definidas **solo** en `index.css`; `themePalettes` (en `theme.ts`) es una copia para los componentes que necesitan el color en JS, y `theme.test.ts` verifica que coincidan. Las sombras de marca también son variables (`--shadow-card`, `--shadow-panel`, `--shadow-header`, `--shadow-popover`).
- **No se escriben colores fijos** en los componentes (ni clases de paleta de Tailwind como `bg-red-50`): los tonos suaves se arman con `color-mix(in srgb, var(--color-…) 10%, var(--color-surface))`. El texto sobre botones de color usa `--color-button-text`.

### Imágenes del menú

- La API devuelve `imageUrl` como URL pública (Supabase Storage) o `null`. El frontend no conoce el bucket ni tiene llaves.
- `shared/components/ProductImage.tsx` pinta todas las fotos de productos (menú de ventas, diálogo de variantes, panel de la orden y catálogo de Inventario): carga diferida, `object-cover` dentro de una caja de tamaño fijo y el logo como respaldo si no hay imagen o falla la descarga.
- En Inventario → Productos, `ProductImageField` permite elegir una foto, verla antes de subirla, confirmarla o cancelarla, reemplazarla y quitarla (con confirmación). En un producto nuevo la foto se sube justo después de crearlo. Al terminar se invalidan las consultas `products` y `menu`.
- El servidor valida, optimiza y convierte a WebP; las validaciones del navegador (tipo y 10 MB) son solo una ayuda.

---

## Convenciones

1. Los **componentes** son presentacionales: reciben props y no llaman a la API ni tienen reglas de negocio.
2. Las **pages** ensamblan componentes, conectan hooks y manejan los estados de carga, error y vacío.
3. Los **hooks** encapsulan queries y mutaciones reutilizables.
4. **TypeScript estricto**: nada de `any`; se tipan props, estado y respuestas de la API.
5. **Sin datos ficticios** en el código de producción.
6. **Sin `localStorage` directo**: se accede mediante hooks o stores (el tema ya lo resuelve `useTheme`).
7. **Estilos con Tailwind** y las variables del tema; CSS propio solo si es necesario.
8. La app funciona en escritorio y tablet (ancho mínimo 768 px). En la pantalla de venta, menú y orden van lado a lado desde `md` y el panel de la orden queda fijo a la vista.

---

## Producción (Vercel)

Se despliega en Vercel (Root Directory `frontend`). `vercel.json` redirige `/api/*` al backend de Render (proxy same-origin para que las cookies de sesión sigan siendo first-party) y hace el fallback SPA a `index.html`. Detalles: [docs/Project/deployment.md](../docs/Project/deployment.md).

## Pruebas

- **Unitarias y de componentes** (Vitest + Testing Library, `npm run test`): archivos `*.test.ts(x)` junto al código. Cubren lógica pura (moneda, fechas, paginación, validaciones de venta y de compra, familias del menú) y componentes críticos (cobro en efectivo, corte de caja, gastos, diálogos). CI las corre en cada push.
- **E2E** (Playwright) en el backend (`backend/test/e2e`); levantan este Vite en el puerto 5173 contra la base de pruebas en Docker. `support/app-harness.ts` arranca la app y crea usuarios con permisos exactos. Ver [backend/Readme.md](../backend/Readme.md#pruebas).

Antes de subir cambios de UI, revisa manualmente:

- [ ] La funcionalidad en tema claro y en tema oscuro
- [ ] Sin errores en la consola
- [ ] Las peticiones responden bien (pestaña Network)
- [ ] Validaciones de formularios y mensajes de error del backend en los toasts
- [ ] La UI se muestra u oculta según los permisos del usuario
- [ ] Estados de carga, vacío y error
- [ ] En tablet (768 × 1024) y en escritorio
- [ ] `npm run lint`, `npm run typecheck` y `npm run test` sin errores
