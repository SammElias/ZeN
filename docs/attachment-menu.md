# Clip compacto y carpeta de análisis · 01/10/2026

El usuario pidió sustituir la ventana de adjuntos por un menú sencillo como su referencia, sin seleccionar ventanas manualmente.

## Implementado

- Un único clip, pequeño y sin duplicado en el pie. Menú emergente «Añadir» dentro de la cápsula, tres filas con icono y texto: **Captura automática**, **Captura manual**, **Carpeta del proyecto**. Sin panel de controles de Windows, selección de ventana, texto accesible, reproductores ni ajustes. Las integraciones y herramientas existentes siguen disponibles por sus rutas autorizadas.
- Captura automática actualiza el monitor donde está ZEN; captura manual abre el selector de imagen. Ctrl+V, arrastrar imagen, miniatura y prioridad de imagen elegida se conservan. Escape cierra solo el menú; clic exterior lo cierra; flechas/Home/End permiten navegar.
- Elegir carpeta abre el selector nativo de Windows para una carpeta. Aparece una ficha compacta con su nombre y botón para quitarla. No se leen contenidos ni se llama a la API al elegirla. Después puedes escribir «Analiza la arquitectura de esta carpeta». La ficha permanece para preguntas posteriores, hasta quitarla, Detener o caducar la capacidad a los 30 minutos.
- Carpeta concedida en main con identificador opaco; no acepta rutas de archivo arbitrarias desde renderer, no modifica las raíces permanentes y no concede permisos para escribir. Se comprueban carpeta real, identidad, canonicalización y ausencia de enlaces. Un destino para crear un proyecto sigue eligiéndose por separado en la revisión de Codex.
- Al enviar una petición, lectura local acotada de estructura y fragmentos pertinentes. Prioriza nombres mencionados, README, manifiestos y documentación/código. Hasta 3000 entradas, diez niveles y ocho segundos para enumerar; inventario de hasta 60 nombres y ocho fragmentos de archivos de texto de hasta 1 MB, dentro del máximo de contexto configurado. Resultado marcado explícitamente como parcial.
- Omite dependencias, compilaciones, repositorio Git, rutas de credenciales conocidas, archivos de secretos y enlaces/junctions. Aplica la redacción local existente a fragmentos. No promete detectar todo dato personal ni todo secreto dentro de documentos.
- Analiza código, Markdown, texto, JSON, XML, configuración y manifiestos de proyectos. No sube la carpeta completa ni crea un índice remoto. Solo los fragmentos seleccionados llegan al agente al enviar la petición. Con «solo localmente sin API», devuelve el contexto local sin razonamiento ni TTS remotos. La imagen automática no se adjunta a la petición escrita de carpeta, salvo imagen manual elegida explícitamente.
- Capacidad también disponible para la petición hablada revisada mediante las herramientas propias. La conversación automática Live mantiene su JSON exacto y sus herramientas; elegir una carpeta silencia el micrófono para preparar la consulta escrita. No añade una herramienta al handoff Live ni convierte archivos en permisos de efectos.
- Se conserva una autoridad de tareas y deduplicación por petición. Detener cancela preparación pendiente y retira capacidades. Documentos y código son datos, no instrucciones para ejecutar operaciones.

## Probado

**235 pruebas en 26 archivos**, compilación TypeScript/renderer, [interfaz Edge](evidence/attachment-menu-ui.json), [IPC Electron/Windows](evidence/folder-context-electron.json) y [arranque del ejecutable empaquetado](evidence/portable-interface.json).

Las nuevas pruebas cubren lectura contextual, prioridad de nombres, secretos/dependencias omitidos, junction hacia carpeta externa, identificadores revocados/invalidos y cancelación. La interfaz comprueba clip único, tres opciones, ausencia del selector anterior, navegación/Escape, carpeta adjunta/quitable y resultado presentado con identificador de tarea distinto del de la petición.

[API real a través de IPC](evidence/folder-context-live.json): el agente leyó **582941** desde un README sintético, sin ese número en la petición. Carpeta concedida directamente por la prueba; no acredita selección física del diálogo nativo. No se leyeron/subieron proyectos personales.

Un primer smoke Electron agotó 30 segundos sin diagnóstico final; una repetición pasó y los empaquetados posteriores también. El [intento](evidence/attachment-electron-attempt.json) se conserva; no se atribuye una causa no demostrada.

Portable de esta revisión: `release/ZEN-20261001144927997/ZEN.exe`. La [corrección posterior del pegado](image-decoding.md) incluye un nuevo portable. Cierra ZEN anterior desde la bandeja antes de abrirlo; conserva su carpeta completa.

## Pendiente

PDF y documentos Office se incluyen por nombre en la estructura, con aviso de formato no extraído; extracción de contenido pendiente. El análisis es de fragmentos, no revisión exhaustiva de todo el repositorio. Validación física del selector, carpetas reales grandes y voz/reunión pendiente. El [objetivo completo](objective-verification.md) conserva los fallos generales de foco anteriores.
