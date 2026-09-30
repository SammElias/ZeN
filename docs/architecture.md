# Arquitectura actual de ZEN

Estado y alcance verificable: [objective-verification.md](objective-verification.md). La primera entrega Responses/Astra se conserva en pruebas históricas; producción utiliza el agente guardado ZeN.

Main Electron posee credenciales DPAPI, persistencia, política y cola Windows. Renderer sandbox sin Node comunica contratos Zod desde el único frame local autorizado. Preload expone operaciones específicas, nunca filesystem, shell o claves.

SavedAgent usa Agents API con agent_id y environment none: conserva opciones guardadas y no adjunta un ejecutor cloud que supuestamente controle Windows. Sesiones separadas, seguimiento turn.completed real, eventos deduplicados y final_answer público. Continuación subscribe-before-input e idempotencia. requires_action se resuelve con zen_desktop autorizado: política original, capacidades elegidas, deduplicación y tool_result ligado a sesión/turno/call. Solicitudes desconocidas se bloquean. Se omiten reasoning_steps y acciones narrativas.

TaskManager permite investigación concurrente con cola acotada y prioridades, conservando FIFO entre iguales, y serializa efectos locales. Cada tarea tiene UUID/estado, cancelación y límites; directOperation reconoce órdenes humanas acotadas. Aprovals prepara destinos/contenidos inmutables, concesiones de directorio y permiso de un uso. El modelo no aprueba. No se repiten efectos al reiniciar.

Auxiliar .NET 10 ejecuta comandos fijos Win32/UI Automation/SMTC: ventanas, lectura, captura elegida, aplicaciones registradas y pausa verificable. No recibe código generado ni elevación. PrintWindow no garantiza leer contenido protegido; fallo o ventana no accesible no constituye éxito de lectura. Navegador/visor separados con sandbox, sin IPC de ZEN; sin cookies heredadas.

PersonalStore guarda perfil, modo y resultados limitados localmente. Observaciones temporales en RAM, single-use y caducidad dos minutos; no audio/capturas persistentes por defecto. Perfil relevante explícito se etiqueta como datos, no autoridad.

VoiceBackend controla Realtime vía sideband, transcripciones y delegación al mismo TaskManager; VoiceClient transporta WebRTC y reproducción local. Modo texto/reunión se reconsulta antes de responder. Silencio no cancela investigación; emergencia cancela voz, capturas y efectos pendientes. Esc desconecta voz conservando tareas. GPT-Live está [en cola](handoffs/order.md), sin activación anticipada.
