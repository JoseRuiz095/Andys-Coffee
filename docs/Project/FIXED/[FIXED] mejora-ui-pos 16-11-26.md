# Mejora UI/UX del punto de venta (POS) — 16/11/2026

**Alcance:** solo presentación del menú de ventas (frontend). No se modificó lógica de negocio, backend, base de datos, contratos de API, cálculos, permisos ni el flujo de registro de la venta.

**Decisiones aprobadas por la propietaria:**
- **D1:** buscar en todo el menú.
- **D2:** ancho de hasta 1600 px, solo en Venta.
- **D3:** montos rápidos en el cobro en efectivo.
- **D4:** insignia con las unidades en la orden.

También pidió **precisión en tabletas**, en vertical y en horizontal.

## 1. Problema

La propietaria reportó dos problemas: espacio desaprovechado y elementos importantes que se pierden. Lo medimos con una prueba E2E nueva en 10 *viewports* reales: el tamaño de la pantalla menos las barras del navegador. El escenario fue una orden con 6 líneas.

| Medición (antes) | Tabletas verticales | Tabletas horizontales | Laptop 1366×657 | Escritorio 1920×969 |
|---|---|---|---|---|
| "Procesar orden" a la vista | **No** (0 %) | **No** | **No** | **No** |
| Productos completos visibles | 4–5 | 4–5 | 4–5 | 8 |
| Botones − / + del carrito | 28 px | 28 px | 28 px | 28 px |
| "Confirmar pago" (efectivo) | Sí | **Cortado o fuera** (0–67 %) | **Fuera** | Sí |
| Sabores visibles en una familia de 7 | 2–3 (el resto oculto con desplazamiento lateral) | igual | igual | igual |

**Causas en el código:**
- **Contenedor angosto y panel desproporcionado.** El contenido mide como máximo 1280 px y el carrito ocupa el 44 % del ancho.
- **Rellenos duplicados.** Página, tarjeta, buscador con marco propio y tarjetas de producto tienen cada uno su relleno.
- **Tarjetas altas.** Cada una mide unos 212 px.
- **Total y cobro al final de un panel largo.** El panel de la orden ponía primero los datos del cliente, con notas de 3 filas, y dejaba el total y "Procesar orden" al final.
- **Total sin jerarquía.** Usaba el mismo tamaño que los títulos.
- **Método de pago oculto.** Estaba en un `select`.
- **Sabores en una tira horizontal.** En el modal de familia solo se veían algunos.
- **Notificaciones encima del cobro.** Salían abajo a la derecha y tapaban "Procesar orden" 4–5 s después de cada venta.

## 2. Cambios

| Archivo | Cambio |
|---|---|
| `frontend/src/index.css` | Variante `pos-fit` (≥768 px de ancho y ≥560 px de alto). En Venta, la pantalla se ajusta a la ventana: el menú y la orden se desplazan dentro de sus paneles. Con menos de 560 px de alto, la página se desplaza completa, como antes |
| `features/dashboard/pages/DashboardPage.tsx` | Solo en Venta: alto de ventana, ancho máximo de 1600 px y rejilla `menú flexible + orden de 20/22.5/25 rem` (md/lg/xl). El error del menú usa `QueryErrorState` con "Reintentar". El mapa de unidades por producto alimenta la insignia. Handlers, cotización y envío sin cambios |
| `features/dashboard/components/DashboardHeader.tsx` | Unos 70 px de alto (antes ~93). Controles de 44 px en pantallas táctiles. Con 4 secciones, la navegación ocupa su propia fila en tableta vertical. Ancho alineado con el contenido |
| `features/menu/components/MenuSection.tsx` | Barra única con categorías en píldoras que **se acomodan en varias filas** (ninguna queda oculta) y el buscador (al lado desde 1024 px). Rejilla fija de **4 columnas** (17/11: 4×2 a la vista en tableta horizontal, laptop y escritorio; los productos nuevos solo agregan filas hacia abajo). Se mide por el ancho del panel del menú (container query): 3 columnas en tableta vertical. Banda de foto 16:9 con 4 columnas y 4:3 con 3; la foto siempre va en un recuadro cuadrado centrado. **Búsqueda en todo el menú** (sin distinguir acentos), con la categoría en cada resultado, contador, botón para limpiar y tecla Esc. El esqueleto de carga coincide con la rejilla |
| `features/menu/components/MenuProductCards.tsx` | Tarjetas de tamaño legible para tableta, a petición de la propietaria: columna mínima de 10.5 rem, foto en un recuadro cuadrado centrado (fondo `--color-image-tile`, `object-contain`) que muestra el producto completo con el mismo encuadre en cualquier ancho, nombre de 15 px en 2 líneas y precio de 18 px en negrita. "desde $X" en familias. Etiqueta "N opciones" sobre la foto. **Insignia con las unidades en la orden** y borde de color cuando el producto ya está agregado. Foco visible |
| `features/menu/utils/menuSearch.ts` (+ prueba) | Búsqueda normalizada en todas las categorías; clave común para el producto y su línea en la orden |
| `features/dashboard/components/OrderDetailsPanel.tsx` | Tres zonas. **Cabecera:** cliente (obligatorio si el pago es pendiente), método de pago y los chips "Nota" y "¿Mandadito?". **Lista:** con desplazamiento propio; muestra la línea nueva al agregarla. **Pie fijo:** subtotal, promociones, **total en `text-2xl`**, "Programar pedido" (secundario) y **"Procesar orden"** (principal, 48 px). Mismas props |
| `features/dashboard/components/PaymentMethodSelector.tsx` (nuevo) | Los 4 métodos como botones siempre visibles (antes un `select`). Mismos valores |
| `features/dashboard/components/OrderCartLine.tsx` (nuevo) | Línea compacta. Botones −, +, nota y eliminar de 40 px (44 px en pantalla táctil), con los **mismos `aria-label`**. Precio unitario solo cuando la cantidad es mayor a 1 |
| `features/dashboard/components/DeliveryOptions.tsx` (nuevo) | Mandadito: mismos campos y valores. Cada opción es una fila táctil completa |
| `features/dashboard/components/CashPaymentDialog.tsx` | Dos columnas (montos a la izquierda, teclado a la derecha) para caber en tableta horizontal. **Montos rápidos**: "Exacto" más los billetes que cubren el total. Teclas de 48–52 px. Acciones fijas al pie |
| `features/dashboard/utils/quickCash.ts` (+ prueba) | Billetes sugeridos y formato del monto exacto |
| `features/menu/components/ProductFamilyModal.tsx`, `ProductExtrasModal.tsx`, `ExtrasPicker.tsx` | Sabores en rejilla de 2–3 columnas (todos visibles). Opciones de 44 px en pantalla táctil. Botones `Button`. Acciones fijas al pie. El token inexistente `--color-primary-soft` se reemplazó por `color-mix` |
| `shared/components/ProductImage.tsx`, `shared/assets/theme.ts`, `index.css` | Prop `fit` (`cover` por defecto; `contain` en el POS). Nuevo token `--color-image-tile` (blanco en ambos temas, sincronizado con `themePalettes`): las 30 fotos del menú son recortes cuadrados, 16 con fondo transparente y 14 con fondo blanco, y así se ven iguales en los dos temas. Las miniaturas del carrito y del modal de sabores usan el mismo recuadro (en el tema oscuro tenían fondo dorado) |
| Tipografía del menú (a petición de la propietaria) | Un escalón más grande: categorías y secciones del encabezado a 16 px, nombre del producto a 16 px, precio a 20 px, buscador y datos de la orden a 15 px, métodos de pago a 13 px. En pantallas anchas el buscador mide 224 px para que las categorías quepan en una fila |
| `components/ui/dialog.tsx` | Props opcionales `size` en `Dialog` y `sticky` en `DialogFooter`. Los demás diálogos no cambian |
| `app/providers.tsx` | **Notificaciones arriba al centro** (antes abajo a la derecha, encima de "Procesar orden"). Afecta a toda la aplicación |

### Lo que no cambió
- Cálculo de importes, cotización con el servidor, promociones, extras, idempotencia y validaciones de la venta.
- Métodos de pago y mandadito: mismos valores y mismas reglas.
- Programación de pedidos, nota por línea, apertura y cierre de caja, demás vistas y permisos.
- Textos de las acciones y nombres accesibles que usan las pruebas.

## 3. Resultado

Medición con la misma prueba, la misma orden de 6 líneas y 6 categorías (`backend/test/e2e/pos-layout.e2e.spec.ts`):

| Viewport | Total y "Procesar orden" | Tarjetas completas visibles | − / + | Sabores | "Confirmar pago" |
|---|---|---|---|---|---|
| iPad 9 vertical 810×1006 | Sí | ≥ 6 (antes 4) | 44 px | 7/7 | Sí |
| iPad mini vertical 768×954 | Sí | ≥ 6 (antes 4) | 44 px | 7/7 | Sí |
| iPad Air vertical 820×1106 | Sí | ≥ 6 | 44 px | 7/7 | Sí |
| Android vertical 800×1150 | Sí | ≥ 6 | 44 px | 7/7 | Sí |
| iPad mini horizontal 1024×698 | Sí | ≥ 6 (antes 4) | 44 px | 7/7 | Sí (antes no) |
| iPad 9 horizontal 1080×736 | Sí | ≥ 6 | 44 px | 7/7 | Sí (antes 46 %) |
| iPad Air horizontal 1180×746 | Sí | ≥ 8 | 44 px | 7/7 | Sí (antes 67 %) |
| Android horizontal 1280×670 | Sí | ≥ 8 | 44 px | 7/7 | Sí (antes no) |
| Laptop 1366×657 | Sí | ≥ 10 | 40 px | 7/7 | Sí (antes no) |
| Escritorio 1920×969 | Sí | ≥ 18 (antes 8) | 40 px | 7/7 | Sí |

Además, en todas las resoluciones: sin desplazamiento horizontal, sin errores de consola desde el POS, y el tema claro y el oscuro revisados en capturas.

La prueba usa las fotos reales de `backend/assets/menu-images`: intercepta las URLs de Storage. Para regenerar las capturas: `POS_SHOTS=<carpeta> npx playwright test test/e2e/pos-layout.e2e.spec.ts --workers=1`. Quedan en `backend/test-results/pos-layout/<carpeta>/` con cuatro estados (orden vacía, 6 líneas, familia, cobro), en claro y oscuro (`antes/` es la línea base).

**Tamaño de las tarjetas:** una primera versión usaba tarjetas más compactas (foto de 72 px), con las que cabían 8 en tableta vertical y 12 en iPad Air horizontal. La propietaria pidió tarjetas más grandes y fotos que no se descuadren, así que se priorizó la legibilidad. Antes, la foto ocupaba una franja de alto fijo con `object-cover`, y según el ancho de la tarjeta se cortaba la tapa o la base de los vasos. Ahora caben 6 tarjetas en tableta (2 filas en horizontal, 3 en vertical), 10 en laptop y 18 en escritorio. El total y el cobro siguen siempre a la vista. Con más de 4 categorías, las píldoras ocupan 2 filas en tableta, a cambio de que ninguna quede oculta.

## 4. Pruebas

| Suite | Resultado |
|---|---|
| Frontend `lint`, `tsc -b`, `build` | OK |
| Vitest | 114/114 (antes 100). Nuevos: `menuSearch`, `quickCash`, `OrderDetailsPanel` y montos rápidos de `CashPaymentDialog` |
| E2E completa (`--workers=1`) | Las 35 previas pasan |
| E2E `pos-layout` (nueva, 10 viewports) | 10/10, repetida tras agrandar las tarjetas (con `sales-cash`: 13/13) |

**Notas de entorno:**
- En Windows, Vitest debe ejecutarse desde `F:\` (PowerShell). Desde `f:\` en minúscula, todos los archivos fallan con "failed to find the current suite".
- La prueba `pos-layout` inicia sesión una sola vez, porque el limitador permite 5 intentos por usuario cada 15 minutos.

## 5. Hallazgo pendiente de decisión

`frontend/src/index.css` declara `button, input { font: inherit; }` **fuera de toda capa CSS** desde el commit inicial. Las utilidades de Tailwind viven en una capa, así que esa regla se impone a `text-sm`, `font-bold`, `leading-*`, etc. en **todos los botones y campos de la aplicación**: heredan la tipografía del contenedor. Por ejemplo, el `Button` compartido declara `text-sm font-bold`, pero ninguna de las dos se aplica.

- **En el POS** se resolvió localmente: la tipografía va en el contenedor, en un `<span>` interno o en estilo en línea (anotado en `CLAUDE.md`).
- **Corrección global recomendada:** mover la regla a `@layer base` (Tailwind ya hace lo mismo en su *preflight*). Hace efectivas las clases en todas las pantallas, pero cambia el tamaño y el peso del texto de los botones en toda la aplicación. Por eso requiere aprobación y una revisión visual de las demás pantallas.

## 6. Revisión manual sugerida

En una tableta real, en vertical y en horizontal y con ambos temas:
1. Agregar productos, sumar, restar y eliminar unidades.
2. Nota por línea y nota de la orden.
3. Familia con temperatura, sabor, Jumbo y extras.
4. Promoción 2x1.
5. Efectivo con "Exacto" y con un billete; transferencia; tarjeta; pendiente con nombre.
6. Mandadito en sus 3 modalidades.
7. Programar un pedido.
8. Buscar sin acento ("cafe") desde cualquier categoría.
