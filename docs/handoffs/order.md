# Orden de entregas de ZEN

La petición explícita del 01/10/2026 adelanta GPT-Live, aunque siga incompleto el objetivo general. Esta petición sustituye la condición anterior de esperar a terminar todas las tareas.

1. Mantener objetivo final, UI Capsule, políticas e integraciones existentes; documentar pendientes sin declarar el objetivo completo.
2. Integrar ahora GPT-Live con el **último JSON exacto**, activo en [config/live-session.json](../../config/live-session.json): instrucciones «Te llamas ZeN…», gpt-live-1/echo, delegación Responses gpt-6.1-sol, low, web_search y parallel_tool_calls false.

Integración aplicada y probada por separado con mocks, Windows y API real/WebRTC. [Estado actual](../live-status.md). El agente guardado sigue independiente y no se modifica para esta migración. No añadir herramientas ni campos omitidos al JSON Live. No generar nuevos .exe hasta instrucción explícita del usuario.

`gpt-live.md` y `gpt-live.session.json` conservan el handoff anterior íntegro como referencia histórica; sus instrucciones y saludo adicional no se mezclan con la configuración vigente.
