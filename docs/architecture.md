# Arquitectura de la primera entrega

## Implementado

`src/main/index.ts` mantiene instancia única, ventana Electron, bandeja, atajos, manejadores IPC, configuración y permisos de medios. Renderer local bajo CSP, sin Node, `contextIsolation:true`, `sandbox:true`, navegación y nuevas ventanas bloqueadas. Se aceptan solo mensajes del frame principal local; los argumentos se validan con Zod.

`src/preload/index.ts` expone métodos concretos mediante `window.zen`; no expone `ipcRenderer`, shell, filesystem ni credenciales persistentes.

`src/renderer/` implementa conversación, configuración, estado/progreso, botón Detener y transporte WebRTC. El micrófono empieza deshabilitado hasta que el proceso principal tiene conexión de control; la negociación SDP viaja por IPC, sin clave API en esa respuesta.

`src/agent/orchestrator.ts` es el único propietario de ejecución. Responses usa Astra, function calling estricto, `parallel_tool_calls:false`, `store:false`, contexto en memoria de cada tarea y reasoning cifrado cuando es necesario para continuar. No hay memoria de conversación entre tareas en esta fase. Una tarea no termina satisfactoriamente para Bloc de notas sin evidencia local. Generación y herramientas reciben AbortSignal; se comprueba cancelación antes y después de cada llamada.

`src/agent/voice.ts` negocia `/v1/realtime/calls` desde main y abre un WebSocket sideband autenticado con la clave personal. La clave persistente nunca sale de main; esta alternativa oficial al token efímero evita incluso devolver credenciales temporales al renderer. Solo main procesa transcripciones, herramientas y uso. Cada turno transcrito dispara una respuesta Realtime con delegación obligatoria. `delegate_to_astra` no acepta texto del modelo: main usa la transcripción recibida directamente desde OpenAI. Una vez devuelve el resultado, Realtime responde por voz con `tool_choice:none`.

Detección de voz: server VAD, `create_response:false`, `interrupt_response:true`. Al comenzar otro turno main invalida la autorización pendiente y cancela el orquestador; se descartan resultados tardíos. Se deduplican transcripciones, call IDs y request IDs; una nueva call ID tampoco repite el efecto de abrir Bloc de notas dentro de una tarea. La caché de request IDs está limitada a 200 entradas, en memoria; no es deduplicación durable tras reinicios.

`src/policy/policy.ts` autoriza fuera del modelo una petición directa exacta y la operación habilitada. `src/tools/windows/` lanza únicamente el ejecutable de sistema y enumera ventanas visibles usando Win32, comprobando PID y ruta admitida del proceso. Una ventana de Notepad existente es evidencia suficiente; no se promete llevarla a primer plano ni crear un documento nuevo.

`src/storage/store.ts` guarda secretos con safeStorage/DPAPI y rechaza almacenamiento no protegido. Preferencias y registros se escriben de forma atómica. El directorio es el userData de Electron, no la carpeta del proyecto.

## Decisiones de producto

Una tarea, diez llamadas y noventa segundos. Configuración permite ajustar de 1 a 10 llamadas y de 5 a 90 segundos. Sesión de voz limitada a cinco minutos. Chat de texto bloqueado mientras la voz está conectada para evitar propietarios concurrentes. Modelos configurables explícitamente, sin fallback.

## Límites

Un renderer comprometido podría emitir peticiones de texto con la misma autoridad que la UI; el aislamiento y CSP reducen esa superficie, pero no prueban intención humana por sí mismos. No se cargan documentos ni páginas remotas en esta fase. Una transcripción es interpretación de audio por OpenAI y puede contener errores. La política conservadora reduce acciones equivocadas; no sustituye pruebas acústicas reales.

No se implementan operaciones irreversibles ni aprobaciones interactivas: `awaiting_approval` está en el contrato para futuras fases, sin usar para abrir Bloc de notas. No hay VM ni ejecución de código generado.
