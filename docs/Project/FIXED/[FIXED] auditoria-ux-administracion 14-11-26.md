# Auditoría UX/UI y optimización del módulo de Administración

| | |
|---|---|
| **Fecha de realización** | 14 de noviembre de 2026 |
| **Alcance** | Frontend de Administración: la vista *Administración* del dashboard (`features/dashboard/pages/MetricsPage.tsx` y sus tarjetas), *Configuración* (`features/settings`, `users`, `roles`, `preferences`), la configuración del Estado de Resultados, Gastos, Cortes de caja y Pendientes, más los componentes compartidos que usan |
| **Origen** | Saturación visual señalada por el usuario principal (demasiados elementos y opciones a la vez, textos sin jerarquía, información poco organizada) y la auditoría previa de Inventario (13/11/2026) |
| **Decisiones del usuario** | **D‑1** sí: Gastos y Cortes de caja pasan a Administración › Finanzas. **D‑2** sí: interfaz para reabrir cortes. **D‑3** restablecer la contraseña de otro usuario: solo si se pide (no se hizo). **D‑4** moneda: plegada en "Avanzado" (lo recomendado) |
| **Fuera de alcance** | Backend, base de datos, contratos de API, permisos del servidor y reglas de negocio: **no se modificaron** (sus hallazgos están en §7) |
| **Estado** | Fases 0–6 ejecutadas. Sin commits. Los pendientes están en §9 |

---

## 1. Diagnóstico (antes)

"Administración" vivía en dos lugares que se solapaban:

1. **Dashboard › "Administracion"**: 5 pestañas planas que mezclaban análisis con tareas del día (Dashboard, Estado de Resultados, Cuentas por Cobrar, Mandaditos por Entregar, Órdenes del Día). El "Dashboard" tenía 4 secciones, 5 indicadores y 9 tarjetas, y una sección de inventario que repetía el módulo de Inventario.
2. **Configuración** (engrane): una barra lateral de 8 entradas que mezclaba:
   - lo personal: Mi Perfil, Preferencias (un solo interruptor de tema), Sesión (un botón);
   - el negocio: "Preferencias del Sistema", con 3 formularios apilados y 3 botones de guardar;
   - los accesos: Usuarios, Roles;
   - la operación: Cortes de caja, Gastos.

**Hallazgos principales:**

| Tipo | Hallazgo |
|---|---|
| **Riesgo de datos** | Si fallaba la carga de la distribución, el formulario mostraba 10/20/70 y dejaba guardar, lo que sobrescribía los porcentajes reales. Preferencias generales se quedaba en "Cargando…" para siempre; Gastos fijos mostraba "Total $0". Al crear un usuario se recortaba la contraseña, que luego no servía para iniciar sesión |
| **Interfaz ≠ backend** (10 casos) | Gastos sin ningún permiso en la UI. "Editar" saldos sin `users.update`. Configuración del sistema editable sin `users.update`. Casillas de permisos que el servidor rechaza: roles del sistema, permisos que el actor no tiene, roles que contienen permisos ajenos. "Cambiar rol" sobre uno mismo. Roles no asignables en el selector. Eliminar habilitado en roles con usuarios |
| **Sincronización** | Renombrar un rol no actualizaba la tabla de usuarios y cambiar el rol de un usuario no actualizaba los conteos. Los permisos propios tardaban hasta 30 min en reflejarse |
| **Cortes de caja** | Solo se veían los 20 más recientes (sin paginación). La corrección se editaba apretada dentro de la celda. La reapertura existía en el backend sin interfaz |
| **Legibilidad** | Inputs propios en `text-xs`; labels sin `htmlFor`; errores solo en toasts; títulos en Title Case y sin acentos ("Administracion", "Ordenes"); módulo `categories` mostrado como "Categories"; "Actualizar usuarios" sin decir que abarca roles y configuración |
| **Consistencia** | 4 estilos de encabezado; tarjeta-sobre-tarjeta; `ActionMenu` solo en Usuarios y Roles; botones de texto blanco fijo; "Inactivo" en rojo |

## 2. Principios aplicados

- **Evolución conservadora:** la misma paleta, tipografía, tarjetas redondeadas y botones en forma de píldora; solo cambian la densidad, la jerarquía y el orden.
- **La interfaz ofrece solo lo que el backend acepta.** Las reglas del servidor se replican en `features/roles/utils/permissionRules.ts`; el backend sigue siendo el que autoriza.
- **Un error nunca parece un dato:** ni lista vacía, ni $0, ni valores por defecto guardables.
- **Lo sensible, separado y confirmado:** "Zona de riesgo" para eliminar, confirmaciones que nombran el antes y el después, y la reapertura con motivo auditado.
- **Nada se pierde:** cada funcionalidad sigue disponible (§6) y los enlaces viejos llevan a su nuevo lugar.

## 3. Navegación: antes y después

```
ANTES                                              DESPUÉS
Dashboard › Administracion (5 pestañas planas)     Dashboard › Administración (3 secciones)
  Dashboard                                          Resumen
  Estado de Resultados                               Finanzas: Estado de resultados · Gastos · Cortes de caja
  Cuentas por Cobrar                                 Pendientes: Cuentas por cobrar · Mandaditos · Órdenes del día
  Mandaditos por Entregar
  Órdenes del Día

Configuración (8 entradas)                         Configuración (5 entradas, agrupadas)
  Mi Perfil · Preferencias · Sesión                  Mi cuenta (perfil, contraseña, apariencia, cerrar sesión)
  Preferencias del Sistema                           NEGOCIO: Datos del negocio · Finanzas (distribución, gastos fijos)
  ADMINISTRACIÓN: Usuarios · Roles                   ACCESOS: Usuarios · Roles y permisos
                  Cortes de caja · Gastos            (OPERACIÓN: Cortes de caja · Gastos, solo para quien no tiene Administración)
  Sesión
```

**Compatibilidad de enlaces:**
- `?admin=` conserva los mismos ids y agrega `expenses` y `cash-history`.
- En `/settings`:
  - `?tab=profile`, `preferences` y `session` llevan a **Mi cuenta**;
  - `?tab=system-preferences` lleva a **Datos del negocio**;
  - `?tab=cash-history` y `?tab=expenses` llevan a Administración › Finanzas si el usuario tiene `dashboard.read`; si no, se quedan en Configuración › Operación, así que nadie pierde acceso (decisión D‑1).
- Las secciones usan el nuevo `SectionTabs` (←/→, Inicio/Fin), que también se aplicó a Inventario. Las vistas de una sección usan `SegmentedTabs`.

## 4. Cambios realizados por fase

### Fase 0 — Red de seguridad
- **Línea base:** la suite E2E existente estaba en verde al cierre de la auditoría de Inventario.
- **Spec nuevo:** se escribió `backend/test/e2e/admin.e2e.spec.ts` (7 casos; 12 tras completar los pendientes, ver Fase 6), que cubre usuarios, roles, configuración, navegación, gastos y la reapertura de cortes.

### Fase 1 — Correcciones críticas (datos y permisos)

| ID | Cambio | Archivos |
|---|---|---|
| AD‑01 | Distribución: si falla la carga, `QueryErrorState`; nunca muestra ni guarda valores por defecto. El formulario se monta con los datos guardados (`key`) | `income-statement/components/DistributionSettingsForm.tsx`, `utils/distribution.ts` |
| AD‑02 | Datos del negocio: estado de error con reintento; la validación devuelve sus errores (antes el toast leía el estado viejo y no aparecía) | `preferences/components/SystemPreferencesForm.tsx`, `preferences/utils/generalPreferences.ts` |
| AD‑03 | Gastos fijos: error ≠ "Total $0"; la lista se actualiza con la respuesta de la mutación | `FixedExpenseSettingsForm.tsx`, `hooks/useIncomeStatement.ts` |
| AD‑04 | Gastos: Nuevo, Editar y Eliminar según `expenses.create/update/delete`; error con reintento | `expenses/pages/ExpensesPage.tsx`, `components/ExpenseList.tsx`, `hooks/useExpenses.ts` |
| AD‑05 | Saldos acumulados: "Editar" solo con `users.update` y sin texto blanco fijo | `SaldosAcumuladosSection.tsx` |
| AD‑06 | Configuración de negocio y finanzas en solo lectura sin `users.update` (`PermissionNotice`); Finanzas explica que necesita Administración (`dashboard.read`) | `SettingsPage.tsx` y los 3 formularios (`canEdit`) |
| AD‑07 | Permisos del rol: en solo lectura si es rol del sistema sin `roles.manage_system_permissions` o si contiene permisos que el actor no tiene; las casillas de permisos que el actor no tiene quedan deshabilitadas con nota; se muestran **todos** los módulos | `roles/components/RolePermissionsDrawer.tsx`, `roles/utils/permissionRules.ts` |
| AD‑08 | Sobre la propia cuenta no se ofrece "Cambiar rol" ni Desactivar/Eliminar (antes fallaban con un toast); la fila dice "(tú)" | `UserTable.tsx`, `UserDetailDrawer.tsx` (se eliminó `selfGuard.ts`) |
| AD‑09 | Los roles con permisos que el actor no tiene aparecen deshabilitados en los selectores: "(incluye permisos que no tienes)" | `UserFormModal.tsx`, `UserDetailDrawer.tsx` |
| AD‑10 | La contraseña de un usuario nuevo se envía tal cual se escribió; regla compartida con "Cambiar contraseña" (incluye el máximo de 72 del backend) | `shared/utils/password.ts` |
| AD‑11 | Caché: renombrar un rol o cambiar sus permisos refresca `users`; crear, eliminar o cambiar el rol de un usuario refresca `roles`; editar **tu propio** rol relee tu sesión al instante | `useRoles.ts`, `useUsers.ts`, `auth/services/refreshSession.ts` |
| AD‑12 | Un 403 con sesión activa dispara la relectura de permisos (máximo una vez por minuto), así que los botones que tu rol ya no permite desaparecen | `app/api.ts` (`PERMISSIONS_STALE_EVENT`), `auth/hooks/useSessionValidator.ts` |
| AD‑13 | Cortes de caja: paginación del servidor (`status=closed`), filtro de fechas y conteo total | `dashboard/components/CashSessionHistory.tsx` |
| AD‑14 | Eliminar rol: oculto con su motivo ("rol del sistema", "tiene N usuarios"); eliminar usuario explica la regla del historial | `RolesView.tsx`, `UserDetailDrawer.tsx` |

### Fase 2 — Organización de la navegación

| ID | Cambio | Archivos |
|---|---|---|
| AN‑01 | Administración en 3 secciones con vistas internas; `?admin=` compatible | `dashboard/pages/MetricsPage.tsx`, `shared/components/SectionTabs.tsx` |
| AN‑02 | Configuración en 5 entradas agrupadas; mapeo de los `?tab=` viejos (D‑1) | `settings/pages/SettingsPage.tsx` |
| AN‑03 | Nombres: "Órdenes", "Administración", "Resumen", "Mandaditos", "Roles y permisos", "Ver detalle", "Permisos"/"Ver permisos", "Datos del negocio" | varios |
| AN‑04 | Enlace "Configurar distribución y gastos fijos →" desde el Estado de resultados (con `users.update`) | `IncomeStatementPage.tsx` |
| AN‑05 | Tablet: la barra lateral de Configuración pasa a una fila con scroll horizontal por debajo de `lg` | `SettingsPage.tsx` |
| AN‑06 | El engrane del encabezado se anuncia como "Configuración: mi cuenta, usuarios y datos del negocio" | `DashboardHeader.tsx` |

### Fase 3 — Simplificación visual

| ID | Cambio |
|---|---|
| AV‑01 | Resumen: encabezado compacto con el selector de periodo (`aria-pressed`). Franja de 5 indicadores compactos. "Utilidad" o "Pérdida" según el signo, sin la flecha que parecía una tendencia. "Stock bajo" lleva a Inventario. Se quitó "en tiempo real" (no hay polling) (`AdminOverview.tsx`, `DashboardSummary.tsx`) |
| AV‑02 | Inventario en el Resumen: stock bajo, 5 compras por recibir y 5 movimientos, cada tarjeta con su enlace a Inventario ("Existencias", "Por recibir", "Ver todos"). Ninguna tarjeta se eliminó |
| AV‑03 | `PageHeader` compartido en todas las pantallas (se movió de Inventario a `shared/components/PageHeader.tsx`); se eliminaron los encabezados en tarjeta |
| AV‑04 | Usuarios: `FilterBar` (búsqueda con debounce, Rol, Estado), 4 columnas (el correo va bajo el nombre), `RowActions`, `Pagination`, `QueryErrorState` e "Inactivo" en tono neutro |
| AV‑05 | Detalle de usuario: bloques Rol / Acciones / **Zona de riesgo**; sin el correo duplicado |
| AV‑06 | Roles: insignia "Del sistema", descripción, conteos y motivo cuando no se puede eliminar |
| AV‑07 | Permisos: etiquetas claras, notas ("Editar usuarios — también roles, permisos y configuración…"), marca **Sensible**, orden Consultar → Crear → Editar → Eliminar → especiales, contador "x de y", `fieldset`/`legend` y casillas de 20 px |
| AV‑08 | Pendientes: `PageHeader` con el total como dato principal (sin el rojo grande permanente); Órdenes del día con la fecha en el encabezado |
| AV‑09 | Gastos fijos: lista compacta con `RowActions` y el total por día arriba |

### Fase 4 — Formularios

| ID | Cambio |
|---|---|
| AF‑01 | Nuevo usuario y Editar usuario: `FormField` (label asociado y error junto al campo), "Correo", botón "Mostrar" contraseña y checklist de requisitos que coincide con la validación (reemplaza el medidor de fortaleza, que usaba otra regla) |
| AF‑02 | Rol: `Input` y textarea con tokens del tema; error junto al campo; al crear un rol se abren sus permisos |
| AF‑03 | Datos del negocio en secciones: **Identidad**, **Horario de operación** (explica que define el cierre automático de caja y el día contable) y **Moneda (avanzado)** plegada con su nota (D‑4). Un solo "Guardar cambios" que se activa con cambios, más "Descartar". El payload no cambia |
| AF‑04 | Distribución: un campo vacío es un error (antes contaba como 0); muestra "Faltan / Sobran X%" |
| AF‑05 | Mi cuenta: perfil, contraseña, apariencia y cerrar sesión en una página; errores junto al campo |
| AF‑06 | Corregir corte en un `Modal` con campos etiquetados; se conserva la confirmación anterior → nuevo |
| D‑2 | **Reabrir caja** (`POST /cash-register/sessions/:id/reopen`, `cash.correct`): solo para el corte más reciente y solo si no hay una caja abierta, con motivo obligatorio (≤120). El backend guarda el conteo descartado en la auditoría y notifica |

### Fase 5 — Consistencia y refactor

| ID | Cambio |
|---|---|
| AR‑01 | `PageHeader` y `PermissionNotice` en `shared/components` (Inventario los importa de ahí) |
| AR‑02 | `shared/utils/password.ts` (regla y checklist) y `isValidEmail` |
| AR‑03 | `FormField` + `shared/utils/formField.ts`; `Input` y `Select` aceptan `ref` (`ComponentProps`) |
| AR‑04 | Sin `setTimeout(0)` para copiar props a estado: los formularios se montan con `key` (UserFormModal, RoleFormModal, UserDetailDrawer, RolePermissionsDrawer, los formularios de configuración) |
| AR‑05 | `DashboardCard` para las 8 tarjetas del Resumen: el mismo marco en todos los estados y error con "Reintentar" (de 1 077 a 716 líneas, más 37 del componente) |
| AR‑06 | `Button`: nueva variante `secondary` (píldora con borde); `ghost` pasa a `text-sm` con hover (antes `text-xs`) |
| AR‑07 | La barra lateral de Configuración sale de un arreglo de secciones (id, etiqueta, grupo, permiso) |
| AR‑08 | Se eliminó `shared/components/ActionMenu.tsx` (sin usos; todas las tablas usan `RowActions`) |
| AR‑09 | Toasts con títulos específicos ("No se pudo desactivar el usuario"); ahora también hay toast de éxito al activar, desactivar y eliminar |
| — | `QueryErrorState` concuerda el verbo con el sujeto ("No se pudo cargar el resumen" / "No se pudieron cargar los roles") |
| — | `InventoryStatus` usa `StatusBadge` en vez de texto blanco fijo |

### Fase 6 — QA y validación

| Verificación | Resultado |
|---|---|
| Frontend `npm run lint`, `tsc -b`, `npm run build` | ✅ |
| Vitest | ✅ 26 archivos, 95 pruebas. Nuevas: `permissionRules`, `permissionGroups`, `password`, `distribution`, `generalPreferences`, `RolePermissionsDrawer`, `UserFormModal`, solo lectura en `ExpensesPage` y revalidación tras 403 en `useSessionValidator` |
| Backend `tsc` y `eslint test/e2e` | ✅ |
| E2E completo (`--workers=1`, puertos 4100/5273) | ✅ **35/35**, incluidos los 12 de `admin.e2e.spec.ts`. Se actualizaron `app-shell`, `cash-history`, `navigation-smoke` y `sec-006` a los nombres y ubicaciones nuevos |
| Revisión visual | Capturas en claro y oscuro de Resumen, Usuarios y Datos del negocio, y de Roles en tablet 768×1024 (`backend/test-results/admin-*.png`, generadas por el spec) |
| graphify | `graphify update .` → 2 948 nodos |

**Casos E2E nuevos (`admin.e2e.spec.ts`):**
1. Crear un usuario con errores junto al campo y la contraseña tal cual; filtrar; cambiar su rol con confirmación; desactivarlo; la propia fila sin acciones peligrosas.
2. Crear un rol, otorgarle un permiso (resumen + confirmación) y no poder otorgar uno ajeno; CAJERO en solo lectura.
3. La distribución que no carga muestra el error y ningún valor guardable.
4. Las 3 secciones, el teclado y los enlaces viejos de Configuración y Administración (más las capturas).
5. `users.read` sin `users.update`: configuración en solo lectura y roles sin editar.
6. Solo `expenses.read`: sin registrar, editar ni eliminar gastos.
7. Reabrir el último corte con motivo: queda abierto y auditado, y deja de ofrecerse mientras haya una caja abierta.
8. **QA‑ADM‑16** Datos del negocio: Descartar, error junto al campo (cierre antes de la apertura) y guardado verificado en la BD.
9. **QA‑ADM‑21** Gastos fijos: agregar, rechazar el duplicado, editar el monto y eliminar con confirmación.
10. **QA‑ADM‑15** Quien edita los permisos de su propio rol ve el cambio sin recargar ("Eliminar" rol desaparece al quitarse `users.delete`).
11. **QA‑ADM‑28** Si a una sesión abierta le quitan `users.update`, el 403 relee los permisos y retira Desactivar y Cambiar rol; el usuario objetivo no cambia.
12. **QA‑ADM‑30** El modal atrapa el foco (Shift+Tab da la vuelta) y Escape devuelve el foco al botón que lo abrió.

Las preferencias generales y los gastos fijos son globales: el spec guarda sus filas antes de empezar y las restaura al final.

## 5. Archivos principales

- **Nuevos:**
  - en `shared/`: `components/PageHeader.tsx` (movido), `PermissionNotice.tsx` (movido), `SectionTabs.tsx` y `FormField.tsx`; `utils/password.ts`, `formField.ts` y `dateUtils.formatDate`;
  - en `features/`: `roles/utils/permissionRules.ts`, `auth/services/refreshSession.ts`, `dashboard/components/AdminOverview.tsx` y `DashboardCard.tsx`, `preferences/utils/generalPreferences.ts` e `income-statement/utils/distribution.ts`.
- **Reescritos:**
  - Usuarios y Roles: `UsersView`, `UserTable`, `UserDetailDrawer`, `UserFormModal`, `RolesView`, `RoleFormModal`, `RolePermissionsDrawer`.
  - Configuración: `SettingsPage`, `ProfileForm`, `ChangePasswordForm`, `SystemPreferencesForm`, `DistributionSettingsForm`, `FixedExpenseSettingsForm`.
  - Administración: `CashSessionHistory`, `MetricsPage`, `DashboardSummary`.
- **Eliminados:** `shared/components/ActionMenu.tsx`, `features/users/utils/selfGuard.ts`.
- **Documentación:** `frontend/README.md` (convenciones de pantallas y permisos), `CLAUDE.md` (convenciones del frontend) y `Readme.md` (enlace a este documento).

## 6. Conservación de funcionalidades

| Funcionalidad | Dónde está ahora |
|---|---|
| Crear, editar, activar/desactivar, eliminar usuarios, cambiar rol, buscar, paginar | Configuración › Usuarios (más filtros por rol y estado) |
| Crear, renombrar, describir, eliminar roles; editar permisos con resumen y confirmación | Configuración › Roles y permisos |
| Nombre, horario, moneda, símbolo, teléfono, dirección | Configuración › Datos del negocio (la moneda, en "Avanzado") |
| Distribución 3 porcentajes; CRUD de gastos fijos | Configuración › Finanzas |
| Historial de cortes, "Sin conteo", corrección con motivo y confirmación | Administración › Finanzas › Cortes de caja (+ paginación, fechas y **Reabrir**) |
| Gastos: lista, filtros, paginación, CRUD | Administración › Finanzas › Gastos |
| Las 9 tarjetas del Resumen y los 4 periodos | Administración › Resumen |
| Estado de resultados (día, semana, mes, rango, detalle, saldos) | Administración › Finanzas |
| Cuentas por cobrar, Mandaditos, Órdenes del día (liquidar, entregar, detalle) | Administración › Pendientes |
| Perfil, contraseña, tema (`andy-theme`), cerrar sesión sin cerrar caja | Configuración › Mi cuenta |

## 7. Hallazgos de backend (documentados, sin cambios)

| ID | Hallazgo | Cómo lo refleja la interfaz |
|---|---|---|
| B‑1 | El teléfono y la dirección del negocio no se pueden borrar: `preference.repository.ts` ignora los valores vacíos | Nota en el campo |
| B‑2 | `users.*` controla también roles, permisos, preferencias y la configuración financiera | Etiqueta "Usuarios y configuración" y notas en cada permiso |
| B‑3 | La pestaña de configuración pide `users.read`, pero las lecturas de finanzas piden `dashboard.read` | Aviso en Configuración › Finanzas |
| B‑4 | `reports.read` no tiene efecto | Nota "Sin efecto por ahora" |
| B‑5 | `POST /cash-register/sessions/:id/reopen` reabre cualquier corte cerrado aunque haya otra caja abierta (podría haber dos sesiones abiertas) | "Reabrir" solo en el corte más reciente y sin caja abierta. Recomendación: validarlo también en `cash.service.reopenSession` |

## 8. Cómo verificar

```bash
cd frontend && npm run lint && npx tsc -b && npm run test && npm run build
cd backend
npm run test:db:up && npm run test:db:prepare     # si la BD de pruebas no está arriba
# Con los servidores de desarrollo encendidos (4000/5173 ocupados), un worker:
E2E_BACKEND_PORT=4100 E2E_FRONTEND_PORT=5273 npx playwright test test/e2e --workers=1
```

**Revisión manual sugerida (ambos temas y tablet):**
1. Administración: recorrer las 3 secciones y sus vistas; recargar y usar Atrás.
2. Configuración: Usuarios (filtros, detalle, Zona de riesgo), Roles (permisos de ADMIN y de un rol propio) y Datos del negocio (Descartar, Moneda avanzada).
3. Cortes de caja: Corregir y Reabrir.

## 9. Pendientes y desviaciones respecto al plan

- **Fase 0:** el spec `admin.e2e.spec.ts` se escribió junto con los cambios y no antes; la línea base fue la suite existente en verde.
- **Medidor de fortaleza:** se reemplazó por la checklist de requisitos, porque calificaba con una regla distinta a la del backend.
- Los casos QA‑ADM‑15, 16, 21, 28 y 30, que habían quedado solo con pruebas unitarias, ya tienen E2E (casos 8–12 de la Fase 6).
- **D‑3** (que un administrador restablezca la contraseña de otro usuario) no se implementó por decisión del usuario; requeriría un endpoint nuevo.
- **No se cambió:**
  - el contenido interno de las secciones del Estado de resultados ni de las tablas de Pendientes (solo encabezados y estados);
  - `ExpenseFormModal`;
  - el Toaster oscuro.
- **Falta** la validación manual con el usuario principal (QA‑USA y el recorrido de §8), que hará el propio usuario.
- **Recomendación de backend B‑5:** que el servicio impida reabrir con otra caja abierta.
