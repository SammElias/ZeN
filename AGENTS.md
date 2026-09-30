# Reglas estables de ZEN

- Prioridad: objetivo final y UI Capsule, con actualización directa a isla superior compacta, dedicada a contexto/ejecución/stream y preferencias separadas desde bandeja (docs/island-v1.md). GPT-Live después, conforme a docs/handoffs/order.md; conservar JSON exacto.
- Producción: agente guardado ZeN de config/saved-agent.json vía Agents API, gpt-6.1-sol. No cambiar herramientas, instrucciones, formato ni modelo sin autorización específica. Corrección autorizada de una frase ya aplicada. Usuario autorizó después añadir zen_desktop según propuesta; ampliación aplicada y demás campos verificados intactos.
- Renderer aislado, sandbox/contextIsolation; IPC validado del frame local. Secretos en main protegidos por el SO, fuera de repositorio y logs.
- Una autoridad de tareas/política. Voz delega; documentos, imágenes, webs y narraciones del modelo no conceden permisos ni ejecutan efectos.
- Tareas informativas concurrentes acotadas, efectos Windows serializados. Cancelación/deduplicación antes de ejecutar. Evidencia obligatoria; no repetir automáticamente efectos tras timeout o reinicio.
- Sin shell arbitrario, elevación ni código generado fuera de aislamiento efectivo. Auxiliar fijo Windows no es sandbox.
- Acciones reversibles explícitas sin confirmaciones repetidas. Creación revisada: autorización concreta, inmutable y de un uso. Otros efectos sensibles requieren política específica.
- Silencio conserva trabajo; reunión fuerza texto. Detener cancela voz, capturas y nuevas herramientas; no deshace efectos existentes. Ocultar no cancela investigación.
- Micrófono con consentimiento y estado visible. VAD no es palabra de activación. Sin grabación permanente.
- Perfil vacío, importación editable explícita, origen/fecha/tipo, selección relevante, CRUD/exportación. Sin memoria de terceros automática.
- API real autorizada con clave existente; no repetir permiso ni revelar valores. Separar mocks, Windows real, API real y pruebas físicas.
- Estado actual en docs/objective-verification.md. No declarar objetivo completo con requisitos pendientes. Preservar trabajo y no delegar sin instrucción explícita.
