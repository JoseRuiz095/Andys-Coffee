
# Correcciones a interfaz de venta
# Tarea: Rediseño UX/UI del módulo de ventas — Andy’s Coffee POS

## Objetivo

Rediseñar el módulo de ventas del sistema Andy’s Coffee POS para ofrecer una experiencia de punto de venta rápida, intuitiva y eficiente para el cajero, tomando como referencia el flujo de personalización de bebidas de cadenas como Caffenio.

El problema actual es que el catálogo presenta demasiados productos simultáneamente, especialmente lattes duplicados por sabor y temperatura (frío/caliente). Esto obliga al cajero a recorrer visualmente el catálogo y hacer scroll para encontrar cada variante, incrementando el tiempo de atención y la posibilidad de errores.

**Implementa los cambios directamente en el código existente. No te limites a elaborar un plan, un prototipo estático o una lista de recomendaciones.**

---

## Fase 1. Auditoría del sistema actual

Antes de modificar el código:

1. Analiza la arquitectura actual del frontend y localiza todos los componentes, hooks, servicios y estados relacionados con:
   - Pantalla de ventas/POS.
   - Catálogo y categorías de productos.
   - Selección y configuración de bebidas.
   - Gestión del carrito y detalle del pedido.
   - Cálculo de precios, descuentos y totales.
   - Métodos de pago y confirmación de ventas.
   - Comunicación con el backend.
   - Productos, variantes, ingredientes y extras, si existen en el modelo actual.
2. Identifica cómo se representan actualmente los productos fríos, calientes, sabores y tamaños en la base de datos.
3. Determina si el modelo de datos ya permite representar variantes de un producto o si existen productos independientes para cada combinación.
4. Identifica las reglas de precios, inventario, validación y persistencia que deben conservarse.
5. Revisa los componentes existentes para reutilizarlos cuando sea conveniente.

No asumas que los productos tienen una estructura determinada. Confirma el modelo real antes de diseñar la solución.

**Restricción:** no realices migraciones destructivas ni modifiques el esquema de la base de datos sin justificar su necesidad y comprobar la compatibilidad con los datos existentes.

## Fase 2. Rediseño de la interfaz de ventas

Conserva la estructura general de la pantalla actual: catálogo a la izquierda y pedido a la derecha. Mejora la jerarquía visual y la interacción sin rehacer innecesariamente todo el módulo.

### 2.1 Catálogo de productos

Mantén las categorías principales:

- Bebidas.
- Bagels.
- Desayunos.
- Combos.
- Otros.

Implementa las siguientes mejoras:

- Añade una búsqueda rápida de productos.
- Mantén las categorías accesibles sin necesidad de desplazarse hasta la parte superior.
- Utiliza tarjetas uniformes, con imágenes, nombres y precios legibles.
- Evita que las imágenes rotas desorganicen las tarjetas.
- Conserva el diseño oscuro actual de Andy’s Coffee, los acentos dorados y la identidad visual verde oliva.
- Evita introducir scroll innecesario en toda la página cuando solo debería desplazarse el catálogo.
- Mantén el resumen del pedido visible y accesible.
- No elimines funciones existentes de la caja.

### 2.2 Agrupación de bebidas

Elimina la necesidad de mostrar cada combinación de sabor y temperatura como una tarjeta independiente cuando corresponda al mismo producto base.

Por ejemplo, en lugar de presentar tarjetas independientes para:

- Latte Vainilla frío.
- Latte Vainilla caliente.
- Latte Moka frío.
- Latte Moka caliente.
- Latte Biscoff frío.
- Latte Biscoff caliente.
- Latte Caramel Macchiato frío.
- Latte Caramel Macchiato caliente.

El catálogo debería mostrar una tarjeta de producto base, como **Latte**.

Al seleccionarla, el cajero configurará sus variantes en un modal.

Esta agrupación debe aplicarse únicamente cuando las variantes sean realmente compatibles y pertenezcan a la misma familia de producto. No agrupes productos que tengan recetas, precios o reglas operativas incompatibles.

No dupliques artificialmente productos ni alteres sus identificadores para conseguir el efecto visual.

Si el modelo actual no permite una agrupación segura, implementa primero una capa de presentación que agrupe los productos existentes sin cambiar su identidad ni romper las ventas históricas.

### 2.3 Modal de personalización de bebidas

Al seleccionar un producto configurable, abre un modal centrado, accesible y responsivo, sin abandonar la pantalla de ventas.

El modal debe incluir:

**A. Encabezado**
- Nombre del producto base.
- Botón para cerrar.
- Imagen del producto, si está disponible.

**B. Temperatura**
- Caliente.
- Frío.

Representa estas opciones con controles grandes y claramente diferenciados. Solo permite seleccionar las temperaturas compatibles con el producto.

**C. Sabores**

Implementa un carrusel horizontal de selección de sabores con tarjetas visuales.

Ejemplos:
- Vainilla.
- Caramel Macchiato.
- Moka.
- Biscoff.
- Otros sabores existentes en el catálogo.

Cada tarjeta debe mostrar, cuando sea posible, la imagen, el nombre y el precio correspondiente.

Requisitos del carrusel:
- Desplazamiento horizontal fluido.
- Controles de navegación cuando sean útiles.
- Selección visual claramente identificable.
- Compatibilidad con mouse, teclado y pantallas táctiles.
- No debe provocar desplazamiento horizontal de toda la página.
- Si existen muchos sabores, deben poder consultarse sin aumentar excesivamente la altura del modal.

**D. Tamaño**

Muestra únicamente los tamaños válidos para el producto seleccionado, por ejemplo, regular y jumbo, si están definidos en el catálogo actual.

**E. Complementos**

Permite seleccionar extras compatibles, como shots adicionales, tipos de leche u otros complementos, únicamente si existen en el sistema o forman parte de las reglas reales del negocio.

Respeta si cada opción es obligatoria, opcional, única o de selección múltiple.

No inventes productos, ingredientes, precios ni reglas comerciales.

**F. Precio dinámico**

Actualiza el precio visible al modificar las opciones, mostrando claramente el total de la bebida configurada.

El cálculo del frontend debe coincidir con las reglas de precios del backend. El servidor debe validar nuevamente las opciones y el precio aplicable antes de registrar la venta.

**G. Acciones**

Incluye:
- Cancelar.
- Agregar al pedido con el precio actualizado.

No permitas agregar la bebida si faltan opciones obligatorias o si la configuración es inválida.

Al cancelar o cerrar el modal, descarta la configuración temporal y conserva intacto el pedido existente.

Al agregar la bebida, incorpora al carrito una línea con su configuración completa y cierra el modal.

### 2.4 Comportamiento según el tipo de producto

No todos los productos necesitan un modal con las mismas opciones.

Implementa un flujo contextual:

- Bebidas configurables: abrir modal de personalización.
- Productos sin variantes: agregarlos directamente al carrito cuando no exista ninguna decisión adicional que requiera confirmación.
- Productos con opciones obligatorias: abrir el selector correspondiente.
- Combos: conservar o implementar el flujo necesario para seleccionar los componentes definidos por el modelo actual.

No obligues al cajero a pasar por pasos innecesarios.

## Fase 3. Carrito y resumen del pedido

Conserva el panel derecho y mejora su legibilidad.

Cada línea del pedido debe mostrar:

- Nombre del producto.
- Variantes seleccionadas.
- Temperatura, tamaño y sabor, cuando correspondan.
- Complementos y notas relevantes.
- Precio unitario.
- Cantidad.
- Subtotal de la línea.

Permite incrementar o reducir cantidades, eliminar productos y editar la configuración de una bebida cuando sea compatible con la lógica actual.

Al editar una bebida, abre el modal con su configuración anterior. Al guardar los cambios, actualiza la línea correspondiente sin crear duplicados accidentales.

Si dos bebidas tienen configuraciones diferentes, no las combines en una sola línea solo porque comparten el mismo producto base.

Mantén visibles:
- Subtotal.
- Descuentos aplicables.
- Total.
- Método de pago.
- Acción principal para continuar o cobrar.

Respeta las funciones existentes de información del cliente, notas de la orden, pedidos para llevar y demás datos que ya formen parte del proceso de venta.

El botón principal de cobro debe permanecer accesible y claramente identificado.

## Fase 4. Integración con backend, precios e inventario

El rediseño no debe ser únicamente visual. Debe integrarse con el flujo de ventas existente.

1. Reutiliza los endpoints, servicios, repositorios y modelos actuales siempre que sea posible.
2. Conserva la arquitectura existente del proyecto.
3. No dupliques la lógica de negocio entre componentes.
4. No confíes en precios enviados por el cliente como fuente de verdad.
5. Valida en el backend las variantes, complementos, cantidades y precios aplicables.
6. Conserva la relación entre la venta, sus productos y los registros de inventario.
7. Evita que una bebida configurable se registre como varios productos independientes cuando la lógica del sistema requiera una sola línea de venta.
8. Respeta las reglas actuales de descuentos, métodos de pago, caja, cancelaciones y cierre de venta.
9. Conserva la trazabilidad histórica de las ventas, incluidos los precios y las variantes aplicados en el momento de la operación.
10. Si es necesario modificar el modelo de datos, documenta la migración, su compatibilidad con los registros existentes y el procedimiento de reversión antes de aplicarla.

No modifiques la lógica de inventario para descontar ingredientes de manera nueva si esa funcionalidad no existe o no está definida. Identifica primero el comportamiento actual.

## Fase 5. UX, accesibilidad y rendimiento

El sistema está destinado a utilizarse durante operaciones reales de caja. Prioriza la velocidad y la prevención de errores.

Implementa:

- Estados visuales claros para opciones seleccionadas.
- Botones con áreas de interacción cómodas.
- Navegación mediante teclado y foco correctamente administrado en el modal.
- Cierre con Escape cuando sea seguro.
- Etiquetas accesibles y contraste suficiente.
- Indicadores de carga al obtener datos o procesar operaciones.
- Protección contra múltiples clics y solicitudes duplicadas durante una operación pendiente.
- Prevención de duplicaciones por reintentos o doble envío, de acuerdo con las capacidades actuales del backend.
- Manejo de errores que permita al cajero recuperar la operación sin perder el pedido.
- Diseño responsivo para la resolución habitual del punto de venta.
- Carga eficiente de imágenes y estados alternativos cuando no existan.

No bloquees toda la interfaz durante acciones que puedan realizarse de forma independiente. Deshabilita únicamente los controles cuya repetición pueda generar inconsistencias.

No introduzcas dependencias nuevas si las herramientas existentes resuelven adecuadamente el problema.

## Fase 6. Pruebas obligatorias

Después de implementar, ejecuta las pruebas disponibles y agrega las necesarias.

### Pruebas funcionales

1. Seleccionar un latte y abrir el modal.
2. Seleccionar frío y caliente.
3. Cambiar entre sabores.
4. Cambiar el tamaño.
5. Agregar complementos permitidos.
6. Verificar que el precio se actualice correctamente.
7. Agregar una bebida al pedido.
8. Agregar varias bebidas con configuraciones diferentes.
9. Editar una bebida existente.
10. Cancelar el modal sin alterar el pedido.
11. Eliminar una línea del pedido.
12. Incrementar y reducir cantidades.
13. Procesar una venta con cada método de pago soportado.
14. Verificar que los productos no configurables conserven su comportamiento.
15. Verificar que los combos y demás categorías sigan funcionando.

### Pruebas de integridad

- Un cliente no puede alterar arbitrariamente el precio final.
- Una combinación de variantes inválida es rechazada.
- Las opciones obligatorias se validan correctamente.
- Un doble clic no produce ventas ni solicitudes duplicadas.
- Las modificaciones del catálogo no cambian retroactivamente los precios históricos.
- El cierre de una venta conserva correctamente los datos y el comportamiento de inventario existentes.

### Validación técnica

Ejecuta los scripts reales del proyecto para:
- Lint.
- Typecheck, si está configurado.
- Build de producción.
- Pruebas unitarias.
- Pruebas de integración o E2E disponibles.

No inventes comandos ni afirmes que una prueba pasó si no fue ejecutada.

## Fase 7. Restricciones de implementación

- Trabaja sobre la estructura actual del repositorio.
- Respeta el stack, las convenciones y los patrones arquitectónicos existentes.
- No reescribas el módulo completo si una refactorización localizada es suficiente.
- No elimines funcionalidades para simplificar la interfaz.
- No introduzcas datos de prueba en producción.
- No alteres credenciales, secretos, variables de entorno ni configuraciones de despliegue sin necesidad justificada.
- No realices commits, push, merges ni despliegues.
- No modifiques archivos ajenos al alcance de esta tarea, salvo que sean necesarios y expliques por qué.
- No ocultes errores mediante excepciones silenciosas ni desactives pruebas para conseguir una ejecución exitosa.

## Criterios de aceptación

La tarea se considerará terminada cuando:

1. El cajero pueda seleccionar un latte sin buscar entre todas sus variantes duplicadas.
2. El modal permita configurar correctamente las opciones disponibles para el producto.
3. El carrusel de sabores sea funcional y accesible.
4. El precio mostrado corresponda a la configuración seleccionada.
5. Las bebidas configuradas se agreguen, editen y eliminen correctamente.
6. El carrito y el proceso de cobro sigan funcionando con las reglas existentes.
7. Los demás productos y categorías continúen operativos.
8. No existan errores nuevos de lint, compilación o pruebas atribuibles a los cambios.
9. El sistema mantenga la integridad de las ventas, los precios y el inventario.
10. La interfaz resulte más rápida de utilizar y no dependa de scroll vertical excesivo para encontrar variantes de bebidas.

## Entrega final del agente

Al terminar, presenta:

1. Diagnóstico inicial y estructura del módulo encontrado.
2. Resumen de los cambios implementados.
3. Archivos creados y modificados.
4. Componentes reutilizados y nuevos.
5. Cambios realizados en backend, base de datos o API, si los hubo.
6. Pruebas ejecutadas con sus resultados reales.
7. Limitaciones o tareas pendientes.
8. Instrucciones para probar manualmente el nuevo flujo de venta.

**Prioridad:** primero garantiza que el proceso de venta siga siendo correcto; después mejora la interfaz y finalmente optimiza los detalles visuales. La implementación debe quedar integrada al sistema real, no como una demostración aislada.