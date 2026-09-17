Pantalla: Órdenes

BUG-001 — Botones de cambio de estado no funcionan

Problema: En la pantalla de Órdenes, los botones para cambiar una orden al estado “Preparando” o “Cancelar” no ejecutan ninguna acción.
Comportamiento esperado: Al presionar “Preparando”, la orden debe actualizar correctamente su estado y reflejar el cambio en la interfaz. Al presionar “Cancelar”, debe cancelarse la orden y actualizarse su estado de forma consistente.
Revisar: Evento de los botones, llamada al endpoint correspondiente, validaciones, actualización del estado en backend y sincronización del estado en frontend.
Criterio de aceptación: Ambos botones deben ejecutar correctamente la transición de estado y mostrar al usuario cualquier error de forma explícita.
Pantalla: Inventario → Agregar entrada

BUG-002 — Cálculo incorrecto del valor de productos por unidad de medida

Problema: El valor de una entrada se calcula como cantidad × costo unitario, lo cual funciona correctamente cuando la unidad es pieza (pz). Sin embargo, el cálculo es incorrecto cuando se utilizan unidades de medida menores o diferentes.
Comportamiento esperado: El sistema debe calcular correctamente el valor total de la entrada considerando la unidad de medida seleccionada y su equivalencia, no únicamente multiplicando directamente cantidad por costo unitario.
Ejemplo: Si un producto se registra por kg, g, L, ml, etc., el sistema debe convertir correctamente las cantidades antes de calcular el costo.
Criterio de aceptación: El costo total debe representar correctamente la cantidad ingresada y su unidad de medida.

BUG-003 — Nomenclatura incorrecta del número de factura

Problema: El sistema genera actualmente el número de factura con una nomenclatura incorrecta.
Comportamiento esperado: El identificador debe generarse con el siguiente formato:

FAC-"No. de factura del día"-DD/MM/YYYY

Ejemplo: FAC-001-16/09/2026
Criterio de aceptación: El número debe generarse automáticamente respetando este formato y mantener una numeración consecutiva para las facturas del día.

MEJORA-004 — Eliminar campo de IVA/Impuestos

Problema: El apartado de IVA/Impuestos no es necesario para el flujo actual de registro de entradas de inventario.
Cambio requerido: Eliminar este campo de la interfaz y cualquier lógica asociada que ya no sea necesaria.
Criterio de aceptación: El registro de una entrada debe funcionar correctamente sin solicitar ni calcular IVA/Impuestos.
Pantalla: Administración → Dashboard

FEATURE-005 — Implementar Dashboard administrativo basado en datos reales

Problema: La pantalla de Administración debe funcionar como un dashboard centralizado del sistema, proporcionando una visión general del estado operativo, ventas, finanzas, costos e inventario.
Requisito principal: Toda la información mostrada debe provenir exclusivamente de la base de datos y de los datos reales registrados en el sistema. No utilizar mocks, datos estáticos, valores de demostración ni información inventada.
Resumen

Mostrar:

Ventas del día.
Número de órdenes.
Ingresos.
Gastos.
Utilidad.
Productos con inventario bajo.
Productos críticos o agotados.
Próximas entradas de inventario, cuando existan.
Ventas

Mostrar información como:

Ventas por período.
Tendencias de ventas.
Productos más vendidos.
Cantidad vendida por producto.
Ingresos generados por producto.
Finanzas

Mostrar:

Ingresos.
Gastos.
Utilidad.
Márgenes, únicamente cuando existan datos suficientes para calcularlos correctamente.
Costos

Mostrar:

Costos de productos.
Costo de ventas.
Costo por producto.
Evolución de costos, cuando los datos históricos disponibles permitan calcularla.
Inventario

Mostrar:

Stock actual.
Productos por debajo del stock mínimo.
Productos agotados.
Próximas entradas.
Movimientos relevantes de inventario, cuando corresponda.
Requisitos técnicos
Los datos deben obtenerse mediante los endpoints correspondientes.
Utilizar las vistas de PostgreSQL existentes cuando sean apropiadas.
Evitar consultas duplicadas o innecesariamente costosas.
Los cálculos financieros deben realizarse con datos reales y consistentes.
Cuando no existan datos suficientes para una métrica, mostrar un estado apropiado en lugar de inventar información.
El dashboard debe actualizarse correctamente después de operaciones que modifiquen ventas, inventario o finanzas.
Pantalla: Configuración

UX-006 — Unificar “Preferencias” y “Preferencias del sistema”

Problema: Existen dos apartados independientes relacionados con preferencias, lo que genera redundancia y confusión.
Cambio requerido: Unificar “Preferencias” y “Preferencias del sistema” en un único apartado.
Criterio de aceptación: Toda la configuración relacionada con preferencias debe encontrarse en una sola sección, con una organización clara.

UX-007 — Eliminar opciones duplicadas del menú lateral

Problema: El menú lateral de Configuración contiene opciones que corresponden a funcionalidades administrativas ya centralizadas en la pantalla de Administración.
Cambio requerido: Eliminar del menú lateral de Configuración:
Dashboard.
Gastos.
Historial de caja.
Comportamiento esperado: Estas funcionalidades deben permanecer accesibles desde Administración, evitando duplicar accesos dentro de Configuración.

UX-008 — Rediseñar la gestión de Roles y Permisos

Problema: La interfaz actual utiliza una tabla donde los usuarios y sus permisos se recorren directamente. Cuando existen muchos usuarios, resulta difícil identificar con claridad a qué usuario se está asignando o retirando cada permiso.
Cambio requerido: Rediseñar el flujo para gestionar los permisos individualmente por usuario.
UX propuesta:
Incorporar un buscador de usuarios.
Incorporar un selector/listado de usuarios.
Seleccionar un usuario específico.
Mostrar sus permisos en un apartado estático e independiente.
Permitir asignar o retirar permisos únicamente del usuario seleccionado.
Mostrar claramente los permisos actuales y los cambios pendientes.
Guardar los cambios de forma explícita y proporcionar confirmación del resultado.
Criterio de aceptación: El administrador debe poder localizar rápidamente a un usuario, visualizar sus permisos y modificarlos sin tener que recorrer una tabla extensa de usuarios.