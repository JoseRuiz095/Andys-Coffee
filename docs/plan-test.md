# PLAN MAESTRO DE AUDITORÍA Y QA

## Andy's Coffee — MVP

### Objetivo

El MVP de Andy's Coffee se considera funcional.

Antes de comenzar a implementar pruebas automatizadas, se realizará una **auditoría integral del sistema** para conocer su estado real, detectar problemas técnicos, código innecesario, inconsistencias, riesgos y áreas críticas.

La auditoría será independiente de la fase posterior de testing.

El proceso completo se dividirá en fases:

```text
FASE 1 → Auditoría Backend
FASE 2 → Auditoría Base de Datos
FASE 3 → Auditoría API / Seguridad
FASE 4 → Auditoría Frontend
FASE 5 → Auditoría de Integración y Reglas de Negocio
FASE 6 → Correcciones y estabilización
FASE 7 → Testing integral
```

---

# REGLA FUNDAMENTAL: CONTROL DE VERSIONES

## NO HACER COMMITS

Durante TODA la auditoría y durante las correcciones realizadas por esta tarea:

> **La IA NO debe realizar ningún commit, push, merge, checkout de ramas ni modificar el historial de Git.**

La IA puede:

* leer el repositorio
* analizar archivos
* ejecutar comandos
* ejecutar tests existentes
* ejecutar builds
* modificar código cuando corresponda
* crear archivos de pruebas
* corregir errores
* eliminar código muerto cuando esté justificado

Pero:

```text
git commit     ❌ PROHIBIDO
git push       ❌ PROHIBIDO
git merge      ❌ PROHIBIDO
git rebase     ❌ PROHIBIDO
git reset      ❌ PROHIBIDO
git checkout   ❌ PROHIBIDO
git clean      ❌ PROHIBIDO
```

El control de cambios y los commits serán realizados **manualmente por el desarrollador** después de revisar los cambios.

No crear commits automáticos "para guardar progreso".

---

# FASE 0 — RECONOCIMIENTO DEL PROYECTO

Antes de auditar código, analizar la estructura completa.

Revisar:

* README
* Claude.md
- Si es necesario actualizar estos ultimos hazlo
* package.json
* configuración TypeScript
* configuración Vite
* configuración Tailwind
* Prisma
* variables de entorno
* scripts
* estructura de carpetas
* dependencias
* configuración de testing existente
* configuración de build
* configuración de lint
* configuración de producción

Determinar:

```text
Frontend
Backend
Base de datos
ORM
Autenticación
Autorización
API
Testing
Build
Deploy
```

### Resultado esperado

Crear un mapa técnico del sistema:

```text
Frontend
    ↓
API
    ↓
Controllers
    ↓
Services
    ↓
Repositories
    ↓
Prisma
    ↓
PostgreSQL
```

Y documentar cualquier desviación respecto a la arquitectura esperada.

---

# FASE 1 — AUDITORÍA BACKEND

Analizar el backend completamente antes de tocar el frontend.

## 1.1 Arquitectura

Revisar:

* controllers
* services
* repositories
* middleware
* routes
* schemas
* validators
* utilities
* configuración
* errores
* logs

Determinar si existe separación correcta de responsabilidades.

Buscar:

* lógica de negocio en controllers
* lógica duplicada
* services innecesarios
* repositories que no aportan valor
* funciones demasiado grandes
* dependencias circulares
* imports innecesarios
* código duplicado
* código muerto
* TODO/FIXME abandonados

---

## 1.2 Reglas de negocio

Identificar dónde vive cada regla de negocio.

Especial atención a:

* ventas
* productos
* inventario
* caja
* gastos
* usuarios
* roles
* permisos
* estado de resultados

Para cada módulo documentar:

```text
Entrada
↓
Validación
↓
Regla de negocio
↓
Persistencia
↓
Respuesta
```

---

## 1.3 Manejo de errores

Revisar:

* errores HTTP
* errores de base de datos
* excepciones
* mensajes al cliente
* logging
* errores silenciosos
* try/catch innecesarios
* errores genéricos

Detectar casos donde:

```text
error real
↓
catch
↓
se ignora
```

---

## 1.4 Código muerto

Buscar:

* funciones nunca utilizadas
* archivos sin referencias
* imports sin uso
* endpoints sin consumidor
* servicios sin consumidores
* componentes backend abandonados
* variables sin uso
* código comentado
* funcionalidades parcialmente eliminadas

IMPORTANTE:

No eliminar automáticamente código ambiguo.

Clasificar cada hallazgo como:

```text
CONFIRMADO COMO MUERTO
PROBABLEMENTE MUERTO
REQUIERE VALIDACIÓN
```

---

# FASE 2 — AUDITORÍA DE BASE DE DATOS

Analizar Prisma y PostgreSQL.

Revisar:

* modelos
* relaciones
* foreign keys
* índices
* unique constraints
* nullable fields
* enums
* timestamps
* cascades
* transacciones
* migraciones
* seeds

Especial atención a:

## Inventario

Verificar que sea posible mantener consistencia entre:

```text
Producto
Stock
Movimiento de inventario
Venta
Entrada
Salida
Cancelación
```

## Caja

Verificar relaciones entre:

```text
Caja
Apertura
Movimiento
Venta
Gasto
Cierre
```

## Usuarios

Verificar:

```text
Usuario
Rol
Permiso
```

Detectar:

* relaciones innecesarias
* campos redundantes
* índices faltantes
* datos duplicados
* constraints insuficientes
* posibles datos huérfanos

---

# FASE 3 — AUDITORÍA API Y SEGURIDAD

Analizar todos los endpoints.

Crear un inventario:

| Método | Endpoint | Autenticación | Permiso | Validación | Servicio |
| ------ | -------- | ------------- | ------- | ---------- | -------- |

Revisar:

* autenticación
* JWT
* expiración
* autorización
* RBAC
* validación de inputs
* CORS
* CSRF
* headers
* manejo de errores
* exposición de información
* rate limiting
* manipulación de IDs
* mass assignment
* SQL injection
* XSS
* secretos

## Regla crítica

La seguridad debe existir en backend.

No considerar suficiente:

```text
Ocultar botón en React
```

Debe existir:

```text
Request
↓
Authentication
↓
Authorization
↓
Validation
↓
Business rule
↓
Database
```

Intentar identificar endpoints que puedan ser utilizados directamente sin pasar por las restricciones de la interfaz.

---

# FASE 4 — AUDITORÍA FRONTEND

Analizar toda la aplicación React.

Revisar:

* páginas
* componentes
* hooks
* contexts
* servicios
* API clients
* formularios
* validaciones
* estados
* navegación
* permisos
* manejo de errores
* loading
* empty states
* responsive
* accesibilidad

---

## 4.1 Código muerto

Buscar:

* componentes sin uso
* hooks sin consumidores
* imports innecesarios
* páginas abandonadas
* funciones duplicadas
* estados innecesarios
* código comentado
* componentes duplicados
* llamadas API obsoletas

---

## 4.2 Estado y datos

Revisar:

* TanStack Query
* cache
* invalidaciones
* mutations
* estados locales
* sincronización con backend

Buscar:

```text
API actualizada
↓
UI mostrando información antigua
```

o:

```text
mutation exitosa
↓
cache no invalidada
↓
UI inconsistente
```

---

# FASE 5 — AUDITORÍA FUNCIONAL Y REGLAS DE NEGOCIO

Esta fase conecta todo el sistema.

No se escribirán todavía tests automatizados.

Se realizará una revisión de los flujos críticos.

## Flujo de venta

```text
Producto
↓
Carrito
↓
Venta
↓
Pago
↓
Inventario
↓
Caja
↓
Estado de resultados
```

Validar conceptualmente que los datos sean consistentes.

---

## Flujo de inventario

```text
Producto
↓
Entrada
↓
Stock
↓
Venta
↓
Salida
↓
Cancelación/devolución
```

---

## Flujo de caja

```text
Abrir caja
↓
Ventas
↓
Gastos
↓
Movimientos
↓
Cierre
↓
Diferencia
```

---

## Flujo financiero

```text
Ventas
↓
Ingresos
↓
Costo de ventas
↓
Gastos
↓
Resultado
```

Aquí se buscarán especialmente discrepancias entre:

* caja
* ventas
* inventario
* estado de resultados

---

# FASE 6 — AUDITORÍA DE CALIDAD Y ESTABILIZACIÓN

Después de encontrar los problemas:

Clasificarlos:

### CRITICAL

Puede producir:

* pérdida/corrupción de datos
* errores financieros
* inconsistencias de inventario
* acceso no autorizado
* vulnerabilidades graves

### HIGH

Afecta una funcionalidad importante.

### MEDIUM

Problema funcional o técnico con impacto limitado.

### LOW

Problema menor.

### TECH DEBT

Deuda técnica que no rompe actualmente el sistema.

### DEAD CODE

Código confirmado como innecesario.

---

## Correcciones

Una vez terminado el diagnóstico:

1. Corregir problemas críticos.
2. Corregir problemas altos.
3. Corregir problemas medios relevantes.
4. Limpiar código muerto confirmado.
5. Evitar refactorizaciones innecesarias.
6. Mantener comportamiento funcional existente.
7. Ejecutar nuevamente build/lint/typecheck.

NO implementar nuevas funcionalidades durante esta fase.

---

# FASE 7 — TESTING

Solamente después de terminar la auditoría y estabilización comenzar la implementación de pruebas.

La estrategia será:

```text
Unit Tests
    ↓
Integration Tests
    ↓
API Tests
    ↓
E2E Tests
    ↓
Security Tests
    ↓
Regression Tests
    ↓
Concurrency Tests
    ↓
Coverage
```

Los tests deberán basarse en los hallazgos de la auditoría.

Especialmente:

```text
bugs encontrados
+
reglas de negocio críticas
+
flujos principales
+
casos límite
+
vulnerabilidades
```

---

# ENTREGABLES DE LA AUDITORÍA

Antes de comenzar la FASE 7, entregar:

## 1. Arquitectura actual

Mapa de:

```text
Frontend
Backend
API
Database
Auth
RBAC
```

## 2. Problemas encontrados

Tabla:

| ID | Área | Problema | Severidad | Evidencia | Recomendación |
| -- | ---- | -------- | --------- | --------- | ------------- |

## 3. Código muerto

| Archivo | Elemento | Evidencia | Confianza | Acción |
| ------- | -------- | --------- | --------- | ------ |

No eliminar elementos con confianza baja.

## 4. Riesgos

| Riesgo | Área | Impacto | Probabilidad | Acción |
| ------ | ---- | ------- | ------------ | ------ |

## 5. Deuda técnica

Separar claramente:

```text
Bug
Vulnerabilidad
Código muerto
Deuda técnica
Mejora
```

No mezclar categorías.

## 6. Matriz de cobertura funcional

| Módulo               | Auditado | Riesgo | Tests necesarios |
| -------------------- | -------- | ------ | ---------------- |
| Auth                 |          |        |                  |
| Usuarios             |          |        |                  |
| Roles                |          |        |                  |
| Productos            |          |        |                  |
| Inventario           |          |        |                  |
| Ventas               |          |        |                  |
| Caja                 |          |        |                  |
| Gastos               |          |        |                  |
| Estado de resultados |          |        |                  |

---

# CONDICIÓN PARA PASAR A TESTING

NO comenzar la implementación de tests hasta haber entregado el reporte de auditoría.

Al finalizar la auditoría mostrar:

```text
AUDITORÍA COMPLETADA

Problemas encontrados:
Critical:
High:
Medium:
Low:

Código muerto:
Confirmado:
Pendiente:

Deuda técnica:

Riesgos:

Correcciones realizadas:

Build:
Lint:
Typecheck:

¿Sistema listo para fase de testing?: SÍ / NO
```

Si existen problemas críticos sin resolver:

```text
¿Sistema listo para testing?: NO
```

Si solamente existen problemas menores o deuda técnica documentada:

```text
¿Sistema listo para testing?: SÍ
```

---

# REGLA FINAL

Esta tarea tiene dos objetivos diferentes:

```text
AUDITORÍA
↓
Conocer el estado real del sistema

ESTABILIZACIÓN
↓
Corregir problemas encontrados

TESTING
↓
Demostrar mediante pruebas automatizadas que el comportamiento es correcto
```

No confundir:

> "El sistema funciona"

con:

> "El sistema está suficientemente auditado y probado".

La primera afirmación es una observación.

La segunda requiere evidencia.
