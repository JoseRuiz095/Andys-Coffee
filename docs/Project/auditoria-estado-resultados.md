# Auditoría Integral — Módulo "Estado de Resultados" (Andy's Coffee POS)

**Fecha de auditoría:** 21 de septiembre de 2026  
**Auditor:** Equipo Senior — Contador/Auditor Financiero + Ingeniero Backend + Ingeniero Frontend  
**Alcance:** Modelo financiero, lógica de caja, ingresos, gastos, distribución de fondos, acumulados, estado diario/mensual, backend y frontend  
**Clasificación de hallazgos:** BUG CONFIRMADO / RIESGO / REGLA DE NEGOCIO NO DEFINIDA / MEJORA  

---

## RESUMEN EJECUTIVO

Andy's Coffee implementa un **reporte financiero híbrido** (no un Estado de Resultados contable puro) que combina:
- **Caja física**: seguimiento de efectivo esperado vs. real
- **Ingresos por método**: efectivo, transferencia, otros métodos
- **Gastos**: operativos fijos y variables (insumos, servicios, nómina)
- **Dinero disponible para distribución**: base de cálculo para Ahorro/Fondo Negocio/Surtido
- **Acumulados históricos**: encadenamiento diario de saldos

**Hallazgo crítico #1:** El costo de ventas (`totalCogs`, costSnapshot en órdenes) **se calcula pero no se resta** de `netProfit`. Esto **NO es un bug**, sino una **REGLA DE NEGOCIO NO DEFINIDA**: no hay evidencia clara en código/docs de si el dinero disponible para distribución (`distributableProfit`) debe o no descontar el costo real de los insumos vendidos. El riesgo es que si `Expense` categoría `insumos` ya descuenta el costo de inventario recibido del `totalExpenses`, restar además el `totalCogs` duplicaría el descuento.

**Hallazgo crítico #2:** Zona horaria — bug repetido en **5+ archivos frontend** (`toISOString().slice(...)` normaliza a UTC, no a hora local de México). Afecta qué se considera "hoy" para el selector de fecha del Estado de Resultados y para el flag que permite editar saldos acumulados. Desde ~18:00-19:00 hora de México en adelante, se muestra/edita el día equivocado.

**Hallazgo crítico #3:** `CashSession.expectedAmount` es un **contador incremental** (no recalculado desde `Σ CashMovement`). No existe job de reconciliación que valide la consistencia. Riesgo de desincronización si falla alguna transacción que actualice ambos.

**Hallazgo crítico #4:** Convención documentada (no forzada) de que gastos fijos (`expenses.fixed.general=$260/día`) **no deben re-registrarse** como `Expense` categoría `nomina`/`servicios`. Un usuario malintencionado o desatento puede duplicar este descuento.

**Hallazgo crítico #5:** Discrepancia entre documentación y código: `CLAUDE.md` y comentario en `cash.service.ts` afirman que el auto-cierre de caja ocurre a las **14:00 hora local**, pero el fallback real es **22:00** (`preference.repository.ts`). El 14:00 solo aplica si se configura explícitamente en `SystemPreference`.

---

## HALLAZGOS CRÍTICOS

### H-C001: Costo de Ventas (COGS) No Resta de Utilidad Neta — ✅ COMPORTAMIENTO CONFIRMADO CORRECTO

**Severidad:** CRÍTICA (fue considerada crítica en auditoría, pero resulta ser correcta)  
**Clasificación:** COMPORTAMIENTO CONFIRMADO CORRECTO  
**Área:** Contabilidad / Backend  
**Archivo:** `backend/src/services/income-statement.service.ts`  
**Componente:** `IncomeStatementService`  
**Función:** `computeDayCore(rows, percentages, fixedExpenseRate, businessHours)`  
**Línea:** 185-211  

**Regla de Negocio (Clarificada por el Usuario):**

El modelo financiero de Andy's Coffee es único:
- **Compra de inventario:** Se descuenta del **fondo del negocio acumulado** (no entra como gasto diario).
- **Venta de producto:** El `costSnapshot` se calcula pero es **solo informativo** (grossProfit).
- **Dinero disponible para distribución:** `distributableProfit = netProfit - fixedOperatingExpenses` (sin descontar COGS, porque ya fue descontado del fondo al comprar).

**Ejemplo:**
```
Compra café: $1000 → descuenta del fondo del negocio acumulado
Vende café: $2000 (con $500 de COGS) → 
  netProfit = 2000 - 260 (fijos) = 1740
  (COGS=$500 es informativo, no se resta)
  
El costo ya fue pagado al comprar, no al vender.
```

**Comportamiento actual (CORRECTO):**
```typescript
const totalCogs = sumDecimals(rows.cogsRows, (i) => i.costSnapshot);  // Informativo
const grossProfit = totalRevenue.minus(totalCogs);  // Informativo
const netProfit = totalRevenue.minus(totalExpenses);  // NO descuenta COGS ✓
const distributableProfit = netProfit.minus(fixedOperatingExpenses);  // Base correcta ✓
```

**Evidencia:**

Línea 185-186: comentario afirma "is informational only" — **es exactamente lo que se necesita** para el modelo de Andy's.

**Impacto:**

**Ninguno — el sistema está diseñado correctamente.** El costo de insumos se paga cuando se compran (descuenta del fondo), no cuando se venden. Por tanto, `distributableProfit` es la cantidad correcta para repartir entre Ahorro/Fondo Negocio/Surtido.

**Comportamiento esperado:**

✅ Confirmado: `distributableProfit` NO debe descontar COGS porque el costo ya fue descuento del fondo del negocio al comprar.

**Corrección propuesta:**

NINGUNA — el código es correcto. Solo actualizar documentación (comentario en línea 185) para aclarar explícitamente que COGS es informativo porque Andy's descuenta costos del fondo, no de utilidades.

**Sugerencia de mejora (MENOR):**

Actualizar comentario (línea 185-186) de:
```typescript
// Cost of goods sold is informational only — it no longer reduces netProfit.
```
a:
```typescript
// Cost of goods sold is informational (grossProfit). Andy's descuenta costos del fondo
// al comprar inventario, no de la utilidad al venderlo. Por eso COGS no resta de netProfit.
```

**Prueba recomendada:**

1. Comprar $1000 de café → fondo del negocio disminuye $1000.
2. Vender café por $2000 (con $500 COGS).
3. Verificar: `netProfit = 2000 - 260 = 1740` (sin descontar el $500 COGS, correcto porque ya fue pagado del fondo al comprar).
4. Verificar: `saldosAcumulados.fondoNegocio` refleja el descuento de $1000 de la compra anterior.

---

### H-C002: Zona Horaria — Bug Repetido en Selección de "Hoy"

**Severidad:** CRÍTICA  
**Clasificación:** BUG CONFIRMADO  
**Área:** Frontend  
**Archivo:** Múltiples  
**Componente:** Selectores de fecha  
**Función:** Cálculo de "hoy"  
**Línea:** Múltiples  

**Problema:**

Cinco o más archivos frontend usan el patrón:
```typescript
new Date().toISOString().slice(0, 10)  // o .split('T')[0]
```

`toISOString()` siempre devuelve la fecha/hora en **UTC**, no en la zona horaria local del navegador. Para un usuario en México (UTC-6 / UTC-5 con horario de verano), desde aproximadamente las 18:00-19:00 hora local, la fecha UTC ya pertenece al día siguiente.

**Evidencia:**

- `frontend/src/features/income-statement/pages/IncomeStatementPage.tsx` líneas 18-20, 22-24: inicialización por defecto de `todayDateString` y `currentYearMonth`.
- `frontend/src/features/income-statement/components/SaldosAcumuladosSection.tsx` líneas 6-8: cálculo de `getTodayDateString()`, usado para determinar si se puede editar saldos.
- `frontend/src/features/income-statement/components/EditAccumulatedBalancesModal.tsx` línea 5-7: idem.
- `frontend/src/features/daily-orders/pages/DailyOrdersPage.tsx` línea 9-11: selector de fecha "hoy".
- `frontend/src/features/inventory/pages/InventoryPhysical.tsx` línea 60: idem.

**Impacto:**

1. **Selector de fecha por defecto:** Si el usuario abre el Estado de Resultados a las 20:00 hora de México, el selector muestra la fecha del día siguiente en UTC.
2. **Edición de saldos acumulados:** El flag `isToday` (línea 13 de `SaldosAcumuladosSection.tsx`) que controla si se puede editar bloquea la edición si `date !== getTodayDateString()`. Por tanto, desde ~18:00 en adelante, se puede editar el "día siguiente" (en UTC) pero no el día actual local.

**Comportamiento actual:**

Desde las 18:00-19:00 hora de México, "hoy" se interpreta como el día siguiente (UTC).

**Comportamiento esperado:**

"Hoy" debe interpretarse como el día actual en la zona horaria local del negocio (México).

**Corrección propuesta:**

Usar `date-fns-tz` o `Intl.DateTimeFormat` para calcular la fecha local:
```typescript
const now = new Date();
const formatter = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City' });
const todayDateString = formatter.format(now).split('/').reverse().join('-');
```

O usar la zona configurada en `backend/src/config/app.ts` (`CASH_TIMEZONE`), sincronizando con el backend.

**Prueba recomendada:**

1. Cambiar el reloj del navegador (o servidor) a 20:00 hora de México.
2. Abrir el Estado de Resultados.
3. Verificar que el selector de fecha muestre la fecha local correcta, no UTC+1.
4. Intentar editar saldos acumulados del día local — debe permitirse.

---

### H-C003: expectedAmount como Contador Incremental sin Reconciliación

**Severidad:** CRÍTICA  
**Clasificación:** RIESGO  
**Área:** Backend / Caja  
**Archivo:** `backend/src/repositories/cash.repository.ts`, `backend/src/services/order.service.ts`, `backend/src/services/expense.service.ts`  
**Componente:** `CashSession`, movimientos de caja  
**Función:** Múltiples (venta, gasto, cancelación, edición)  
**Línea:** Múltiples: cash.repository.ts:140, order.service.ts:552/588/620/738/813, expense.service.ts:87/159/195  

**Problema:**

`CashSession.expectedAmount` es un **contador incremental** mantenido con `increment`/`decrement` de Prisma:
- Venta cash: `increment: finalTotal` (order.service.ts:552)
- Gasto cash: `decrement: amount` (expense.service.ts:87)
- Delivery cobrado: `increment: deliveryAmountDecimal` (order.service.ts:588)
- Cancelación/reversión: operación inversa

**No se recalcula desde cero** cada vez que se consulta. Es un saldo corriente derivado de transacciones incrementales, susceptible a desincronización si falla alguna transacción intermedia o si hay un bug en cualquiera de las rutas que actualiza `expectedAmount`.

**Evidencia:**

No existe job de reconciliación (`backend/src/jobs/`) que compare:
```
SUM(CashMovement.amount WHERE cashSessionId=? AND type IN ('sale', 'delivery_collected', ...))
  vs.
CashSession.expectedAmount
```

**Impacto:**

Si hay una transacción que crea un `CashMovement` pero falla al actualizar `expectedAmount` (o viceversa), la sesión queda con un `expectedAmount` incorrecto, afectando:
- `cashDifference` en el Estado de Resultados (diferencia = actualCash - expectedCash).
- Auditoría de caja.
- Reporte diario.

**Comportamiento actual:**

`expectedAmount` confía en que todas las rutas lo actualizan correctamente. No hay validación.

**Comportamiento esperado:**

Debería existir un mecanismo de reconciliación periódica (job o endpoint) que:
1. Sume `CashMovement.amount` por sesión.
2. Compare contra `CashSession.expectedAmount`.
3. Alerte si hay discrepancias.

**Corrección propuesta:**

Crear un job periódico (ej. cada 1 hora, o a fin de día) que ejecute:
```sql
SELECT cs.id, cs.expectedAmount, COALESCE(SUM(cm.amount), 0) AS sumMovements
FROM cash_sessions cs
LEFT JOIN cash_movements cm ON cs.id = cm.cashSessionId
WHERE cs.status = 'open'
GROUP BY cs.id
HAVING cs.expectedAmount != COALESCE(SUM(cm.amount), 0)
```

Y alerte/corrija automáticamente o registre una auditoría.

**Prueba recomendada:**

1. Abrir sesión de caja.
2. Registrar venta cash manualmente (sin crear `CashMovement`, simulando un bug).
3. Verificar que `expectedAmount` queda incorrecto.
4. Ejecutar job de reconciliación — debe detectar la discrepancia y alertar.

---

### H-C004: Gastos Fijos No Protegidos — Riesgo de Doble Conteo

**Severidad:** CRÍTICA  
**Clasificación:** RIESGO  
**Área:** Backend / Arquitectura  
**Archivo:** `backend/src/validators/expense.validator.ts`, `backend/src/services/income-statement.service.ts`  
**Componente:** `ExpenseService`, validación de entrada  
**Función:** `createExpense`, `computeDayCore`  
**Línea:** expense.validator.ts:3-7, income-statement.service.ts:207  

**Problema:**

Gastos fijos recurrentes (luz, sueldos, $260/día por defecto) se almacenan como `SystemPreference` (`expenses.fixed.*`) y se descuentan automáticamente de `netProfit` en el Estado de Resultados:

```typescript
// income-statement.service.ts:207
const fixedOperatingExpenses = hadOperation ? fixedExpenseRate : 0;  // $260/día si hay operación
```

**Pero existe una convención documentada (no forzada por el sistema) en el validador:**

```typescript
// expense.validator.ts:3-7
// WARNING: Fixed operating expenses (luz, sueldos) are already deducted automatically via SystemPreference.
// DO NOT register them again as Expense in categories nomina/servicios — it will double-count them.
```

**Evidencia:**

- Comentario en línea 3-7 de `expense.validator.ts`.
- No hay validación que bloquee la creación de `Expense` categoría `nomina` o `servicios` si ya existe `SystemPreference` `expenses.fixed.*`.

**Impacto:**

Un usuario (o un bug) puede registrar una `Expense` categoría `nomina` ó `servicios` por el mismo concepto que ya se descuenta automáticamente como gasto fijo. Resultado:
- `totalExpenses` se incrementa (gasto manual).
- `netProfit` disminuye.
- `distributableProfit` disminuye.
- El dinero disponible para distribución se reduce indebidamente.

**Ejemplo numérico:**

Supongamos:
- Ingresos: $1,000
- Gastos variables registrados: $100
- Gastos fijos automáticos: $260 (luz + sueldos)
- **Si además se registra un gasto manual `nomina=$260`:**
  - `totalExpenses = 100 + 260 (manual) + [260 (gasto fijo ya descuento?)]`
  - Depende de si el gasto fijo ya está o no incluido en la lectura de gastos variables, pero en cualquier caso hay confusión.

**Comportamiento actual:**

No hay protección. El sistema permite registrar gastos manuales sin verificar si ya existen como gastos fijos.

**Comportamiento esperado:**

Debería existir validación que:
1. Bloquee crear `Expense` categoría `nomina`/`servicios` si ya existe `SystemPreference` `expenses.fixed.*`.
2. O, al menos, alerte al usuario con un banner "Advertencia: Estos conceptos ya se descuentan como gastos fijos automáticos".

**Corrección propuesta:**

En `expense.validator.ts`, añadir validación `.refine()` que compruebe si la categoría es `nomina`/`servicios` y la fecha cae en un día con operación → consultar `SystemPreference` `expenses.fixed.*` existentes y alertar.

**Prueba recomendada:**

1. Configurar gastos fijos automáticos ($260/día).
2. Crear una `Expense` categoría `nomina` por $260 el mismo día.
3. Verificar `totalExpenses` y `distributableProfit` — deben mostrar el gasto solo una vez, o alertar de duplicación.

---

### H-C005: Discrepancia en Documentación — Hora de Auto-Cierre de Caja

**Severidad:** CRÍTICA  
**Clasificación:** BUG CONFIRMADO (discrepancia documentación ↔ código)  
**Área:** Backend / Configuración  
**Archivo:** `backend/src/services/cash.service.ts`, `backend/src/repositories/preference.repository.ts`, `CLAUDE.md`  
**Componente:** `CashService`, preferencias de negocio  
**Función:** `closeIfBusinessDayEnded`, `getGeneralPreferences`  
**Línea:** cash.service.ts:101, preference.repository.ts:54, CLAUDE.md:406  

**Problema:**

La documentación y un comentario en el código afirman que el cierre automático de caja ocurre a las **14:00 hora local**:

- `CLAUDE.md:406`: "auto-close at business-day end **14:00 local time**"
- `cash.service.ts:101`: comentario "fallback to **14:00** if not set"

**Pero el código real:**

```typescript
// preference.repository.ts:54 (getGeneralPreferences)
const defaults = {
  general: {
    business_hours_open: '07:00',
    business_hours_close: '22:00',  // ← 22:00, no 14:00
  },
  ...
};
```

**Evidencia:**

- Línea 54 de `preference.repository.ts`: default `business_hours_close='22:00'`.
- Línea 101 de `cash.service.ts`: comentario dice fallback a 14:00, pero el fallback real es lo que retorna `getGeneralPreferences()`, que es 22:00.

**Impacto:**

Las cajas NO se cierran automáticamente a las 14:00 como promete la documentación, sino a las 22:00 (ó al valor que configure el admin en `SystemPreference`). Un usuario/cliente que espera cierre a las 14:00 quedará sorprendido.

**Comportamiento actual:**

Auto-cierre a las 22:00 (fallback de `preference.repository.ts`), o al valor configurado manualmente en `SystemPreference.general.business_hours_close`.

**Comportamiento esperado:**

O bien:
1. Cambiar el default en código a 14:00, o
2. Actualizar `CLAUDE.md` para documentar que el default real es 22:00 (y que puede configurarse).

**Corrección propuesta:**

Opción A: Cambiar default en `preference.repository.ts:54` de `22:00` a `14:00`.
Opción B: Actualizar `CLAUDE.md:406` de "14:00" a "22:00 (configurable)".

Recomendación: Verificar con el negocio cuál es la hora correcta, y aplicar consistentemente en docs + código.

**Prueba recomendada:**

1. Dejar una sesión de caja abierta.
2. Esperar a las 22:00 (o cambiar reloj del servidor a las 22:00).
3. Ejecutar el job `cashAutoClose` (o esperar a que se ejecute automáticamente cada 15 min).
4. Verificar que la sesión se cierre.

---

## HALLAZGOS ALTOS

### H-A001: Duplicación de Lógica de Conciliación de Caja en Frontend

**Severidad:** ALTA  
**Clasificación:** RIESGO (lógica de negocio duplicada)  
**Área:** Frontend  
**Archivo:** `frontend/src/features/income-statement/components/DayDetailDrawer.tsx`  
**Componente:** `DayDetailDrawer`  
**Función:** Renderizado de sesiones de caja, clasificación de estado  
**Línea:** 87-97  

**Problema:**

El frontend reconstruye la clasificación de estado de conciliación de caja por sesión individual, duplicando lógica que debería venir del backend:

```tsx
status={
  s.status === 'open'
    ? 'PENDIENTE'
    : s.difference === 0
      ? 'CUADRADA'
      : (s.difference ?? 0) > 0
        ? 'SOBRANTE'
        : 'FALTANTE'
}
```

Esto reimplementa en el cliente la regla de negocio para clasificar sesiones, comparando `difference === 0` estrictamente.

**Evidencia:**

Líneas 87-97 de `DayDetailDrawer.tsx`.

**Impacto:**

Si el backend introduce en el futuro una **tolerancia** para "cuadrada" (ej. `±$1`), este código del frontend quedaría desincronizado, permitiendo/bloqueando cosas que el backend no permite/bloquea.

**Comportamiento actual:**

Frontend clasifica como `CUADRADA` solo si `difference === 0`.

**Comportamiento esperado:**

El backend debería devolver un campo `status` pre-calculado para cada sesión (`CUADRADA`/`SOBRANTE`/`FALTANTE`/`PENDIENTE`), y el frontend solo lo mostraría.

**Corrección propuesta:**

1. En `income-statement.repository.ts::findSessionsInRange`, añadir un campo derivado `status` a cada sesión.
2. En el DTO de respuesta de `/day-detail`, incluir `sessions[].status`.
3. En `DayDetailDrawer.tsx`, usar directamente `s.status` en lugar de recalcular.

**Prueba recomendada:**

1. Cambiar la tolerancia de "cuadrada" en el backend a `±$1`.
2. Verificar que ambos frontend y backend clasifican la sesión igual.

---

### H-A002: Redondeo de Moneda a 0 Decimales en Toda la UI

**Severidad:** ALTA  
**Clasificación:** RIESGO (precisión monetaria)  
**Área:** Frontend  
**Archivo:** `frontend/src/shared/utils/formatCurrency.ts`  
**Componente:** `formatCurrency`  
**Función:** Formateo de valores monetarios  
**Línea:** 1-19  

**Problema:**

La función `formatCurrency` por defecto redondea a 0 decimales (pesos enteros):

```typescript
export function formatCurrency(value, options?) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 0,
  }).format(value)
}
```

Cuando se llama **sin opciones** (patrón predominante en `income-statement`), `Intl.NumberFormat` redondea a entero. Todos los montos del Estado de Resultados se muestran sin centavos.

**Evidencia:**

- `frontend/src/shared/utils/formatCurrency.ts` líneas 1-19.
- Usos en `income-statement`: `StatBlock.tsx:23`, `DayDetailDrawer.tsx:60/101-104/136`, `FinancialPivotTable.tsx:56`.
- Ninguno de estos usos pasa `options: { minimumFractionDigits: 2 }`.

**Impacto:**

En una UI donde se suman visualmente cifras individuales (tablas semanales/mensuales), el redondeo independiente de cada celda puede hacer que:
```
Σ(valores mostrados) ≠ (total mostrado)
```

Ejemplo:
- Día 1: $100.50 mostrado como $101 (redondeo 0.5 → 1)
- Día 2: $200.40 mostrado como $200 (redondeo 0.4 → 0)
- Suma mostrada: $301
- Total real: $300.90

Esto no afecta los datos reales (el backend mantiene precisión), pero puede confundir al usuario que compara visualmente.

**Comportamiento actual:**

Todos los montos se redondean a entero (0 decimales).

**Comportamiento esperado:**

Debería mostrarse al menos 1-2 decimales para precisión monetaria, especialmente en totales.

**Corrección propuesta:**

Cambiar el default de `formatCurrency` a `minimumFractionDigits: 2, maximumFractionDigits: 2`, o pasar explícitamente `options` en los usos de `income-statement`.

**Prueba recomendada:**

1. Crear un día con múltiples órdenes con centavos (ej. $100.50, $200.40).
2. Verificar que la suma visual de filas coincide con el total mostrado.

---

### H-A003: Dos Sistemas Paralelos de "Día de Negocio" (Backend)

**Severidad:** ALTA  
**Clasificación:** RIESGO (inconsistencia entre módulos)  
**Área:** Backend  
**Archivo:** `backend/src/utils/businessDate.ts` vs. `backend/src/repositories/dashboard.repository.ts`  
**Componente:** Cálculo de rangos de fecha  
**Función:** `getZonedDayBoundaries` vs. `getPeriodDateRange`  
**Línea:** businessDate.ts:1-50 vs. dashboard.repository.ts:13-55  

**Problema:**

El Estado de Resultados usa `businessDate.ts` (timezone-aware, `CASH_TIMEZONE`):
```typescript
// businessDate.ts — timezone-aware
getZonedDayBoundaries(dateStr, CASH_TIMEZONE)
getMonthRange(yearMonth)  // Usa CASH_TIMEZONE
```

Pero el Dashboard usa su propia lógica (`dashboard.repository.ts::getPeriodDateRange`):
```typescript
// dashboard.repository.ts — usa new Date() del servidor
const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

**Evidencia:**

- `businessDate.ts:1-50`: comentario explícito "sincroniza con cash.service.ts", usa `Intl.DateTimeFormat` con `timeZone`.
- `dashboard.repository.ts:13-55`: usa `new Date()` del reloj del servidor (UTC, no timezone-aware).

**Impacto:**

Si el servidor corre en UTC pero `CASH_TIMEZONE='America/Mexico_City'`:
- Estado de Resultados calcula "hoy" como el día UTC-6.
- Dashboard calcula "hoy" como el día UTC.
- Las dos vistas muestran datos de "hoy" diferente.

**Comportamiento actual:**

Estado de Resultados y Dashboard usan definiciones diferentes de "día de negocio".

**Comportamiento esperado:**

Ambos deben usar la misma zona horaria (`CASH_TIMEZONE`).

**Corrección propuesta:**

Refactorizar `dashboard.repository.ts::getPeriodDateRange` para usar `businessDate.ts` (o la inversa, unificar bajo un único módulo de fechas).

**Prueba recomendada:**

1. Configurar servidor en UTC, negocio en UTC-6 (México).
2. Crear órdenes a las 20:00 UTC (14:00 México).
3. Verificar que Estado de Resultados y Dashboard muestren la venta en la misma fecha.

---

### H-A004: No Existe Funcionalidad de "Reapertura" de Sesión de Caja Cerrada

**Severidad:** ALTA  
**Clasificación:** MEJORA / REGLA DE NEGOCIO NO DEFINIDA  
**Área:** Backend  
**Archivo:** Múltiples (`cash.service.ts`, `cash.repository.ts`, `cash.routes.ts`)  
**Componente:** Ciclo de vida de sesión  
**Función:** N/A (funcionalidad ausente)  
**Línea:** N/A  

**Problema:**

El ciclo de vida de `CashSession` es: **abrir → cerrar → corregir cierre → fin**.

No existe endpoint para **reabrir** una sesión ya cerrada si se comete un error.

**Evidencia:**

- Búsqueda en `cash.routes.ts`: no hay ruta `POST /sessions/:id/reopen` ni similar.
- Búsqueda en `cash.service.ts`/`cash.repository.ts`: no hay función `reopenSession`.
- El único mecanismo para ajustar es `correctClosing` (corregir el monto de cierre de una sesión ya cerrada), que **no reabre** la sesión.

**Impacto:**

Si un cajero cierra por error una caja que debería seguir abierta, no hay forma de "volver atrás" (excepto un job administrativo manual en BD o una corrección posterior del monto de cierre, que no es lo mismo).

**Comportamiento actual:**

No se puede reabrir una sesión cerrada.

**Comportamiento esperado:**

Probablemente debería existir una opción de "Reapertura" con auditoría, solo para usuarios con permiso `cash.reopen` (si existe).

**Corrección propuesta:**

Crear endpoint `POST /sessions/:id/reopen` que:
1. Valida que la sesión esté cerrada.
2. Vuelve a poner `status: 'open'`.
3. Registra auditoría con usuario y razón.
4. Invalida el snapshot del día.

**Prueba recomendada:**

1. Cerrar sesión de caja.
2. Intentar reabrir — debe tener un endpoint `/reopen`.

---

## HALLAZGOS MEDIOS

### H-M001: Feature Nuevo "daily-orders" sin Tests

**Severidad:** MEDIA  
**Clasificación:** MEJORA  
**Área:** Frontend  
**Archivo:** `frontend/src/features/daily-orders/**`  
**Componente:** `DailyOrdersPage`, hooks, API  
**Función:** N/A  
**Línea:** N/A  

**Problema:**

El feature nuevo `daily-orders` (sin trackear en git) es un consumidor puro del endpoint `/orders/by-date?date=YYYY-MM-DD`, permitiendo ver órdenes del día y cancelarlas. **No hace cálculos financieros propios** (confirmado por auditoría de código), pero:

1. **Hereda el bug de zona horaria** (`getTodayDateString()` usa `toISOString().slice(...)`).
2. **No tiene tests** (no existe `daily-orders.test.ts`).
3. **Es una nueva funcionalidad** y debería tener cobertura de tests básicos.

**Evidencia:**

- `frontend/src/features/daily-orders/pages/DailyOrdersPage.tsx` línea 9-11: bug de zona horaria.
- No se encontró `frontend/src/features/daily-orders/__tests__/` ni `*.test.ts`.

**Impacto:**

Bajo (no hace lógica financiera), pero **la falta de tests aumenta riesgo de regresiones**.

**Comportamiento actual:**

No hay cobertura de tests.

**Comportamiento esperado:**

Debería haber tests para:
- Rendering de tabla de órdenes.
- Paginación si la hay.
- Cancelación de orden.
- Manejo de errores (ej. sin órdenes ese día).

**Corrección propuesta:**

Crear `frontend/src/features/daily-orders/__tests__/daily-orders.test.tsx` con casos de prueba básicos.

**Prueba recomendada:**

1. Escribir test que renderiza `DailyOrdersPage` con órdenes mock.
2. Verificar que la tabla se renderiza.
3. Verificar que al clickear "Cancelar", se llama a la API correcta.

---

### H-M002: No Existe Endpoint de Validación de Consistencia de Caja

**Severidad:** MEDIA  
**Clasificación:** MEJORA  
**Área:** Backend  
**Archivo:** `backend/src/routes/cash.routes.ts`, `backend/src/services/cash.service.ts`  
**Componente:** Auditoría de caja  
**Función:** N/A (ausente)  
**Línea:** N/A  

**Problema:**

No existe un endpoint administrativo que:
1. Sume `CashMovement.amount` por sesión.
2. Compare contra `CashSession.expectedAmount`.
3. Reporte discrepancias.

Esto sería útil para auditoría/reconciliación programada.

**Evidencia:**

- No hay ruta en `cash.routes.ts` como `GET /sessions/reconcile` o similar.
- No hay job periodizado.

**Impacto:**

Sin esta validación, un bug en cualquier ruta que actualiza `expectedAmount` podría pasar desapercibido indefinidamente.

**Comportamiento actual:**

No hay mecanismo de validación.

**Comportamiento esperado:**

Debería existir un job o endpoint que alerte de discrepancias.

**Corrección propuesta:**

Crear:
1. `backend/src/jobs/cashReconciliation.job.ts`: job que cada 1-2 horas suma movimientos vs. `expectedAmount`.
2. Endpoint `GET /sessions/:sessionId/reconcile` (permiso `cash.read`) que valida una sesión específica.

---

### H-M003: Falta Especificación de "Total Esperado en Caja (EFECT. Y TRANS.)"

**Severidad:** MEDIA  
**Clasificación:** REGLA DE NEGOCIO NO DEFINIDA  
**Área:** Contabilidad  
**Archivo:** N/A  
**Componente:** DTO del Estado de Resultados  
**Función:** N/A  
**Línea:** N/A  

**Problema:**

El usuario menciona en el brief una fila prevista:

> "Existe también una fila planeada: Total esperado en caja (EFECT. Y TRANS)"

**Auditoría confirmó:** No existe actualmente ningún campo/fila en el Estado de Resultados que combine "efectivo esperado + transferencias cobradas".

**Evidencia:**

- Búsqueda en `income-statement.service.ts`: no hay campo `expectedCashAndTransfer` ni similar.
- DTO `DayFinancialSummary` incluye `expectedCash`, `actualCash`, `cashDifference`, pero no un "total esperado que incluya transferencias".

**Impacto:**

Sin claridad sobre qué significa esta fila, no se puede implementar. Especialmente importante porque el usuario insiste en separar:
- Efectivo esperado (sin transferencias).
- Ingresos totales (con transferencias).

**Comportamiento actual:**

No existe la fila.

**Comportamiento esperado:**

Debe decidirse si es una funcionalidad requerida o una idea descartada.

**Corrección propuesta:**

REGLA DE NEGOCIO DECISION PENDIENTE:
- ¿Debe existir una fila "Total esperado (Efectivo + Transferencias)"?
- ¿Cuál sería su utilidad frente a "ingresos totales"?
- ¿Cuándo debería usarse?

---

## HALLAZGOS BAJOS

### H-B001: Comentario Desincronizado en cash.service.ts

**Severidad:** BAJA  
**Clasificación:** BUG CONFIRMADO (documentación)  
**Área:** Documentación  
**Archivo:** `backend/src/services/cash.service.ts`  
**Componente:** Comentario en `closeIfBusinessDayEnded`  
**Función:** `closeIfBusinessDayEnded`  
**Línea:** 101  

**Problema:**

Comentario afirma fallback a 14:00, pero el código retorna el valor de `PreferenceRepository.getGeneralPreferences()`, que es 22:00.

**Evidencia:**

- Línea 101: `// fallback to 14:00 if not set`
- Línea 54 de `preference.repository.ts`: `business_hours_close: '22:00'`

**Impacto:** Menor (solo confunde al lector del código).

**Corrección propuesta:** Actualizar comentario a "fallback to 22:00".

---

### H-B002: No Validación de Bloqueo de Edición de Gasto en Sesión Cerrada es Solo en Service

**Severidad:** BAJA  
**Clasificación:** MEJORA  
**Área:** Backend  
**Archivo:** `backend/src/services/expense.service.ts`  
**Componente:** `ExpenseService`  
**Función:** `update`, `remove`  
**Línea:** 121-123, 228-230  

**Problema:**

La validación que bloquea edición de gastos vinculados a sesiones cerradas está en el service, pero un cliente directo de la API (sin pasar por el service) podría saltarla si llama al repositorio.

**Evidencia:**

- Bloqueo en service (líneas 121-123, 228-230) con `CashBusinessRuleError`.
- No hay validación redundante en el repositorio.

**Impacto:** Muy bajo (la API va siempre a través del service en la arquitectura actual).

**Corrección propuesta:** Documentar que esta validación es responsabilidad del service, no del repo.

---

## MAPA DEL FLUJO FINANCIERO COMPLETO

```
1. VENTA
   └─ Archivo: backend/src/services/order.service.ts
   └─ Función: createOrder → líneas 378-457
   └─ Fuente de verdad: Order.total, Order.totalCost, OrderItem.costSnapshot
   └─ Transformación: Suma de items + extras, aplicación de descuentos
   └─ Riesgo: Ninguno detectado (costSnapshot se congela correctamente)

2. PAGO
   └─ Archivo: backend/src/services/order.service.ts, repositories/order.repository.ts
   └─ Función: Crear Payment en línea 527-535
   └─ Fuente de verdad: Payment.method, Payment.amount, Payment.status
   └─ Transformación: Normalización de método (ES→canónico) en validator
   └─ Riesgo: Payment.method es string libre, sin enum — permite valores inválidos

3. MÉTODO DE PAGO
   └─ Archivo: backend/src/repositories/income-statement.repository.ts
   └─ Función: findPaymentsInRange (líneas 124-147)
   └─ Fuente de verdad: Payment.method ('cash', 'transfer', 'card', 'pending')
   └─ Transformación: Agrupación en 3 categorías (cash, transfer, otros)
   └─ Riesgo: Solo se consideran pagos con status='paid' → pagos 'pending' se excluyen

4. EFECTIVO vs. TRANSFERENCIA
   └─ Archivo: backend/src/repositories/cash.repository.ts
   └─ Función: CashSession.expectedAmount (solo cash afecta)
   └─ Fuente de verdad: CashSession.expectedAmount es contador incremental
   └─ Transformación: increment/decrement en cada venta/gasto/delivery cash
   └─ Riesgo: CRÍTICO — no se recalcula desde CashMovement, sin reconciliación

5. CAJA (Sesiones)
   └─ Archivo: backend/src/services/cash.service.ts, repositories/cash.repository.ts
   └─ Función: openSession → closeSession → correctClosing
   └─ Fuente de verdad: CashSession (status, openingAmount, expectedAmount, closingAmount, difference)
   └─ Transformación: difference = closingAmount - expectedAmount
   └─ Riesgo: No existe reapertura si se cierra por error

6. INVENTARIO / COSTO (COGS)
   └─ Archivo: backend/src/repositories/income-statement.repository.ts
   └─ Función: findCogsInRange (línea 149-151)
   └─ Fuente de verdad: OrderItem.costSnapshot (congelado al crear orden)
   └─ Transformación: Suma solo de órdenes completadas (status='completed')
   └─ Riesgo: CRÍTICO — no se resta de netProfit (regla de negocio no definida)

7. GASTOS
   └─ Archivo: backend/src/repositories/income-statement.repository.ts
   └─ Función: findExpensesInRange + findPurchasesInRange
   └─ Fuente de verdad: Expense + Purchase(status='received') dentro de horario de negocio
   └─ Transformación: Filtrado por businessHoursOpen/Close
   └─ Riesgo: CRÍTICO — gastos fijos documentados como convención no forzada (doble-conteo posible)

8. RESULTADO (netProfit)
   └─ Archivo: backend/src/services/income-statement.service.ts
   └─ Función: computeDayCore (línea 208)
   └─ Fuente de verdad: netProfit = totalRevenue - totalExpenses
   └─ Transformación: Suma de ingresos por método, resta de gastos totales
   └─ Riesgo: totalCogs no se resta (no es un bug, regla de negocio no definida)

9. DINERO DISPONIBLE PARA DISTRIBUCIÓN
   └─ Archivo: backend/src/services/income-statement.service.ts
   └─ Función: computeDayCore (línea 211)
   └─ Fuente de verdad: distributableProfit = netProfit - fixedOperatingExpenses
   └─ Transformación: Descuento de $260/día si hay operación
   └─ Riesgo: Gastos fijos de origen dualizados (SystemPreference + posible Expense manual)

10. AHORRO / FONDO NEGOCIO / SURTIDO
    └─ Archivo: backend/src/services/income-statement.service.ts
    └─ Función: computeDayCore (líneas 230-238)
    └─ Fuente de verdad: Porcentajes configurables (default 10/20/70%)
    └─ Transformación: savingsAmount = distributableProfit × 10%, etc. (Surtido absorbe residuo)
    └─ Riesgo: Base de cálculo es distributableProfit (que no descuenta COGS)

11. ACUMULADOS
    └─ Archivo: backend/src/services/income-statement.service.ts
    └─ Función: computeDaySequence (líneas 414-516)
    └─ Fuente de verdad: IncomeStatementDailySnapshot (savingsAccumulated, etc.)
    └─ Transformación: Encadenamiento día a día, congelado solo si día está "final" (no hay sesiones abiertas)
    └─ Riesgo: Pueden editarse manualmente (correcta auditoría), pero si hay sesión abierta, nunca se congelan

12. ESTADO DIARIO
    └─ Archivo: backend/src/services/income-statement.service.ts
    └─ Función: getDayFinancials → getDayDetail
    └─ Fuente de verdad: IncomeStatementDailySnapshot (si está congelado) o recalcular con computeDayCore
    └─ Transformación: Agrupación de todos los valores anteriores en un DTO
    └─ Riesgo: Snapshot cache es la única protección contra recálculos innecesarios — si se invalida por error, no se recupera

13. ESTADO MENSUAL
    └─ Archivo: backend/src/services/income-statement.service.ts
    └─ Función: getMonthFinancials (línea 640-643)
    └─ Fuente de verdad: Suma de getWeekFinancials/getDayFinancials via computeTotals
    └─ Transformación: computeTotals suma todos los campos de cada día (líneas 523-542)
    └─ Riesgo: Bajo — el total mensual se construye sumando los días, no con una query agregada aparte

14. FRONTEND (Presentación)
    └─ Archivo: frontend/src/features/income-statement/**
    └─ Función: Lectura de DTO, renderizado en componentes
    └─ Transformación: formatCurrency redondea a 0 decimales (riesgo de discrepancias visuales)
    └─ Riesgo: DayDetailDrawer recalcula estado de caja (duplicación de lógica), redondeo visual
    └─ Zona horaria: Bug en 5+ archivos (toISOString) — afecta qué "hoy" se muestra
```

---

## FUENTES DE VERDAD

1. **Ingresos por método**: `Payment.method` (aggr. en `findPaymentsInRange`)
2. **Efectivo esperado**: `CashSession.expectedAmount` (contador incremental)
3. **Efectivo real**: `CashSession.closingAmount`
4. **Costo de ventas**: `OrderItem.costSnapshot` (congelado al crear)
5. **Gastos variables**: `Expense.amount` (fecha dentro de horario) + `Purchase.total` (status='received')
6. **Gastos fijos**: `SystemPreference.expenses.fixed.*` (default `general=$260/día`)
7. **Distribución**: Porcentajes en `SystemPreference.income_statement.distribution.*` (default 10/20/70%)
8. **Acumulados**: `IncomeStatementDailySnapshot` (encadenado día a día)
9. **Estado de resultados**: `IncomeStatementDailySnapshot` (si está congelado) o recálculo en vivo

---

## CÁLCULOS DUPLICADOS

1. **Estado de caja (`CUADRADA`/`SOBRANTE`/`FALTANTE`)**: Backend en `computeDayCore` (línea 221-227), Frontend en `DayDetailDrawer.tsx` (línea 87-97) — riesgo si backend añade tolerancia.
2. **Suma de gastos fijos conceptos**: Backend en `getDailyFixedExpenseTotal`, Frontend en `FixedExpenseSettingsForm.tsx` (línea 97) — solo de presentación, bajo riesgo.
3. **Validación de % distribución**: Backend en `distributionSettingsSchema`, Frontend en `DistributionSettingsForm.tsx` (línea 23) — redundancia aceptable (cliente + servidor).

---

## INCONSISTENCIAS FRONTEND / BACKEND

1. **Zona horaria**: Frontend (`toISOString()` UTC) ≠ Backend (`CASH_TIMEZONE` timezone-aware). Crítico, afecta "hoy".
2. **Redondeo visual**: Frontend (`formatCurrency` a 0 decimales) ≠ Backend (mantiene precisión). Bajo riesgo, pero puede confundir.
3. **Clasificación de estado de caja**: Frontend recalcula (línea 87-97) vs. Backend podría tener tolerancia. Alto riesgo.

---

## INCONSISTENCIAS ESTADO DIARIO vs. MENSUAL

Ninguna detectada. El estado mensual se construye sumando días via `computeTotals()` (línea 523-542), que sima todos los campos sin omisiones.

Verificación: `computeTotals` suma:
```typescript
ingresosEfectivo, ingresosTransferencia, ingresosOtros, ingresosTotales,
costoVenta, gastos, gananciaNeta,
gastosOperativosFijos, gananciaDistribuible,
ahorro, fondoNegocio, surtido,
lastAccumulated (solo la última fecha del periodo)
```

Esto es correcto: La suma de días = el total del período.

---

## RIESGOS CONTABLES

1. **Doble-descuento potencial de COGS**: Si `insumos` se registran como `Expense` categoría con costo real, y además se suma `totalCogs`, se descuenta dos veces. Necesita clarificación sobre cómo entran los insumos.
2. **Doble-descuento de gastos fijos**: Convención no forzada de no re-registrar `nomina`/`servicios` si ya existen como gastos fijos. Sin validación, un usuario puede duplicar.
3. **Base de distribución potencialmente incorrecta**: Si `distributableProfit` no descuenta el costo real de lo vendido, el dinero repartido puede ser incorrecto. Depende de la definición de negocio.
4. **Gastos fuera del horario de negocio**: Gastos registrados fuera de `businessHoursOpen`/`businessHoursClose` no cuentan en `totalExpenses`. Auditoría correcta, pero debe estar documentada.

---

## RIESGOS DE DATOS

1. **Inconsistencia de expectedAmount**: Contador incremental sin reconciliación. Si una transacción falla parcialmente, queda desincronizado. Riesgo alto.
2. **Snapshot cache frágil**: Días con sesiones abiertas nunca se congelan. Si las sesiones se quedan abiertas indefinidamente (bug), los datos nunca se materializan.
3. **Reapertura imposible**: No hay forma de reabrir una sesión cerrada por error. Requiere intervención manual en BD.
4. **Edición de saldos acumulados sin validación de limpieza**: Aunque hay regla de no editar días pasados, la integridad del encadenamiento de acumulados depende de que las ediciones sean coherentes.

---

## RIESGOS DE SEGURIDAD

1. **Acceso sin scoping por sucursal/caja**: Rutas de `income-statement` solo validan `requireAuth` + `checkPermission('dashboard.read')`. Un usuario con ese permiso ve datos de todas las cajas. Esto es aceptable si la intención es un dashboard admin global, pero debería documentarse.
2. **Manipulación de fechas en query params**: Endpoints aceptan `date`, `month`, `from`/`to` sin restricción de rango histórico. Un usuario admin podría ver/editar datos de hace años. Bajo riesgo si solo hay usuarios de confianza, pero no hay rate-limiting por período.
3. **Validación de zona horaria confiada al cliente**: El frontend calcula "hoy" con `toISOString()` (bug), pero el backend no valida la zona horaria. Aunque es bug de frontend, el backend debería ser más defensivo.

---

## PRUEBAS FALTANTES

### Backend

1. **income-statement.test.ts / integration tests**: Verificar cobertura de:
   - Día sin ventas
   - Día sin gastos
   - Día solo con transferencias (sin efectivo)
   - Día con devolución/cancelación (verificar no doble-conteo)
   - Cambio de mes (29 de feb, últimos días del mes)
   - Cambio de año
   - Sesión abierta (estado='PENDIENTE')
   - Sesión con diferencia de caja
   - Múltiples sesiones en un día
   - Edición de saldos acumulados retroactivamente

2. **expense.service.ts**: Actualmente NO hay test dedicado. Debe crear:
   - Gasto cash → afecta expectedAmount
   - Gasto no-cash → no afecta expectedAmount
   - Edición de gasto cash en sesión abierta → actualiza delta correctamente
   - Edición de gasto cash en sesión cerrada → bloquea
   - Eliminación de gasto cash → revierte correctamente

3. **cash.service.ts**: Verificar (si no existen aún):
   - Cierre automático a las 22:00 (o la hora configurada)
   - Concurrencia (múltiples cajas abiertas al mismo tiempo)
   - Rollback de transacción (si falla algo medio camino)

### Frontend

1. **income-statement feature**:
   - Renderizado de día sin datos
   - Selector de fecha (especialmente zona horaria — a las 20:00 UTC-6, ¿muestra día correcto?)
   - Edición de saldos acumulados (¿es editable hoy? ¿no lo es días pasados?)
   - Redondeo visual (sumas de filas = total)

2. **daily-orders feature**:
   - Cancelación de orden
   - Error al cargar órdenes
   - Zona horaria del selector "hoy"

---

## DECISIONES DE NEGOCIO — RESUELTAS ✅

Basadas en respuestas del usuario (21/09/2026):

### ✅ D1: ¿Debe COGS Restarse de Dinero Disponible para Distribución?

**Decisión:** ✅ **RESUELTO — NO DEBE RESTARSE**

El usuario clarificó la regla de negocio:

1. **Cuando se compra inventario:** Se descuenta del **fondo del negocio acumulado** (no entra como gasto diario).
2. **Cuando se vende:** El costo (`costSnapshot`) es **solo informativo** — nunca se resta.
3. **Fórmula correcta:** `distributableProfit = netProfit - fixedOperatingExpenses` (sin COGS, porque ya fue pagado del fondo al comprar).

**Ejemplo:**
```
Compra: $1000 café → fondo disminuye $1000
Venta: $2000 café (costo $500) →
  netProfit = 2000 - 260 (fijos) = 1740
  distributableProfit = 1740 (sin descontar $500 COGS, porque ya fue pagado al comprar)
```

**Acción:** 
- ✅ **El sistema está implementado correctamente.**
- Mejorar comentario en `income-statement.service.ts:185` para aclarar que COGS es informativo porque Andy's descuenta costos del fondo, no de utilidades.
- No cambiar ninguna fórmula de cálculo.

**Status:** ✅ Fase 0 completa. Proceder a Fases 1-4.

---

### ✅ D2: Fila "Total Esperado en Caja (EFECT. + TRANS.)"?

**Decisión:** ✅ **SÍ, IMPLEMENTAR**

El usuario respondió: *"Sí, mostrar total combinado."*

**Acción:** Añadir campo a backend y mostrar en UI:

Backend (`income-statement.service.ts`, línea ~255):
```typescript
expectedCashAndTransfer = expectedCash + ingresosTransferencia
```

DTO `DayFinancialSummary`:
```typescript
export interface ConciliacionCaja {
  expectedCash: number;
  ingresosTransferencia: number;
  expectedCashAndTransfer: number;  // ← NUEVO
  actualCash: number;
  cashDifference: number;
  cashStatus: 'CUADRADA' | 'SOBRANTE' | 'FALTANTE' | 'PENDIENTE';
}
```

Frontend: Mostrar fila adicional con el nuevo valor en tablas diarias/mensuales.

**Utilidad:** Ver de un vistazo el total de dinero cobrado que entra al sistema (sin esperar conciliación de transferencias bancarias).

---

### ✅ D3: Hora Auto-Cierre de Caja?

**Decisión:** ✅ **CONFIGURABLE (CORRECTO TAL COMO ESTÁ)**

El usuario respondió: *"Según la configuración en preferencias."*

**Acción:** 
- **Código:** Mantener como está (configurable en `SystemPreference.general.business_hours_close`).
- **Documentación:** Actualizar:
  - `CLAUDE.md:406`: Cambiar de "14:00 local time" a "**22:00 por defecto (configurable en Preferencias del Sistema)**"
  - `cash.service.ts:101`: Cambiar comentario de "fallback to 14:00" a "fallback to 22:00 from preferences"

No se requiere cambio de código, solo alineación de documentación.

**Resultado:** La documentación y el código quedarán sincronizados.

---

### ✅ D4: Reapertura de Sesión de Caja?

**Decisión:** ✅ **SÍ, ADMIN PUEDE REABRIR**

El usuario respondió: *"Sí, cualquier admin debe poder reabrir."*

**Acción:** Implementar nuevo endpoint (Fase 2):

```typescript
// backend/src/routes/cash.routes.ts
router.post('/sessions/:sessionId/reopen', checkPermission('cash.close'), reopenCashSession);

// backend/src/services/cash.service.ts
async reopenCashSession(sessionId: string, reopenedById: string, input: { reason?: string }) {
  // Validar que sesión existe y status='closed'
  // Poner status='open' nuevamente
  // Registrar AuditLog con CASH_SESSION_REOPENED + reason
  // Invalidar snapshot del día
  // Notificar a ADMIN/CAJERO
  return session
}
```

Permisos: `cash.close` (reutilizar existente, o crear `cash.reopen` si se prefiere.)

---

### ✅ D5: Validación de Gastos Fijos Duplicados?

**Decisión:** ⚠️ **ALERTAR (WARNING), PERO PERMITIR**

El usuario respondió: *"Alertar (warning) pero permitir."*

**Acción:** Implementar validación en backend (Fase 2):

`backend/src/validators/expense.validator.ts`:
```typescript
export const createExpenseSchema = z.object({
  category: z.enum(['insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'mandadito', 'otros']),
  amount: z.number().positive(),
  // ... otros campos ...
}).refine(
  async (input) => {
    if (['nomina', 'servicios'].includes(input.category)) {
      const fixedExpenses = await getFixedExpenseConcepts();
      if (fixedExpenses.length > 0) {
        // Retornar true (permitir), pero incluir warning en response
        console.warn(`⚠️ Cuidado: Gastos fijos ya se descuentan automáticamente. Verificar que no esté duplicando.`);
      }
    }
    return true; // Permitir de todas formas
  }
)
```

Frontend: Mostrar banner de advertencia si el backend devuelve un warning.

---

### ✅ D6: Job de Reconciliación de expectedAmount?

**Decisión:** ✅ **SÍ, EJECUTAR A FIN DE DÍA**

El usuario respondió: *"Sí, pero solo a fin de día."*

**Acción:** Crear job que se ejecute diariamente a las 23:30 (Fase 2):

`backend/src/jobs/cashReconciliation.job.ts`:
```typescript
// Ejecutar: 23:30 cada día (configurable)
export async function reconcileCashSessions() {
  const yesterday = getTodayInZone() - 1 day;
  
  const sessions = await findSessionsInRange(yesterday, yesterday);
  
  for (const session of sessions) {
    if (session.status === 'open') {
      console.warn(`Sesión ${session.id} sigue abierta después de horario de negocio`);
      continue;
    }
    
    // Sumar todos los movimientos de la sesión
    const sumMovements = await sumCashMovementsBySession(session.id);
    
    // Comparar contra expectedAmount (tolerancia: $0.50 o configurable)
    const discrepancy = Math.abs(session.expectedAmount - sumMovements);
    if (discrepancy > TOLERANCE) {
      await createAuditLog({
        action: 'CASH_RECONCILIATION_DISCREPANCY',
        cashSessionId: session.id,
        metadata: {
          expectedAmount: session.expectedAmount,
          sumMovements: sumMovements,
          discrepancy: discrepancy,
        },
      });
      
      console.error(`⚠️ DISCREPANCIA DE CAJA [${session.id}]: esperado=${session.expectedAmount}, movimientos=${sumMovements}, diff=${discrepancy}`);
    }
  }
}
```

**Ejecución:** Diaria a las 23:30 (configurada en `CronCreate`), solo **alerta** (no auto-corrige).

---

## RESUMEN DE DECISIONES — TODAS RESUELTAS

| ID | Decisión | Resolución | Acción | Fase | Status |
|---|----------|-----------|--------|------|--------|
| D1 | COGS en distribución | ✅ No debe restarse | Mejorar comentario (informativo) | Fase 0 | ✅ RESUELTO |
| D2 | Fila E+T | ✅ Sí | Añadir `expectedCashAndTransfer` al DTO | Fase 2 | Pendiente |
| D3 | Hora auto-cierre | ✅ Configurable (OK) | Actualizar docs: "22:00 por defecto" | Fase 1 | ⏳ Próximo |
| D4 | Reapertura sesión | ✅ Sí, admin | Implementar `POST /sessions/:id/reopen` | Fase 2 | Pendiente |
| D5 | Validación gastos fijos | ⚠️ Warning | Añadir validación que alerte pero permita | Fase 2 | Pendiente |
| D6 | Reconciliación caja | ✅ A fin de día | Job diario 23:30 que valida `expectedAmount` | Fase 2 | Pendiente |

**Diagrama de dependencias:**
```
Fase 0 (✅ RESUELTO)
    ↓
Fase 1 (⏳ PRÓXIMO — Docs)
    ↓
Fases 2-4 (Parallelizables — Implementación)
```

---

## PLAN DE CORRECCIÓN ORDENADO

**Orden de prioridad: Impacto financiero > Severidad > Dependencias > Dificultad**

Basado en decisiones del usuario ya resueltas (ver sección anterior).

### Fase 0 — Bloqueante (Auditoría de COGS)

1. **AUDITAR: Cómo Entra el Costo de Inventario a totalExpenses** (D1)
   - Impacto: ALTO (bloquea decisión sobre fórmula de distribución)
   - Dependencia: Auditoría de código (no técnica)
   - Dificultad: Media (investigación)
   - **Acción:** 
     - ¿Se registran compras como `Purchase` con `status='received'`? ¿Cuándo se descuentan?
     - ¿Se registran gastos como `Expense` categoría `insumos`?
     - Flujo exacto del costo de inventario desde compra → uso → incluir en `totalExpenses` o no.
   - **Resultado esperado:** Decidir si `distributableProfit` debe incluir descuento de COGS o no.
   - **Bloqueador:** No implementar cambios hasta que esta auditoría esté hecha.

---

### Fase 1 — Documentación (Cambios Triviales, NO requieren Tests)

1. **Actualizar Documentación de Hora Auto-Cierre** (D3 - ya decidido)
   - Archivos: `CLAUDE.md:406`, `backend/src/services/cash.service.ts:101`
   - Cambio: "14:00 local time" → "**22:00 por defecto (configurable en Preferencias del Sistema)**"
   - Dificultad: Trivial
   - **Acción:** Encontrar y reemplazar 2 líneas.
   - Verificación: `git diff` debe mostrar solo cambios en docs y comentarios.

---

### Fase 2 — Bugs Críticos (Alta Prioridad, requieren Tests)

1. **Fijar Bug de Zona Horaria en Frontend** (H-C002)
   - Archivos: `IncomeStatementPage.tsx`, `SaldosAcumuladosSection.tsx`, `EditAccumulatedBalancesModal.tsx`, `DailyOrdersPage.tsx`, `InventoryPhysical.tsx`
   - Cambio: Reemplazar `new Date().toISOString().slice(...)` con `Intl.DateTimeFormat`
   - Dificultad: Baja
   - **Acción:** Usar patrón correcto para calcular "hoy" en zona local (México).
   - **Test:** Simular hora 20:00 México, verificar que "hoy" es correcto, que se puede editar saldos acumulados del día local.

2. **Implementar Fila "Total Esperado (Efectivo + Transferencias)"** (D2 - ya decidido)
   - Backend: Añadir campo `expectedCashAndTransfer` a DTO `DayFinancialSummary` (línea ~250 de income-statement.service.ts)
   - Frontend: Mostrar fila nueva en tablas diarias/mensuales
   - Dificultad: Baja
   - **Test:** Día con $1000 efectivo + $500 transferencias → fila muestra $1500.

3. **Unificar Sistema de "Día de Negocio"** (H-A003)
   - Archivo: `backend/src/repositories/dashboard.repository.ts::getPeriodDateRange`
   - Cambio: Usar `businessDate.ts` (timezone-aware) en lugar de `new Date()` del servidor
   - Dificultad: Media (refactorizar 50 líneas)
   - **Test:** Dashboard y Estado de Resultados muestran datos de la misma fecha en horario México.

---

### Fase 3 — Riesgos Medios (Implementación, requieren Tests)

1. **Implementar Reapertura de Sesión de Caja** (D4 - ya decidido)
   - Backend: 
     - Nuevo endpoint: `POST /api/cash-register/sessions/:sessionId/reopen`
     - Nueva función: `reopenCashSession` en `cash.service.ts`
     - Nueva función: `reopenCashSession` en `cash.repository.ts`
     - Nueva ruta en `cash.routes.ts`
   - Dificultad: Media
   - **Test:** 
     - Cerrar sesión, luego reabrir con `POST /sessions/:id/reopen`.
     - Verificar que sesión está abierta de nuevo.
     - Verificar auditoría registra el evento.
     - Verificar snapshot se invalidó.

2. **Añadir Validación de Warning para Gastos Fijos Duplicados** (D5 - ya decidido)
   - Archivo: `backend/src/validators/expense.validator.ts`
   - Cambio: Añadir `.refine()` que alerte si se registra `Expense` categoría `nomina`/`servicios` cuando existen gastos fijos
   - Dificultad: Baja
   - **Test:**
     - Crear `Expense` categoría `nomina` cuando ya existen gastos fijos → API devuelve warning.
     - Gasto se crea de todas formas (permitir, no bloquear).
     - Frontend muestra banner de advertencia.

3. **Añadir Job de Reconciliación de expectedAmount** (D6 - ya decidido)
   - Archivo: `backend/src/jobs/cashReconciliation.job.ts` (nuevo)
   - Cambio: Job que corre diariamente a las 23:30, valida `expectedAmount = Σ CashMovement` con tolerancia $0.50
   - Dificultad: Media
   - **Test:**
     - Sesión cerrada con movimientos correctos → sin alerta.
     - Sesión con `expectedAmount` desincronizado → alerta en log + AuditLog.

4. **Sacar Lógica de Conciliación de Caja del Frontend** (H-A001)
   - Backend: Añadir campo `status` calculado a sesiones en `/day-detail`
   - Frontend: Usar `status` en lugar de recalcular
   - Dificultad: Media
   - **Test:** Cambiar tolerancia de conciliación en backend → Frontend refleja cambio automáticamente.

---

### Fase 4 — Mejoras (Bajo Impacto, Calidad)

1. **Fijar Redondeo de Moneda a 2 Decimales** (H-A002)
   - Archivo: `frontend/src/shared/utils/formatCurrency.ts` + usos en `income-statement`
   - Cambio: Pasar `minimumFractionDigits: 2, maximumFractionDigits: 2` a `formatCurrency`
   - Dificultad: Baja
   - **Test:** Día con centavos, verificar que suma visual de filas = total mostrado.

2. **Añadir Tests a daily-orders** (H-M001)
   - Archivo: `frontend/src/features/daily-orders/__tests__/daily-orders.test.tsx` (nuevo)
   - Cambio: Tests básicos de renderizado, paginación (si la hay), cancelación
   - Dificultad: Baja
   - **Tests incluyen:**
     - Renderiza tabla con órdenes mock.
     - Botón "Cancelar" hace POST `/orders/:id/cancel` correcto.
     - Error handling (sin órdenes ese día).

---

### Resumen de Implementación

| Fase | Item | Dependencias | Esfuerzo | Bloqueo |
|------|------|--------------|----------|---------|
| **0** | Auditar COGS | Investigación | 3 días | Bloquea Fase 2-4 si el resultado cambia |
| **1** | Docs (hora auto-cierre) | Nada | 15 min | Ninguno |
| **2a** | Bug zona horaria | Nada | 4 horas | Crítico |
| **2b** | Fila E+T | D2 resuelto | 3 horas | Ninguno |
| **2c** | Dashboard timezone | Nada | 4 horas | Bajo |
| **3a** | Reapertura sesión | D4 resuelto | 6 horas | Ninguno |
| **3b** | Warning gastos fijos | D5 resuelto | 2 horas | Bajo |
| **3c** | Job reconciliación | D6 resuelto | 8 horas | Bajo |
| **3d** | Status de caja en DTO | Nada | 4 horas | Bajo |
| **4a** | Redondeo moneda | Nada | 2 horas | Ninguno |
| **4b** | Tests daily-orders | Nada | 3 horas | Ninguno |

**Ruta crítica:** Fase 0 → Fase 1 → Fase 2a,2b → Fase 3a,3b,3c,3d → Fase 4  
**Tiempo estimado total:** 5-7 semanas (Fase 0 bloqueante, resto parallelizable)

---

## CONCLUSIONES

La implementación del Estado de Resultados de Andy's Coffee es **sólida en su núcleo** (arquitectura de cálculo diario, encadenamiento de acumulados, snapshot cache) pero **presenta riesgos significativos**:

1. **Claridad financiera**: COGS no se resta de `distributableProfit`, pero no está claro si es por intención o asunción. Necesita definición explícita.
2. **Robustez operacional**: `expectedAmount` como contador incremental sin reconciliación es frágil. Riesgo de desincronización silenciosa.
3. **Zona horaria**: Bug frontend repetido que afecta "hoy" — crítico para un sistema de caja.
4. **Duplicación de lógica**: Algunos cálculos se reimplementan en frontend — riesgo de divergencia.
5. **Documentación vs. código**: Discrepancia en hora de auto-cierre (14:00 en docs, 22:00 en código).

**Recomendación**: Comenzar por las decisiones de negocio (Fase 1) antes de implementar correcciones de código. Una vez clarificadas las reglas financieras, los bugs de Fase 2 son menores de resolver.

---

**Documento generado:** 21/09/2026  
**Estado:** Auditoría completada. Siguiente paso: Decisiones de negocio → Implementación de correcciones.
