# Seguridad y privacidad

## Identidad, permisos y secretos

La cuenta de ChatGPT pertenece a Codex. ZEN no recibe sus credenciales ni solicita una clave de modelo en el flujo activo. El puente de hooks valida su token local; el hub limita la sesión al destino fijado cuando existe. Un permiso requiere revisión y decisión de un uso. Al caducar o perderse la conexión, la decisión vuelve a Codex.

No publicar tokens, rutas personales, IDs reales, perfiles, historiales ni fondos privados. `CODEX_HOME` cambia dónde busca Codex; no es una credencial. Los tokens históricos de Google y del chat propio no se reutilizan en la aplicación activa.

## Límites de procesos y datos

- Electron usa sandbox, aislamiento de contexto y Node deshabilitado en el renderer. El proceso principal verifica frame, URL local y esquema antes de ejecutar.
- Las respuestas se muestran como Markdown inerte; texto procedente de Codex o aportado por un tercero no adquiere permisos.
- Pausa, Presentación y visibilidad se comprueban antes de IPC y en efectos asíncronos. En Resumen se verifica la vista y el chat antes de revelar la última respuesta.
- Inicio recibe únicamente los metadatos de los apuntes recientes. Los cuerpos, adjuntos y borradores se consultan en Knowledge Hub. Inicio usa las etiquetas y fechas de actividad de Codex y abre Resumen para mostrar una respuesta.
- La revisión de análisis caduca a los dos minutos, es de un uso y conserva una huella del archivo. La selección usa diálogo nativo y excluye enlaces simbólicos y archivos de más de 32 MiB.
- La imagen de fondo se normaliza localmente; el protocolo de tema solo sirve el fondo vigente. No se adjunta a peticiones.
- La observación de multimedia no envía acciones. El control exige selección vigente y gesto explícito.

## Verificación para cambios

Comprobar frame ajeno, destino distinto, respuesta tardía, permiso consumido, vista oculta y contenido no permitido. Usar mensajes de diagnóstico acotados y perfiles sintéticos. Ver [política de estado](../../src/shared/companion-privacy.ts), [IPC](API.md) y [contrato de archivo](../../src/main/companion-context-file.ts).
