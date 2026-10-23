# Diagnóstico de errores del chat — 09/10/2026

El intento mostrado a las 23:04 terminó tras unos 10,6 segundos, sin identificador de respuesta guardado. El registro `execution.json` solo contenía el mismo texto genérico que mostraba la interfaz: no conservó la excepción original. No se puede atribuir una causa exacta retrospectivamente.

Se confirmó un defecto de clasificación: `APIConnectionTimeoutError` y `APIConnectionError` del SDK instalado heredan `name="Error"`. Además, un error del flujo SSE puede ser `APIError` sin estado HTTP. Ambos caían en el aviso genérico.

La clasificación ahora reconoce esas clases y los códigos protocolarios conocidos, distinguiendo espera agotada, conexión interrumpida, saldo, límite de solicitudes, acceso, parámetros, contexto e imagen. Una respuesta terminal fallida conserva su código y su identificador remoto, sin ejecutar herramientas pendientes. Los fallos se registran con metadatos permitidos; quedan fuera mensajes remotos, cuerpos, cabeceras, URLs, pilas, imágenes y credenciales. Los códigos desconocidos solo se marcan como no reconocidos.

No se reenvían automáticamente peticiones, ni se cambia el modelo, las herramientas aprobadas, el agente, Live, la clave o los mensajes históricos. El botón existente permite revisar y reenviar explícitamente.

## Evidencia y límites

- Build de producción y 373 pruebas en 41 archivos aprobados. Incluye clases reales del SDK, error SSE sin estado HTTP, redacción de datos sensibles, conservación de identificadores de respuesta fallida y ausencia de reenvío/ejecución de herramientas tras fallo.
- Una petición real con texto de prueba y el icono público local, sin historial ni captura personal, agotó el tiempo de espera de 30 segundos (`APIConnectionTimeoutError`). No se confirmó respuesta ni consumo. No se repitió la petición. `evidence/chat-diagnostic-api.json`.
- La consulta posterior del modelo `gpt-6.1-sol` respondió correctamente con la clave existente. No genera respuestas: `evidence/chat-network-diagnostic.json`. Esto confirma autenticación/acceso, pero no demuestra que la generación con imagen haya quedado disponible.
- El mensaje original del usuario no se volvió a enviar. El tiempo de espera observado es compatible con un fallo transitorio; no acredita la causa del intento histórico ni una recuperación completa del servicio.

La entrega se identifica por hash en `evidence/chat-error-deployment.json`. Las pruebas del paquete Electron usan un perfil aislado y estados locales simulados; no acreditan voz física ni el objetivo general del proyecto.
