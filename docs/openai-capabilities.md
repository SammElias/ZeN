# OpenAI: integración actual · 01/10/2026

Voz actual: gpt-live-1 / echo, delegación Responses a gpt-6.1-sol, sin añadir campos al JSON. Captions por intervalos, cierre confirmado y revisión explícita de transcripción para herramientas propias. [Implementación y pruebas](live-status.md).

Producción utiliza Agents API con el agente guardado **ZeN / gpt-6.1-sol** y configuración literal en `config/`. Las autorizaciones específicas aplicaron la corrección de una frase, `zen_desktop` y después `tool_search`, `zen_files` y `zen_cloud`. La última actualización verificó que nombre, modelo, instrucciones, formato, razonamiento y multi_agent remotos se conservaron: [evidencia](evidence/toolkit-config.json).

Las sesiones aplican las opciones económicas ya autorizadas: razonamiento bajo, servicio estándar, salida JSON pública compacta, subagentes desactivados y contexto web `low`. Se renuevan sesiones de configuración anterior mediante la versión económica `zen-economy-v2-tools`. El SDK es OpenAI 7.25.0; `session.idle` no acredita éxito: se exige turno completado y resultado válido. Se preserva continuidad acotada y no se hereda memoria de ChatGPT.

`web_search` funciona desde el agente guardado. `zen_desktop` usa la política y la cola Windows existentes. `zen_files` consulta la biblioteca local autorizada, sin subir carpetas completas. `zen_cloud` ejecuta capacidades alojadas mediante Responses con el mismo modelo: imagen, intérprete de código, shell alojado, skill propio, parches en memoria, navegador visual aislado y conexión MCP opcional. La petición humana original determina autorización; modelos, herramientas y documentos no conceden permisos.

No se cambia producción a Astra por el ejemplo del usuario. La herramienta alojada `file_search` no se activa para los escritorios, conforme a la preferencia por gestión local. El shell alojado no ejecuta comandos en Windows; los parches no editan archivos del PC. Computer use se limita a lectura de una página pública HTTPS explícita en navegador aislado, sin clics ni escritura. Las conexiones personales MCP no están configuradas y no heredan credenciales de Codex. [Implementación, API real y límites por herramienta](toolkit-status.md).

Ruta anterior de voz (conservada como regresión, no activa): **gpt-realtime-2.1-mini**, transcripción **gpt-4o-mini-transcribe**, WebRTC y WebSocket sideband. La transcripción parcial alimenta el panel; solo la transcripción completada delega la petición. Cada respuesta hablada lleva el identificador de la intervención, y los eventos obsoletos se descartan al interrumpir. Reunión fuerza texto. Las lecturas explícitamente locales no envían su resultado a razonamiento ni TTS; la transcripción de la petición hablada sigue remota.

Las pruebas actuales cubren mocks, Windows, API real y navegador por separado. No acreditan micrófono/altavoz físicos ni una reunión real. El recorrido completo conserva fallos de foco y no se declara aprobado: [estado](objective-verification.md). El contador conserva reservas cuando falta uso o tarifas adicionales de herramientas; [costes](api-costs.md).

GPT-Live está activo por petición explícita del 01/10/2026, con JSON exacto vigente en config/live-session.json y API real/WebRTC probada: [estado y límites](live-status.md). El handoff anterior se conserva como referencia histórica. [Orden del handoff](handoffs/order.md).

Referencias: [Agents API](https://developers.openai.com/api/docs/guides/agents-api/quickstart), [funciones](https://developers.openai.com/api/docs/guides/agents-api/tools/functions), [herramientas Responses](https://developers.openai.com/api/docs/guides/tools) y [Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations).
