# Puente zen_desktop · autorizado e implementado

El usuario autorizó añadir zen_desktop según esta propuesta y continuar implementando el puente. Solo se amplió tools con la función definida en config/desktop-tool.json, conservando web_search y todos los demás campos. [Configuración remota recuperada](evidence/desktop-agent-config.json). La configuración original está en config/saved-agent.original.json; la activa en config/saved-agent.json.

El puente consume required_actions, verifica sesión/turno/nombre/call_id, deduplica y devuelve tool_result con idempotencia. Una llamada fallida no se presenta como efecto verificado; preparar devuelve pendiente de aprobación humana. Usa la política sobre el texto original del usuario y la misma cola Windows.

Operaciones: listar aplicaciones/ventanas/medios/directorios; abrir aplicación registrada/URL explícita; leer/capturar ventana elegida; pausar sesión inequívoca; preparar creación nueva en directorio elegido. Capturas como contenido imagen temporal, nunca fichero/log. Ventanas/directorios se conceden en UI, expiran y se revalidan. El modelo no puede aprobar, enviar, borrar, sobrescribir, comprar, obtener credenciales, elevar ni ejecutar shell.

[Listar aplicaciones y abrir página propios: API + Electron reales](evidence/desktop-bridge-live.json), 35.277 ms conjuntamente, foco conservado. [Preparación por el agente y aprobación humana real](evidence/desktop-creation-live.json), 83.587 ms en ese recorrido, sin archivo antes de Permitir y contenido verificado después. El comparador de foco de ese recorrido fue false tras interacción con aprobación: no acredita foco conservado en él. Se corrigió la separación de la medición para otros escenarios; no se repitió la API solo para mejorar ese número.

No equivale a control general de cualquier interfaz. Los adaptadores de ratón/teclado/UI Automation general, portapapeles y navegación autenticada permanecen pendientes, con política por efecto final y pruebas. Las capacidades actuales están delimitadas y no se promete cobertura arbitraria.

Referencias: [configuración Agents API](https://developers.openai.com/api/docs/guides/agents-api/configuration), [funciones](https://developers.openai.com/api/docs/guides/agents-api/tools/functions). Un entorno adjunto no ejecuta automáticamente funciones locales.
