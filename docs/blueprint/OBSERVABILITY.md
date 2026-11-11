# Observabilidad

## Señales disponibles

- **Cápsula y Actividad:** fase, evento reciente y permisos del chat observado, con hora. Una acción terminada acredita ese evento; no demuestra que el turno o sus pruebas terminaran.
- **Resumen:** respuesta final y resultado del turno cuando hay evidencia. El lector del historial puede recuperar una respuesta sin inventar actividad ni resultado.
- **Avisos:** permisos, errores y finales recibidos. El usuario puede silenciar avisos temporalmente; esto no detiene la recepción.
- **Preferencias:** estado de conexión, comprobación de Codex y última señal. Un hook instalado o confiado no acredita recepción real.
- **Sonido:** muestra la fuente y los metadatos que publica Windows; un estado vacío no prueba ausencia de audio.

## Diagnóstico local

Si no llegan eventos, comprobar vínculo, proceso Codex, configuración de hooks y hora de la última señal. Si el recibo de una petición es incierto, mirar la cola del chat en Codex. Para reproducir un fallo usar el [recorrido aislado](TESTING.md) y guardar únicamente evidencias necesarias y anonimizadas. ZEN no requiere un servicio de métricas o alertas remoto.

Mantener el diagnóstico bajo la misma política de privacidad que el resto de la interfaz. Las capturas e informes con datos privados no se publican.
