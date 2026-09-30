# OpenAI: integración actual

Producción utiliza Agents API con el agente guardado ZeN, gpt-6.1-sol, reasoning low y salida text/verbosity low. Configuración literal en config/; web_search live/medium y zen_desktop añadido con autorización posterior específica. Se verificó acceso real en esta cuenta y corrigió solo la frase autorizada, recuperando después configuración exacta.

Sesiones nuevas con agent_id y environment none, sin overrides; SDK OpenAI 7.25.0 añade cabecera beta agents=v1. El entorno local no se conecta automáticamente al agente. Preservar sesiones para continuación no implica heredar memoria de ChatGPT. session.idle no es éxito: exige final turn.completed y resultado válido. La salida pública omite reasoning_steps.

Pruebas reales: búsqueda Microsoft, followup en la misma sesión y captura de ventana de prueba con borrador adaptado al perfil. zen_desktop está aplicado y conectado a política/cola local, con listado, página local y preparación de creación comprobados contra API real. Se mantienen intactas las demás opciones; no equivale a control general arbitrario. Documentación: [configuración](https://developers.openai.com/api/docs/guides/agents-api/configuration), [quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart), [funciones](https://developers.openai.com/api/docs/guides/agents-api/tools/functions).

Voz activa: gpt-realtime-2.1, WebRTC y WebSocket sideband. Audio sintético real valida transcripción, delegación y limpieza del buffer durante investigación. No acredita hardware físico. Pruebas usan TTS/transcripción auxiliar solo para fixtures; producción no cambia automáticamente modelos.

GPT-Live está pendiente y conserva JSON exacto del guion. No se atribuyen capacidades ni disponibilidad probadas a esa ruta. Los modelos Astra/Responses pertenecen a pruebas históricas de primera entrega, sin fallback silencioso en producción. [Estado y evidencia](objective-verification.md).
