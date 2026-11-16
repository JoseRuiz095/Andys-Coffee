# Auditoría UX/UI y simplificación del módulo de Inventario

| | |
|---|---|
| **Fecha de realización** | 13 de noviembre de 2026 |
| **Alcance** | Solo el frontend del módulo de Inventario (`frontend/src/features/inventory`, `features/extras`) y los componentes compartidos que usa |
| **Origen** | Feedback del usuario principal: *"La interfaz de inventario está demasiado cargada; algunos textos se pierden y cuesta identificar las opciones importantes."* |
| **Fuera de alcance** | Backend, base de datos, contratos de API, permisos y reglas de negocio. No se modificaron |
| **Estado** | Fases 0–6 ejecutadas. Los pendientes se listan en §8 |

---

## 1. Diagnóstico (antes)

La saturación tenía causas estructurales, no solo estéticas.

1. **Navegación de 12 destinos en dos niveles:** 8 pestañas más 4 subpestañas en "Gestión".
   - Las compras estaban repartidas en tres pestañas (Agregar Entrada, Entradas y Reabastecimiento).
   - "Inventario Actual" y "Gestión → Ingredientes" mostraban casi la misma tabla.
   - En tablet las pestañas no cabían.
2. **Inventario Actual ponía unos 9 bloques antes de la tabla:**
   - 4 tarjetas KPI más el "Valor total".
   - Dos interruptores de configuración que solo un admin puede cambiar, pero que todos veían deshabilitados.
   - Una lista de alertas **sin límite**.
   - Los productos sin receta.
   - Una tarjeta de filtros con chips que repetían los valores de los campos.
3. **El color no indicaba gravedad:** "Stock Bajo" y "Agotados" iban en el mismo verde que "Stock Normal".
4. **Textos y estructura:**
   - Textos operativos a 12 px (al menos 48 usos).
   - Títulos de 30 px que repetían el nombre de la pestaña.
   - Seis páginas con su propio `min-h-screen p-6` dentro del contenedor del dashboard.
   - 26 animaciones escalonadas.
5. **Formularios:**
   - El modal de producto mostraba a la vez unos 15 campos más familia, opciones, extras, receta e imagen.
   - A quien no tenía permiso se le mostraban formularios deshabilitados.
6. **Tablas de 8 a 9 columnas,** con datos de consulta ocasional siempre visibles. Además, Existencias tenía en el pie un "Valor total del inventario" que **sumaba solo la página visible**, distinto del total real.

## 2. Principios aplicados

- **Misma identidad visual:** misma paleta, tipografía, radios y sombras; los cambios son evolutivos.
- **Sin pérdida de capacidades:** cada función conserva un lugar documentado (§5).
- **Una sola capa de título** (la pestaña ya dice dónde estás) y **una acción primaria por pantalla**.
- **Color solo con significado:** rojo = agotado o error, ámbar = atención, verde = correcto o acción principal.
- **Tamaños de texto:** mínimo 14 px para lo que el usuario debe leer; 12 px solo para metadatos (SKU, unidades, contadores).
- **Sin permiso:** un aviso compacto en lugar de un formulario deshabilitado; las listas de consulta siguen visibles.

---

## 3. Navegación: antes y después

```
ANTES                                            DESPUÉS
Inventario Actual                                Existencias
Gestión de Inventario ─┬ Productos               Compras ──── [Por recibir] [Nueva compra] [Sugerencias]
                       ├ Extras                  Ajustes ──── [Salidas] [Conteos]
                       ├ Ingredientes            Movimientos
                       └ Proveedores             Catálogo ─── [Productos] [Extras] [Ingredientes] [Proveedores]
Agregar Entrada
Entradas
Movimientos
Conteos Físicos
Salidas Manuales
Reabastecimiento
```

- Ninguna vista se eliminó: son los mismos componentes `pages/*`.
- La URL sigue siendo `?view=inventario&inv=<vista>` con **los mismos ids** (`current`, `entries`, `add-entry`, `replenishment`, `exits`, `physical`, `movements`, `management` + `&gestion=…`). La sección activa se deduce de la vista, así que los enlaces antiguos siguen funcionando, junto con recargar y "Atrás".
- El selector segmentado (`shared/components/SegmentedTabs.tsx`) es accesible: `role="tablist"`, ←/→, Inicio/Fin y foco itinerante.

---

## 4. Cambios realizados por fase

### Fase 0 — Red de seguridad (antes de tocar la UI)
- **`backend/test/e2e/inventory.e2e.spec.ts`:** 6 casos que congelan el comportamiento: existencias y búsqueda; compra → recepción → stock; salida manual; conteo físico completo; alta y desactivación de ingrediente; avisos sin permiso.
- **`backend/test/e2e/support/app-harness.ts`:** `createIngredientFactory`, y limpieza de compras y conteos creados por los usuarios de prueba.

### Fase 1 — Legibilidad crítica
| ID | Cambio | Archivos |
|---|---|---|
| INV-01 | Bajo y Agotados en ámbar y rojo | `pages/InventoryCurrent.tsx` (después, `StockSummaryStrip`) |
| INV-02 | 24 textos operativos de 12 → 14 px (resultados de búsqueda, conversión, ayudas, similares) | AddEntry, Entries, Physical, Movements, IngredientFormModal, SupplierFormModal, ProductsTab |
| INV-04 / INV-40 | `PermissionNotice` en lugar de banner + formulario deshabilitado; las listas siguen visibles | `components/PermissionNotice.tsx`; AddEntry, Exits, Physical, Entries |
| INV-44 | 40 etiquetas asociadas a su campo (`htmlFor` + `id`) | 10 archivos del módulo |

### Fase 2 — Menos saturación
| ID | Cambio | Archivos |
|---|---|---|
| INV-05/06 | Franja compacta de 5 indicadores; Normal, Bajo y Agotados **filtran la tabla** al hacer clic | `components/StockSummaryStrip.tsx` |
| INV-07 | Un solo aviso plegable "Requiere atención" (insumos en mínimo + productos sin receta), con un máximo de 5 por grupo y accesos directos; se oculta si no hay nada que avisar | `components/InventoryAttention.tsx` (reemplaza `InventoryAlerts` y `ProductsWithoutRecipe`) |
| INV-08 | Interruptores en el menú "Ajustes del inventario"; editables con `users.update` y en solo lectura sin ese permiso | `components/InventorySettingsCard.tsx` → `InventorySettingsMenu` |
| INV-09 / INV-41 | Filtros en una línea + "Limpiar filtros" condicional, sin chips duplicados | `shared/components/FilterBar.tsx`, `shared/constants/fieldStyles.ts` |
| INV-10 | Tabla de existencias de 6 columnas (SKU bajo el nombre; la variación respecto al mínimo en el `title` del estado); se retira el pie engañoso | `components/InventoryTable.tsx` |
| INV-17 | "Información útil" (3 tarjetas) pasa a una línea de resumen en el encabezado | `pages/InventoryEntries.tsx` |
| INV-25/26 | Detalle de conteo: metadatos en una línea, "← Volver a los conteos" y "Cancelar conteo" como acción secundaria | `pages/InventoryPhysical.tsx` |
| INV-27/28 | Movimientos: `FilterBar` y tabla de 6 columnas; costo unitario y usuario en un **detalle expandible** por fila | `pages/InventoryMovements.tsx` |
| INV-43 | Se eliminó `InventoryStats.tsx`, que no tenía uso | — |

### Fase 3 — Navegación e interacción
| ID | Cambio | Archivos |
|---|---|---|
| INV-15/16/42 | 5 secciones con selector segmentado; URL compatible | `pages/InventoryLayout.tsx`, `shared/components/SegmentedTabs.tsx` |
| INV-19 | "+ Nueva compra" en Por recibir | `pages/InventoryEntries.tsx` |
| INV-20 | Nueva compra en secciones "1. Proveedor (opcional)" y "2. Insumos"; notas plegables (se abren si el borrador ya las tiene) | `pages/InventoryAddEntry.tsx` |
| INV-21/22 | Sugerencias: 6 columnas (stock bajo el insumo; consumo y mín/máx bajo la cobertura); "ver en Por recibir" tras crear borradores | `pages/InventoryReplenishment.tsx` |
| INV-23/24 | Salidas: "Disponible" como ayuda bajo Cantidad (`aria-describedby`); notas plegables | `pages/InventoryExits.tsx` |
| INV-29 | Catálogo sin el segundo `h1`; las subpestañas usan `SegmentedTabs` (con íconos) | `pages/InventoryManagementPage.tsx` |
| INV-30/31/03 | Productos: "+ Nuevo producto" como acción primaria y "Categorías" en contorno; tabla de 6 columnas; estado como insignia; acciones de fila con `RowActions` | `components/tabs/ProductsTable.tsx`, `shared/components/RowActions.tsx` |
| INV-32 | Modal de producto en secciones: **Datos básicos**, **Precio y costo**, **Receta** y **Opciones de venta** (familia, variantes, extras) plegable. Esta última se abre sola si el producto ya usa alguna opción | `components/tabs/ProductsTab.tsx` |
| INV-33 | Tabla extraída a `ProductsTable` (parcial; ver §8) | `components/tabs/ProductsTable.tsx` |

### Fase 4 — Consistencia visual
| ID | Cambio | Archivos |
|---|---|---|
| INV-11 | `InventoryPageHeader` (título de 20 px, una línea de descripción, acciones a la derecha) en las 12 vistas | `components/InventoryPageHeader.tsx` |
| INV-12/13 | Sin `min-h-screen p-6` ni fondos propios; sin animaciones escalonadas por bloque (queda la transición entre secciones) | Páginas del módulo |
| INV-14 | Sin emojis decorativos (⚙️ 🔍 🏷️ ✅ ✓ 🔴🟡🟢) | Varias |
| INV-18 | Recibir y cancelar compra con `ConfirmDialog` (mismos textos y bloqueo durante el envío) | `pages/InventoryEntries.tsx` |
| INV-34/35/36 | Ingredientes y Proveedores: `FilterBar`, nombre con SKU o dirección debajo, insignia de estado y `RowActions`; el stock actual sigue disponible en Ingredientes (columna desde `lg`) | `components/tabs/IngredientsTab.tsx`, `SuppliersTab.tsx` |
| INV-37 | Extras con el mismo patrón (encabezado, insignia, acciones) | `features/extras/components/ExtrasTab.tsx` |
| INV-38 | `QueryErrorState` en Existencias, Movimientos, Ingredientes, Proveedores, Extras y Por recibir | Varias |

### Fase 5 — Refactor puntual
- Los `motion.*` que ya no animaban pasan a elementos HTML; `framer-motion` queda solo en la transición entre secciones (`InventoryLayout`).
- El módulo pasó de **~7 270 a ~6 300 líneas**, con menos duplicación de filtros, tablas, encabezados y confirmaciones.

### Fase 6 — QA y validación
- **E2E nuevos** en `inventory.e2e.spec.ts`:
  - Indicadores que filtran la tabla y "Limpiar filtros".
  - Menú de ajustes en solo lectura sin `users.update` y cierre con Escape.
  - Enlaces antiguos → sección y vista correctas (`add-entry`, `replenishment`, `physical`, `exits`, `management&gestion=suppliers`).
  - Flechas en el selector segmentado.
  - Detalle expandible de Movimientos.
- **E2E actualizados** por los nuevos nombres de navegación: `app-shell` (Compras → Nueva compra → reload → Atrás) y `product-recipe` (pestaña "Catálogo", botón "+ Nuevo producto").
- **Vitest:** `SegmentedTabs.test.tsx` (clic, flechas y foco itinerante).
- **Puertos de E2E configurables** (`E2E_BACKEND_PORT`, `E2E_FRONTEND_PORT`, por defecto 4000/5173) en el harness y en todos los specs (`product-recipe`, `navigation-smoke`, `cash-history`, `sec-003`, `sec-006`). Así se pueden correr con los servidores de desarrollo encendidos; CI no cambia.

---

## 5. Conservación de funcionalidades

| Capacidad | Dónde está ahora |
|---|---|
| Totales del inventario (ingredientes, normal, bajo, agotados, valor) | Franja de Existencias (datos del servidor) |
| Lista de insumos en mínimo y de productos sin receta | Aviso "Requiere atención" → "Ver" (5 por grupo) → "Ver en la tabla" / "Catálogo → Productos" |
| Interruptores "Descontar inventario al vender" y "Avisar stock bajo" | Existencias → "Ajustes del inventario" (mismo permiso `users.update`) |
| Variación respecto al mínimo | `title` de la insignia de estado en la tabla de existencias |
| Costo unitario y usuario de un movimiento | Movimientos → "Detalle" en la fila |
| Mín/Máx y consumo diario en Sugerencias | Bajo la cobertura, en la misma fila |
| Dirección del proveedor | Bajo el nombre del proveedor |
| Stock actual en Ingredientes | Columna "Stock actual" (desde `lg`) |
| Familia, variantes, opciones y extras del producto | Modal de producto → "Opciones de venta" (abierta si tiene datos) |
| Notas de compra y de salida | "+ Agregar notas" (abiertas si ya tienen texto) |
| Todas las acciones (crear, editar, activar/desactivar, eliminar, recibir, cancelar, completar, aplicar) | Mismas acciones, confirmaciones y permisos; ahora con `RowActions` / `ConfirmDialog` |

No se modificaron endpoints, hooks de datos, validaciones, cálculos ni permisos.

---

## 6. Hallazgos adicionales resueltos durante la ejecución

- **Producto sin control de permiso en la UI.** Cualquier usuario veía activo el botón de activar o desactivar un producto, aunque el backend exige `products.update`. Ahora la acción solo aparece con ese permiso; es la misma regla que ya aplicaba el backend.
- **Total engañoso.** El pie "Valor Total del Inventario" de la tabla sumaba solo la página visible. Se retiró: el valor real está en la franja de resumen.
- **Error en desarrollo al abrir Administración.** La primera vez que se abría, la vista fallaba con "Hay una versión nueva…". La causa era `504 Outdated Optimize Dep` de `recharts`: Vite lo descubría tarde porque solo se importa desde una vista lazy. Se añadió `optimizeDeps.include: ['recharts']` en `frontend/vite.config.ts`.
- **Rate limit en los E2E.** Las pruebas reutilizaban el mismo usuario en más de 5 inicios de sesión dentro de 15 minutos. Se separaron usuarios por grupo de casos.

---

## 7. Cómo verificar

```bash
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
cd backend && npm run test:e2e
# Con los servidores de desarrollo encendidos (4000/5173 ocupados):
E2E_BACKEND_PORT=4100 E2E_FRONTEND_PORT=5273 npx playwright test test/e2e/inventory.e2e.spec.ts
```

**Revisión manual sugerida** (claro y oscuro; 1366×768 y 768×1024):
1. Existencias: la tabla se ve sin desplazarse; Bajo y Agotados destacan; el aviso se pliega; el menú de ajustes funciona.
2. Compras: flujo Sugerencias → borrador → Por recibir → Recibir; Nueva compra con conversión de unidades.
3. Ajustes: salida con "Disponible"; conteo completo.
4. Catálogo: crear un producto simple sin abrir "Opciones de venta" y editar uno con familia o extras (la sección aparece abierta).

---

## 8. Pendientes y desviaciones respecto al plan

| Tema | Plan | Realizado | Motivo |
|---|---|---|---|
| Menú "⋯" (`ActionMenu`) para las acciones de fila | Menú contextual | **`RowActions`**: acciones de texto discretas, siempre visibles | El menú absoluto queda recortado dentro de tablas con `overflow-x-auto`; además, las acciones frecuentes no deben esconderse |
| Filtro de stock de Ingredientes en "Más filtros" | Plegable | Visible en la misma línea | Con `FilterBar`, los tres filtros caben en una fila; plegarlo no reducía ruido |
| Parámetro nuevo `?sub=` | Nuevo parámetro | **No hizo falta** | La sección se deduce de `?inv=` (mismos ids), compatible por diseño |
| INV-33 `ProductFormModal` | Extraer el modal y dejar `ProductsTab` en menos de 400 líneas | Solo se extrajo la tabla (`ProductsTable`); `ProductsTab` quedó en 955 líneas | El formulario comparte unas 25 piezas de estado (receta, imagen, familia, opciones). Se recomienda extraerlo con pruebas de componente específicas |
| INV-45 Combobox con ARIA y flechas | P3 | Pendiente | Prioridad baja |
| Validación con el usuario principal | Antes/después en Existencias, Compras y Productos | Pendiente | Requiere sesión con el usuario |
