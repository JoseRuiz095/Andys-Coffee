# Tarea: Implementar pedidos programados con activación automática y alertas al cocinero — Andy’s Coffee POS

## Objetivo

Implementar una funcionalidad que permita al cajero programar un pedido para una fecha y hora futuras desde el módulo de ventas.

Los pedidos programados deben permanecer pausados en la pantalla de órdenes hasta que llegue su momento de activación. Durante la espera, no deben iniciar ni consumir el tiempo del temporizador normal de preparación.

El sistema debe mostrar el tiempo restante en el centro de notificaciones y emitir una alerta visual al cocinero cuando falten exactamente 20 minutos para la hora programada.

**Implementa la funcionalidad completa en el sistema existente. No te limites a proponer una solución o construir una demostración aislada.**

---

## Fase 1. Auditoría del flujo actual

Antes de modificar el código, analiza:

1. El módulo de ventas y el proceso de confirmación de una venta.
2. El modelo de datos de órdenes y sus estados actuales.
3. La pantalla de órdenes y sus tarjetas.
4. El temporizador actual: cómo inicia, cómo calcula el tiempo transcurrido y cómo cambia según el estado de la orden.
5. Las transiciones existentes:
   - Preparando.
   - Lista.
   - Entregar.
   - Cancelar.
6. El centro de notificaciones y su arquitectura.
7. El mecanismo de actualización de datos entre cajero, cocina y backend.
8. La persistencia de las órdenes y el comportamiento después de recargar la página o reiniciar el servidor.

Identifica qué lógica reside en el frontend y cuál en el backend.

Reutiliza los componentes, servicios y patrones existentes. No crees un segundo sistema de órdenes o notificaciones si el actual puede extenderse.

## Fase 2. Programar un pedido desde ventas

Añade una opción claramente visible en el flujo de venta:

**Programar pedido**

Debe estar disponible antes de confirmar la orden, sin interferir con el flujo normal de venta.

Al seleccionarla, abre un modal con:

- Fecha del pedido.
- Hora programada.
- Fecha y hora seleccionadas.
- Tiempo restante estimado.
- Botón para confirmar la programación.
- Botón para cancelar y regresar a la venta normal.

### Validaciones

- No permitir fechas u horas pasadas.
- Validar que la fecha y hora sean válidas.
- Evitar que la interfaz interprete incorrectamente la zona horaria.
- Mostrar la fecha y hora de manera clara al cajero.
- Evitar que se programe una orden sin una fecha y hora válidas.
- Conservar los productos, variantes, cantidades, notas y datos del cliente ya capturados.
- No crear una orden duplicada al confirmar.
- Mantener intacto el flujo de ventas inmediatas cuando el cajero no seleccione la programación.

La programación debe representar el momento en el que cocina debe comenzar a preparar el pedido, no necesariamente el momento en que el cliente llegará a recogerlo.

Si el sistema distingue entre hora de preparación y hora de entrega, identifica esa distinción y utiliza el concepto correcto sin alterar las reglas comerciales existentes.

## Fase 3. Modelo y estados de las órdenes

Adapta el modelo actual para distinguir entre una orden inmediata y una programada.

Requisitos:

- Conservar la máquina de estados actual.
- Representar explícitamente que una orden está programada y pendiente de activación.
- Guardar la fecha y hora programadas.
- Registrar cuándo se activa realmente la preparación.
- Conservar los datos históricos necesarios para auditar los cambios.
- Persistir la programación en la base de datos.

No utilices únicamente un estado temporal en React ni un temporizador del navegador para determinar si una orden ya debe activarse.

El backend debe ser la fuente de verdad para la programación.

Si se requiere modificar el esquema de la base de datos, crea una migración compatible con los registros existentes. No elimines ni reinicies órdenes históricas.

## Fase 4. Comportamiento en la pantalla de órdenes

Las órdenes programadas deben aparecer en la pantalla actual de órdenes, integradas con las tarjetas existentes.

Mientras una orden esté esperando su hora programada:

- Mostrar una etiqueta visible: **PROGRAMADA**.
- Mostrar la fecha y hora programadas.
- Mostrar el tiempo restante hasta la activación.
- Diferenciar visualmente la tarjeta de las órdenes que ya están en preparación.
- Mostrar un indicador de estado pausado.
- No iniciar el temporizador normal de preparación.
- No permitir que el cocinero la marque como lista o entregada antes de su activación.
- No permitir cancelaciones que eludan las reglas existentes de cancelación.

Durante este periodo, la tarjeta debe permanecer en estado de espera. No debe confundirse con una orden que está preparando y cuyo temporizador se encuentra detenido.

Cuando llegue la hora programada, el sistema debe:

1. Detectar que la orden ya debe activarse.
2. Cambiarla automáticamente al estado operativo correspondiente.
3. Registrar la fecha y hora reales de activación.
4. Iniciar el temporizador de preparación desde ese momento.
5. Habilitar las acciones normales del cocinero.
6. Actualizar la tarjeta sin necesidad de que alguien vuelva a registrar la orden.

La activación debe ocurrir incluso si la pantalla estuvo cerrada, se recargó o el navegador permaneció inactivo.

Si el servidor estuvo fuera de servicio durante la hora programada, al recuperarse debe detectar y procesar las órdenes vencidas de manera segura. Documenta cómo se comportarán estos casos.

## Fase 5. Centro de notificaciones

Integra las órdenes programadas con el centro de notificaciones existente.

Cada orden programada debe generar una notificación persistente que permita identificar:

- Número o identificador de la orden.
- Resumen breve del pedido.
- Fecha y hora de activación.
- Tiempo restante.
- Estado actual: programada, por activarse, activada o cancelada, según corresponda.

El tiempo restante debe actualizarse automáticamente mientras la orden permanezca programada.

Ejemplos:

- Faltan 2 horas y 15 minutos.
- Falta 1 hora.
- Faltan 35 minutos.
- Faltan 19 minutos.

Al llegar la hora programada, actualiza la notificación para indicar que la orden se activó.

Cuando una orden se cancele, la notificación debe actualizarse o marcarse como cancelada según el comportamiento existente del centro de notificaciones.

Evita crear una notificación nueva cada segundo. El tiempo puede actualizarse visualmente en la interfaz, mientras que los cambios de estado y eventos relevantes se persisten mediante el sistema actual.

Las notificaciones deben conservar su comportamiento después de recargar la página.

## Fase 6. Modal de alerta cuando falten 20 minutos

Implementa una alerta emergente dirigida al cocinero cuando resten 20 minutos para la activación de una orden programada.

El modal debe mostrar:

- Identificador de la orden.
- Resumen de los productos.
- Hora programada.
- Cuenta regresiva restante.
- Mensaje claro de que la preparación debe comenzar pronto.
- Acción para consultar o abrir la orden.

Ejemplo del mensaje:

**Pedido próximo a preparación**

La orden #1234 está programada para las 15:30. Faltan 20 minutos para iniciar su preparación.

### Reglas de la alerta

1. Mostrarla una sola vez por orden y por evento de activación.
2. No volver a mostrarla continuamente durante la cuenta regresiva.
3. No mostrarla si la orden fue cancelada antes de llegar al umbral.
4. No mostrarla si la orden ya se activó.
5. Si se recarga la página cuando faltan menos de 20 minutos, pero la alerta todavía no se ha emitido, mostrarla una vez.
6. Si se recarga después de haber emitido la alerta, no repetirla.
7. Si existen varias órdenes que requieren atención al mismo tiempo, gestionar las alertas mediante una cola o mecanismo equivalente, evitando que varios modales se superpongan.
8. Si el cocinero descarta el modal, la orden debe seguir programada hasta su hora de activación.
9. Si el sistema tiene varios usuarios conectados a cocina, evitar que cada navegador vuelva a generar indefinidamente el mismo evento.

La alerta debe persistir de manera independiente del estado de React. El backend debe registrar el evento o utilizar un mecanismo idempotente equivalente.

No confundas el hecho de mostrar la alerta con la activación de la preparación.

## Fase 7. Temporizadores y sincronización

Revisa el funcionamiento del temporizador existente para garantizar que no se mezclen los siguientes conceptos:

- Tiempo restante para la activación.
- Tiempo transcurrido de preparación.
- Tiempo desde que la orden quedó lista, si el sistema lo mide.

El temporizador de preparación debe comenzar cuando el backend registre la activación real de la orden, no cuando se creó la venta.

No guardes el tiempo restante como un contador que se decrementa permanentemente en el navegador. Calcula el tiempo a partir de las fechas persistidas y del reloj actual, utilizando un criterio de tiempo consistente.

Implementa un mecanismo de sincronización compatible con la arquitectura existente, ya sea mediante consultas periódicas, actualizaciones en tiempo real u otro mecanismo que el proyecto ya utilice.

Si varios clientes están conectados simultáneamente, todos deben converger al mismo estado de la orden.

Considera:
- Cambios de pestaña.
- Navegador suspendido.
- Recarga de página.
- Reinicio del backend.
- Retrasos de red.
- Dos usuarios intentando modificar la misma orden.
- Órdenes cuya hora programada ya pasó al recuperar el servicio.

## Fase 8. Seguridad e integridad

- El backend debe validar todas las transiciones de estado.
- No confíes en la hora enviada por el frontend para confirmar una activación.
- No permitas que un cliente active una orden antes de tiempo manipulando el navegador.
- Evita activaciones duplicadas mediante operaciones idempotentes o transacciones adecuadas.
- Respeta las reglas de permisos actuales para cajero, cocinero y administrador.
- Mantén la trazabilidad de las cancelaciones y activaciones.
- Evita que los reintentos de una petición generen notificaciones duplicadas.
- Conserva la integridad de los pagos, el inventario y el registro de ventas.

La programación no debe registrar un segundo cobro ni crear una venta adicional cuando llegue la hora programada. La orden debe ser la misma que se creó y pagó o registró inicialmente, conforme al flujo actual.

## Fase 9. Pruebas obligatorias

Implementa o ejecuta pruebas para los siguientes escenarios:

### Programación
1. Crear una orden programada válida.
2. Rechazar una fecha pasada.
3. Rechazar una hora pasada.
4. Confirmar que una orden inmediata sigue funcionando igual.
5. Verificar que no se creen órdenes duplicadas.
6. Verificar que se conserven productos, notas y datos del cliente.
7. Actualizar cards existentes para que muestren notas de orden y notas de productos

### Temporizadores y activación
7. Confirmar que el temporizador de preparación no corre mientras la orden está programada.
8. Confirmar que la cuenta regresiva de activación es correcta.
9. Confirmar que la orden se activa al llegar la hora programada.
10. Confirmar que el temporizador normal comienza desde la activación.
11. Confirmar que el estado se recupera correctamente después de recargar.
12. Confirmar que las órdenes vencidas durante una caída del servidor se procesan correctamente al recuperarse.

### Notificaciones y alertas
13. Verificar que el centro de notificaciones muestre el tiempo restante correcto.
14. Verificar que se genere la alerta al llegar al umbral de 20 minutos.
15. Verificar que la alerta no se duplique después de recargar.
16. Verificar que una orden cancelada no genere una alerta futura.
17. Verificar el comportamiento cuando varias órdenes alcanzan el umbral simultáneamente.
18. Verificar que varios clientes conectados no dupliquen los eventos.
19. Verificar el comportamiento cuando la página se abre por primera vez con una orden a menos de 20 minutos de activarse.

### Regresión
20. Confirmar que las transiciones preparar, lista, entregar y cancelar continúan funcionando.
21. Confirmar que las órdenes inmediatas conservan su comportamiento y temporizadores actuales.
22. Confirmar que no se afectan los cobros, la caja ni el inventario.

Utiliza pruebas con reloj controlado cuando sea posible, evitando tener que esperar minutos reales para validar cada escenario.

## Fase 10. Criterios de aceptación

La implementación se considera terminada cuando:

- El cajero puede programar una orden desde ventas.
- La orden aparece pausada en la pantalla de órdenes.
- El temporizador normal no corre durante la espera.
- El centro de notificaciones muestra una cuenta regresiva correcta.
- La alerta de 20 minutos se emite una sola vez por orden.
- La orden se activa automáticamente a la hora establecida.
- El proceso funciona después de recargas y reinicios del backend.
- Varios clientes conectados muestran estados coherentes.
- Las órdenes inmediatas siguen funcionando como antes.
- Los cobros, los permisos y la integridad de los datos permanecen intactos.

## Restricciones

- Trabaja sobre el repositorio existente.
- Reutiliza componentes y servicios cuando sea razonable.
- No reescribas el módulo de órdenes completo si una extensión localizada es suficiente.
- No realices commits, push, merges ni despliegues.
- No ejecutes migraciones destructivas.
- No desactives pruebas para conseguir una compilación exitosa.
- No afirmes que una prueba pasó si no se ejecutó.
- Documenta cualquier limitación de infraestructura que impida la activación automática o las alertas en tiempo real.

## Entrega final

Al finalizar, presenta:

1. Diagnóstico del flujo original.
2. Resumen de la implementación.
3. Archivos modificados.
4. Cambios de API, base de datos y estados.
5. Estrategia utilizada para activar órdenes automáticamente.
6. Estrategia de sincronización entre clientes.
7. Mecanismo para evitar alertas duplicadas.
8. Resultados reales de las pruebas.
9. Limitaciones y pasos para validación manual.

**Prioridad de ingeniería:** garantizar primero la integridad del ciclo de vida de las órdenes; después implementar la programación, las notificaciones y las alertas visuales.