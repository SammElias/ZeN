# Manejo de errores

| Situación | Comportamiento y recuperación |
| --- | --- |
| Entrada no válida u origen ajeno | Main rechaza en IPC; la vista muestra un mensaje breve y conserva el borrador si existe. |
| Codex no admite la cola | Explicar que el envío directo no está disponible; el usuario puede copiar la petición al chat fijado. |
| Timeout o recibo no verificable | «No se pudo confirmar el envío». Revisar el chat fijado antes de volver a intentar. No hay reenvío automático. |
| Codex no se abre | Mostrar fallo de apertura; si la petición larga ya se copió, confirmar esa copia por separado. |
| Falta respuesta o historial no legible | Mostrar Resumen sin respuesta disponible. Un fallo de lectura no habilita consultar otro chat. |
| Revisión caducada o archivo cambiado | Pedir revisión o selección nueva. No usar el contenido anterior. |
| Falta fuente multimedia | Estado vacío. Si una acción falla porque cambió la sesión, elegir una disponible. |
| Ajuste no guardado | Mostrar error y conservar la última configuración válida. |
| Permiso vencido o pipe cerrado | Devolver la decisión a Codex; no marcarla como aprobada. |

No incluir tokens, comandos completos, contenido de respuesta ni rutas privadas en errores generales. En Presentación, los mensajes no deben revelar detalles. Fuentes: [IPC](../../src/main/companion-ipc.ts), [peticiones](../../src/main/companion-request.ts), [lector](../../src/main/companion-codex-reader.ts).
