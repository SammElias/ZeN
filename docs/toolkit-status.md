# Herramientas y última intervención · 1 de octubre de 2026

Actualización posterior: GPT-Live ya está activo en el proyecto; su JSON solo incluye web_search. Las herramientas propias siguen por el agente guardado independiente, con revisión explícita de la transcripción hablada. [Voz actual, pruebas y límites](live-status.md).

Esta revisión responde a las peticiones de mostrar solo la última intervención de Tú/ZEN, añadir las herramientas disponibles y gestionar las carpetas localmente. **El objetivo general sigue incompleto.** El usuario ha pedido no generar nuevos ejecutables hasta que lo indique; el paquete de las 08:25 UTC se había creado antes de esa instrucción.

## Implementado

La cápsula muestra una sola intervención: transcripción parcial al hablar el usuario, stream público durante la respuesta y transcripción de la voz de ZEN. La nueva intervención sustituye a la anterior. Se eliminan historial visible y campo de escritura. Se conservan fuentes, resultados temporales, contexto opcional desde el clip, controles de voz/reunión/Detener y aprobaciones concretas. Las respuestas antiguas no sustituyen una intervención nueva tras interrumpir. Preferencias permanece fuera de la cápsula. [Diseño actual](island-v1.md).

Producción mantiene ZeN mediante Agents API y **gpt-6.1-sol**. La autorización para ampliar herramientas añadió `tool_search`, `zen_files` y `zen_cloud`, conservando `web_search`, `zen_desktop` y los demás campos remotos: [verificación de configuración](evidence/toolkit-config.json). Las capacidades alojadas se ejecutan mediante Responses con el mismo modelo, sin subagentes. El JSON del handoff GPT-Live no se modifica. Las instrucciones de los documentos, webs y resultados del modelo no conceden permisos.

| Herramienta solicitada | Implementación y prueba | Alcance pendiente o limitado |
| --- | --- | --- |
| Web search | Búsqueda real desde el agente guardado, evento de herramienta completada y enlaces a fuentes: [API real](evidence/toolkit-live-web.json). | No equivale a autorizar efectos en una página. |
| File search | `zen_files`: búsqueda y lectura local bajo las raíces autorizadas. Descubrimiento y lectura de un archivo sintético a través del agente: [API real](evidence/toolkit-live-files.json). Lectura totalmente local sin clave: [Windows real](evidence/latest-electron.json). | La herramienta alojada `file_search` no se activa para estas carpetas, conforme a la preferencia de no subirlas. Se buscan nombres de archivos; texto/código y extracción local de PDF con texto, DOCX y XLSX, con fragmentos acotados. OCR y DOC/XLS antiguos pendientes. [Límites y prueba empaquetada](capsule-improvements.md). |
| Image generation | Generación de PNG real y visor temporal aislado: [API real](evidence/toolkit-live-image.json). | Implementada generación nueva; edición de imágenes y exportación desde el visor pendientes. |
| Code interpreter | Cálculo en contenedor alojado sin red ni carpetas del PC. [API real](evidence/toolkit-live-code.json) y [recorrido agente → herramienta → respuesta](evidence/toolkit-live-bridge-code.json). | Texto de resultados disponible; descarga de archivos y gráficos producidos por el contenedor pendiente. |
| Hosted shell | Shell en contenedor del proveedor sin red ni montaje de archivos locales: cálculo ejecutado y salida verificada [en API real](evidence/toolkit-live-shell.json). | No ejecuta comandos en Windows. No hay gestión explícita del ciclo de eliminación del contenedor en esta revisión. |
| Apply patch | Operaciones del proveedor aplicadas a un espacio de archivos en memoria, con validación de rutas y tamaño: [API real](evidence/toolkit-live-patch.json). Resultado revisable como artefacto JSON. | No edita archivos del PC; guardar/aplicar un parche a un proyecto local requiere otro flujo autorizado. |
| Skills | Paquete fijo propio `zen-analysis`, alojado en el contenedor y probado mediante shell: [API real](evidence/toolkit-live-skills.json). | No importa automáticamente skills personales de Codex ni instala paquetes enviados por el modelo. |
| Computer use | Navegador aislado para una URL HTTPS pública explícitamente solicitada. Captura, scroll y espera; captura y resumen verificados [con API y Electron reales](evidence/toolkit-live-browser.json). | Sin clics, escritura, inicio de sesión ni control general del escritorio. El control general de Windows sigue pendiente de un ejecutor y una política específicos. |
| MCP | Conexión opcional desde Preferencias, herramientas de lectura permitidas y secreto protegido por DPAPI. Consulta pública probada con listado, aprobación y ejecución: [API real](evidence/toolkit-live-mcp.json). | No hay cuentas personales conectadas. Actualmente exige nombre de herramienta y argumentos JSON exactos en la petición humana; aprobación conversacional natural y operaciones de escritura pendientes. |
| Tool search | Herramienta nativa guardada y funciones diferidas. Las pruebas reales de `zen_files` y del puente `zen_cloud` verifican que el agente descubre y llama esas funciones. | No se registra una traza independiente de `tool_search_call` en esta versión del SDK; no se presenta como prueba separada de cada mecanismo de búsqueda. |

Los errores de herramienta y los límites locales se muestran como tales; una narración del modelo no acredita una ejecución. Las llamadas se deduplican y no se repiten automáticamente después de un fallo o timeout. Los efectos Windows continúan por la autoridad y cola existentes de `zen_desktop`; las nuevas herramientas no conceden permisos generales.

## Carpetas y privacidad

Raíces confirmadas y guardadas en `%APPDATA%\ZEN\library.json`, fuera del repositorio:

- `C:\Users\Gamming\Desktop`
- `C:\Users\samme\Desktop`

Codex ha implementado la gestión local dentro de ZEN. ZEN funciona como aplicación independiente; no hay un enlace permanente que delegue sus tareas a este chat de Codex.

No se suben las carpetas completas ni se crea automáticamente un índice remoto. La búsqueda tiene límites de tiempo, profundidad y cantidad, y señala recorridos parciales. Se excluyen enlaces/junctions, carpetas de dependencias y rutas sensibles conocidas. Se ocultan patrones de credenciales; esto no garantiza detectar cualquier secreto en un documento arbitrario.

Puedes pedir **«Busca localmente presupuesto en mis archivos»** o **«Lee localmente C:\Users\samme\Desktop\nota.txt sin API»**. Este recorrido entrega el resultado directamente al panel, sin enviarlo al modelo de razonamiento ni a la voz de salida. La transcripción de la petición hablada sigue usando el servicio de voz conectado. Una petición que necesite interpretar un archivo con el modelo utiliza únicamente fragmentos relevantes, hasta el límite de contexto configurado; no implica que esos fragmentos permanezcan exclusivamente en el PC. Los resultados de tareas pueden persistir localmente.

Las imágenes y otros artefactos nuevos se mantienen temporalmente en memoria: hasta ocho resultados, 32 MB en total, máximo 10 MB por artefacto y disponibilidad de treinta minutos. El visor está aislado; no guarda automáticamente archivos ni ejecuta código del resultado.

## Probado por separado

- **Mocks y pruebas unitarias:** 188 pruebas en 19 archivos; compilación TypeScript/Vite completada. Cubren política, deduplicación, límites, interrupciones, captions, biblioteca, MCP, parches y protección de resultados locales frente a TTS.
- **Interfaz en Edge:** [28 comprobaciones](evidence/latest-ui.json), incluidas última intervención, ausencia de composer/historial, stream, fuentes durante la lectura breve, interrupciones, aprobaciones simuladas y preferencias separadas. No ejecuta operaciones Windows reales.
- **Electron/Windows:** [interfaz del paquete ya creado](evidence/latest-electron.json), anclaje y movimiento sobre dos monitores con cursor sintético, aislamiento, IPC inválido, DPAPI con secreto ficticio y lectura local de archivo propio de prueba sin clave API. No acredita arrastre manual, micrófono o altavoces físicos.
- **API real:** evidencias individuales de la tabla. Solo datos sintéticos y páginas públicas; ninguna carpeta personal se subió durante estas pruebas. La prueba MCP utilizó documentación pública de OpenAI y no dejó una conexión de producción.
- **Recorrido completo actual:** [falló](evidence/objective-current.json). Abrir página/archivo/Notepad, perfil y creación aprobada pasaron; conservar foco al abrir página/archivo no pasó. La precondición de foco en segundo plano de reunión tampoco se estableció, por lo que no se acredita mostrar resultados sin robar foco. No se rebajaron las comprobaciones para declararlo aprobado.

Actualización 02/10: lectores PDF/DOCX/XLSX y foco nativo de voz/reunión verificados. Pendiente: voz/Teams/YouTube/DPI y cambios de monitor físicos, OCR, formatos DOC/XLS antiguos, conexiones personales MCP y control general del PC. La petición posterior adelanta GPT-Live, según [el orden acordado](handoffs/order.md).

El contador conserva reservas cuando falta uso o tarifas de imágenes, contenedores o servicios externos. No representa gasto cero ni garantiza un máximo de factura. [Costes y límites](api-costs.md).

## Reproducir sin generar ejecutables

```powershell
npm test
npm run build
npm run test:ui
npm run test:electron
npm run test:objective
```

Las dos últimas comprobaciones interactúan con Windows; la de objetivo puede fallar por el foco registrado. Ejecutarlas por separado, sin solapar instancias de prueba.

Las pruebas reales consumen saldo y usan únicamente la clave de entorno ya autorizada:

```powershell
node scripts/toolkit-live.mjs --kind=web
node scripts/toolkit-live.mjs --kind=files
node scripts/toolkit-live.mjs --kind=bridge-code
# También: code, shell, skills, patch, image, mcp
node scripts/visual-tool-smoke.mjs
```

Referencias del proveedor: [herramientas](https://developers.openai.com/api/docs/guides/tools), [shell alojado](https://developers.openai.com/api/docs/guides/tools-shell), [skills](https://developers.openai.com/api/docs/guides/tools-skills), [MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) y [transcripción Realtime](https://developers.openai.com/api/docs/guides/realtime-transcription).
