Dentro de la auditoría y posterior implementación del módulo **Estado de Resultados**, agrega explícitamente el concepto de **Gastos Operativos Fijos**, considerando actualmente un costo operativo diario de **$260.00 MXN**.

Este monto corresponde a gastos operativos recurrentes del negocio, principalmente:

* Luz
* Sueldos

## 1. Tratamiento contable y de negocio

El sistema debe diferenciar claramente entre:

### Gastos variables

Son gastos que dependen de una operación específica, por ejemplo:

* Compra de insumos.
* Compras de inventario.
* Otros gastos extraordinarios.
* Gastos registrados manualmente.

### Gastos operativos fijos

Son gastos recurrentes necesarios para mantener funcionando el negocio.

Actualmente:

**Gasto operativo fijo diario = $260.00 MXN**

Este monto debe considerarse dentro del cálculo del resultado económico del negocio.

No debe confundirse con:

* Fondo de caja.
* Dinero físicamente disponible.
* Transferencias recibidas.
* Compras de inventario.
* Distribución de fondos.
* Ahorro.
* Fondo del negocio.

---

# 2. Estado de Resultados

La estructura conceptual debe quedar así:

### INGRESOS

* Ventas en efectivo
* Ventas por transferencia
* Otros métodos de pago, si existen
* **Total de ingresos**

### COSTOS Y GASTOS VARIABLES

* Insumos
* Compras
* Otros gastos variables

**Total costos y gastos variables**

### GASTOS OPERATIVOS FIJOS

* Luz
* Sueldos
* Otros gastos operativos fijos

Actualmente:

**Total gastos operativos fijos = $260.00 por día operativo**

### RESULTADO

Calcular:

**Resultado = Total ingresos − Costos − Gastos variables − Gastos operativos fijos**

---

# 3. Regla importante: días con operación

Los $260 diarios deben aplicarse únicamente a los **días en los que el negocio realmente operó**.

No se debe cobrar el gasto operativo fijo de $260 a un día marcado como:

**"Sin operación"**

Ejemplo:

| Día       | Operación | Gasto operativo |
| --------- | --------- | --------------: |
| Lunes     | Sí        |            $260 |
| Martes    | Sí        |            $260 |
| Miércoles | No        |              $0 |
| Jueves    | Sí        |            $260 |
| Viernes   | Sí        |            $260 |

Total:

**$1,040**

No:

**$1,300**

---

# 4. Semana

Para una semana de 7 días:

**Gastos operativos del periodo = $260 × días operativos**

Si operó los 7 días:

**$260 × 7 = $1,820**

Si operó 6 días:

**$260 × 6 = $1,560**

Si operó 5 días:

**$260 × 5 = $1,300**

El cálculo debe basarse en los días realmente operados.

---

# 5. Mes

Para el periodo mensual:

**Gastos operativos = $260 × número de días operativos del mes**

Ejemplo:

Si durante el mes hubo 26 días operativos:

**$260 × 26 = $6,760**

No utilizar simplemente:

**$260 × cantidad de días calendario**

porque eso generaría un gasto incorrecto cuando existan días sin operación.

---

# 6. Diferenciar Estado de Resultados de Caja

Mantener separadas estas dos cosas.

### Estado de Resultados

Debe responder:

> ¿Cuánto dinero generó realmente el negocio después de considerar sus costos y gastos?

Por ejemplo:

```text
Ingresos                  $10,000
Costos                     $3,000
Gastos variables           $1,000
Gastos operativos            $260
--------------------------------
Resultado                  $5,740
```

### Control de Caja

Debe responder:

> ¿Cuánto efectivo físico debería existir en la caja?

La fórmula continúa siendo:

**Caja esperada = Fondo inicial + ingresos en efectivo − egresos de efectivo**

Una venta pagada por transferencia NO aumenta el efectivo físico.

---

# 7. Importante sobre los $260

Determinar durante la auditoría cómo debe modelarse este dato.

Preferentemente:

```text
Gasto operativo
├── Luz
└── Sueldos
```

Si actualmente el negocio solamente conoce el total diario de $260, puede manejarse inicialmente como:

**Gastos operativos fijos = $260 diarios**

Pero la arquitectura debe permitir posteriormente desglosarlo:

```text
Luz       → $X diarios
Sueldos   → $Y diarios
---------------------
Total     → $260
```

No hardcodear `$260` directamente dentro de componentes React.

El valor debe provenir de configuración o de una fuente de datos del backend.

---

# 8. Backend

Auditar cómo implementar este concepto.

Determinar si conviene manejarlo mediante:

* Configuración del negocio.
* Catálogo de gastos recurrentes.
* Concepto de gasto fijo.
* Tabla específica de gastos recurrentes.
* Otra estructura existente en el sistema.

Priorizar la reutilización de la arquitectura actual.

El frontend NO debe ser la fuente de verdad para calcular los $260.

El backend debe determinar:

```text
días operativos
×
gasto operativo diario
=
gasto operativo del periodo
```

Validar además:

* Fechas.
* Zona horaria.
* Días sin operación.
* Periodos parciales.
* Semana.
* Mes.
* Rango personalizado.
* Cierre de caja.
* Correcciones posteriores.
* Duplicación de gastos.

---

# 9. Frontend

En la tabla del Estado de Resultados agregar una sección claramente identificable:

### Gastos operativos

| Concepto                    |    Lunes |   Martes | Miércoles |   Jueves | ... |    Total |
| --------------------------- | -------: | -------: | --------: | -------: | --: | -------: |
| Luz                         |      ... |      ... |       ... |      ... | ... |      ... |
| Sueldos                     |      ... |      ... |       ... |      ... | ... |      ... |
| **Total gastos operativos** | **$260** | **$260** |    **$0** | **$260** | ... | **$...** |

Si inicialmente no existe desglose de Luz/Sueldos, mostrar:

| Concepto                | Lunes | Martes | Miércoles | Jueves | ... | Total |
| ----------------------- | ----: | -----: | --------: | -----: | --: | ----: |
| Gastos operativos fijos |  $260 |   $260 |        $0 |   $260 | ... |  $... |

No inventar una distribución entre luz y sueldo si el sistema no dispone de esos datos.

---

# 10. Relación con el resultado

El resultado debe considerar estos $260.

Ejemplo:

```text
Ingresos                         $2,000
Costos de insumos                 $600
Gastos variables                  $100
Gastos operativos fijos           $260
--------------------------------------
Resultado                         $1,040
```

El sistema debe poder explicar claramente de dónde salió cada número.

---

# 11. Auditoría obligatoria

Durante la auditoría verificar:

1. ¿Actualmente existen gastos operativos?
2. ¿Dónde se almacenan?
3. ¿El sistema diferencia gastos variables y fijos?
4. ¿El Estado de Resultados actualmente los contempla?
5. ¿El cálculo actual del resultado los considera?
6. ¿Los $260 se están considerando por día calendario o por día operativo?
7. ¿Los días sin operación están correctamente excluidos?
8. ¿El backend o frontend realiza el cálculo?
9. ¿Existe riesgo de duplicar los $260 como gasto y como movimiento de caja?
10. ¿El gasto operativo afecta correctamente el resultado?
11. ¿Afecta incorrectamente la caja física?
12. ¿Cómo se comporta en semanas y meses?
13. ¿Cómo se comporta con rangos personalizados?
14. ¿Cómo se comporta ante correcciones o cambios futuros del monto?
15. ¿El sistema permite posteriormente cambiar los $260 sin modificar código?

---

# 12. Pruebas mínimas

Crear o ejecutar pruebas para:

### Caso A — Día normal

Ingresos: $2,000
Costos: $600
Gastos variables: $100
Gastos operativos: $260

Resultado esperado:

**$1,040**

### Caso B — Día sin operación

Ingresos: $0
Costos: $0
Gastos variables: $0
Gastos operativos: **$0**

El sistema debe mostrar:

**Sin operación**

y no generar automáticamente $260.

### Caso C — Semana completa

7 días operativos:

**$260 × 7 = $1,820**

### Caso D — Semana con días sin operación

5 días operativos:

**$260 × 5 = $1,300**

### Caso E — Mes

26 días operativos:

**$260 × 26 = $6,760**

Validar que el total mensual coincida con la suma de los gastos operativos de cada día operativo.

---

# 13. Regla fundamental

No tratar los $260 simplemente como un número agregado visualmente.

El sistema debe poder responder:

> ¿Por qué este periodo tiene $X de gastos operativos?

Y la respuesta debe ser trazable:

```text
Periodo
   ↓
Días operativos
   ↓
Gasto operativo diario
   ↓
Gasto operativo acumulado
   ↓
Resultado del periodo
```

La auditoría debe determinar si la implementación actual soporta correctamente este flujo y señalar cualquier inconsistencia antes de modificar código.
