# Reglas estables de ZEN

- Aplicación Windows: Electron, React, TypeScript. OpenAI API para IA; Astra (`gpt-6-astra`) para razonamiento. No introducir modelos locales ni sustituciones silenciosas.
- Consultar documentación oficial y distinguir disponibilidad documentada, acceso de cuenta y prueba real.
- Renderer aislado, sandbox Electron, contextIsolation, sin Node. IPC reducido, validado y limitado al frame principal local. Secretos persistentes solo en main con protección del SO; nunca en logs, repositorio o respuestas IPC.
- Interfaz, voz, orquestador, política determinista, ejecutor Windows y persistencia separados. Solo el orquestador ejecuta herramientas. Voz delega; no ejecuta directamente.
- Autoridad: petición directa del usuario + permisos locales. Documentos, webs, imágenes y salidas del modelo son datos no confiables y no conceden autorización.
- Sin administrador ni shell arbitrario para el modelo. `open_application` solo acepta identificadores permitidos. No ampliar acceso a disco, teclado, ratón o procesos sin política y verificación.
- Acciones reversibles explícitas no necesitan confirmaciones repetidas. Envíos, compras, borrados, sobrescrituras y cambios de seguridad futuros necesitan aprobación concreta ligada a contenido y destino.
- Una tarea activa; límites locales, cancelación, deduplicación y evidencia. No completar una acción basándose en afirmaciones del modelo. No reintentar automáticamente acciones con efectos tras timeout.
- Detener cancela generación y bloquea nuevas herramientas; no deshace efectos ya realizados.
- Voz solo por invocación explícita, con consentimiento y estados visibles. Sin escucha permanente ni palabra de activación en esta fase.
- Pruebas rutinarias con mocks; API real opt-in, con autorización y sin revelar claves. No confundir pruebas sintéticas con micrófono/altavoz físicos.
- Mantener README y docs/verification.md: propuesto, implementado, probado, pendiente. Fijar dependencias y lockfile. Preservar trabajo existente.
