# ZEN: estado verificable · 2 de octubre de 2026

**El objetivo final todavía no está completo.** Las instrucciones de los documentos se aplican dentro de la petición del usuario; páginas, imágenes y resultados se procesan como datos, sin autoridad para ordenar efectos.

## Revisión vigente: seis mejoras de cápsula y lectura local

Aplicadas señal real del micro recogido, progreso concreto, renovación al cambiar de monitor y aviso de referencia caducada, interrupción de reproducción sin cancelar tareas, lectores PDF/DOCX/XLSX y voz/reunión sin activar la cápsula. JSON y agente remoto conservados. [Implementación, pruebas y límites](capsule-improvements.md).

**Probado:** 246 pruebas en 29 archivos, build, interfaz Edge con señal Web Audio sintética, Windows/Electron incluyendo lectores, foco real conservado y [API real/WebRTC](evidence/live-webrtc.json) con búsqueda, audio y cierre confirmado. Nuevo portable `release/ZEN-20261002115323397/ZEN.exe`, [evidencia](evidence/portable-interface.json). Los fallos de foco de páginas/archivos se revalidaron; el test de reunión usa ahora el HWND real estable del fondo cuando Windows no activa la ventana sintética.

**Pendiente:** micrófono/altavoces humanos, interrupciones reales, Teams, proyectos personales y varias pantallas/DPI físicos. PDF escaneado/OCR y formatos antiguos .doc/.xls no están implementados. El objetivo completo sigue incompleto. Las revisiones siguientes conservan el historial de entregas y fallos anteriores, no el estado vigente.

## Revisión anterior: mini cápsula, despliegue conservado

Cápsula recogida de 240×40 DIP con icono, estado, micrófono y controles esenciales. Despliegue completo conservado: último mensaje/stream, escritura, capturas y carpeta de análisis. Arrastre entre pantallas y anclaje superior conservados. Hablar no abre automáticamente la mini barra. [Uso y verificación](mini-capsule.md).

**Probado:** 238 pruebas en 27 archivos, build, [Edge](evidence/mini-capsule-ui.json) y [Electron/Windows empaquetado](evidence/mini-capsule-electron.json), `release/ZEN-20261001155525543/ZEN.exe`. 240×40 nativo, caption sin desplegar, controles sin recortes, despliegue completo y arrastre a dos monitores. **Pendiente:** recorrido físico de ratón/voz/DPI y fallos generales de foco anteriores. El objetivo completo sigue incompleto.

## Revisión anterior: interfaz compacta y streaming estable

Aplicadas las seis mejoras autorizadas: actualización separada y agrupada del streaming ZEN/Codex, altura compacta estable durante trabajo, avisos de voz que conservan conversación, estados estabilizados, ficha visual de pantalla y controles agrupados con Copiar/Ir al final. JSON, modelos, herramientas y política conservados. [Implementación y límites](stable-interface.md).

**Probado:** 238 pruebas en 27 archivos, build, [Edge](evidence/stable-interface-ui.json), [Electron/Windows](evidence/stable-interface-electron.json) y [portable](evidence/portable-interface.json), `release/ZEN-20261001152044381/ZEN.exe`. Ráfagas sintéticas con texto exacto, DOM/cabecera/bounds estables, altura breve/extendida, copia, scroll y aviso de voz separado. Sin nueva llamada API.

**Pendiente:** confirmación física del parpadeo con la sesión del usuario, GPU/pantallas/DPI, voz/Teams y fallos generales de foco anteriores. El objetivo completo sigue incompleto. Los apartados siguientes conservan el historial.

## Revisión anterior: error al pegar capturas

Corregido el error «The source image cannot be decoded.», reproducido con la política de imágenes de producción. Lectura como `data:` mediante FileReader, manteniendo protección y límites; error en español para imágenes dañadas, captura válida anterior conservada y aviso limpiado al añadir una imagen válida. La vista previa aplica ahora la misma restricción de imágenes. [Causa, uso y límites](image-decoding.md).

**Probado:** 235 pruebas en 26 archivos, build, [reproducción Electron](evidence/image-decoding-policy.json), [pegado en renderer real](evidence/image-decoding-electron.json), [Edge](evidence/image-decoding-ui.json) y [portable](evidence/portable-interface.json), `release/ZEN-20261001145815191/ZEN.exe`. Imagen sintética válida y dañada, miniatura, conservación del adjunto y cero infracciones CSP; un único clip. Sin nueva llamada API en esta revisión.

**Pendiente:** portapapeles físico del usuario y aplicaciones personales; voz/Teams/DPI y fallos generales de foco anteriores. El objetivo completo sigue incompleto. Los apartados siguientes conservan el historial.

## Revisión anterior: clip compacto y carpeta del proyecto

Menú «Añadir» con tres opciones: captura automática, captura manual y carpeta del proyecto. Un único clip; retirada de la ventana anterior y sus selectores de ventanas/reproductores. Carpeta adjunta para analizar estructura, código y documentación de texto con fragmentos locales acotados; capacidad temporal de solo lectura, sin subir ni indexar toda la carpeta. Conserva la voz, las herramientas y el JSON exacto. [Uso y límites](attachment-menu.md).

**Probado:** 235 pruebas en 26 archivos, build, [Edge](evidence/attachment-menu-ui.json), [IPC Windows](evidence/folder-context-electron.json) y [ejecutable empaquetado](evidence/portable-interface.json), `release/ZEN-20261001144927997/ZEN.exe`. [API real](evidence/folder-context-live.json): lectura del código 582941 desde documentación sintética de la carpeta adjunta. Sin proyectos personales enviados. Un [primer smoke agotó tiempo](evidence/attachment-electron-attempt.json); repetición y paquetes posteriores pasaron.

**Pendiente:** extracción PDF/Office, recorrido físico del selector con proyectos del usuario, voz/Teams/DPI y fallos generales de foco anteriores. El objetivo completo sigue incompleto. Los apartados siguientes conservan el historial.

## Revisión anterior: chat con capturas y contexto del monitor de ZEN

Portable `release/ZEN-20261001143713064/ZEN.exe`: campo para escribir/pegar una captura, miniatura local antes de enviar y prioridad de la imagen elegida. Captura automática de los píxeles visibles del monitor donde está ZEN, cápsula excluida, regiones excluidas enmascaradas y «Ver captura» para comprobar la imagen exacta. Reloj de captions reiniciado al reconectar Live y texto protegido frente a captions antiguos. JSON Live/agente guardado conservados. [Uso, implementación y límites](image-chat.md).

**Probado:** 232 pruebas en 25 archivos; build de aplicación y auxiliar; [interfaz Edge](evidence/image-chat-ui.json), [IPC Electron/Windows](evidence/image-chat-electron.json) y [arranque del ejecutable empaquetado](evidence/portable-interface.json). [Windows con dos monitores y ventanas propias](evidence/screen-display-windows.json): monitor real, cambio de pantalla/página, cápsula fuera de la imagen y región visible excluida en negro. [API real de imagen adjunta mediante IPC](evidence/image-chat-live.json): código 739162 leído solo desde la imagen. [API real/WebRTC](evidence/screen-replacement-live.json): referencia de monitor sustituida en la misma sesión, lectura 222222 → 384729 y cierre confirmado, con voz sintética. También se repitió satisfactoriamente la prueba de cápsula oculta después de corregir la lectura del escritorio. No se capturaron/subieron páginas personales.

**Pendiente:** recorrido manual con LinkedIn y tus otras aplicaciones, micrófono/altavoces, DPI y Teams reales; los fallos generales de foco documentados no se revalidaron ni se declaran resueltos. El objetivo completo continúa incompleto. Los apartados siguientes conservan el historial anterior.

## Revisión anterior: captura detrás de ZEN y voz estable

Portable corregido `release/ZEN-20261001095454813/ZEN.exe`: referencia de la ventana situada detrás de la cápsula, renovación al abrir/activar voz, título visible y botón para actualizar; presentación de voz estable y sin destellos repetidos. JSON Live y agente guardado conservados. [Detalles y límites](screen-context.md).

**Probado:** 228 pruebas en 24 archivos, build/auxiliar, [Edge](evidence/screen-target-ui.json) y [arranque/interfaz del portable](evidence/portable-interface.json). [API real](evidence/screen-replacement-live.json): sustitución de imagen y lectura nueva en la misma sesión Live/SOL, con audio sintético y cierre confirmado. [Windows propio sobre dos monitores](evidence/screen-target-windows.json): ventana bajo la cápsula, movimiento y contenido renovado. [Repetición nativa bloqueada](evidence/screen-target-attempt.json) por acceso al escritorio interactivo; recorrido ampliado con cápsula oculta y prueba física con aplicaciones/micrófono del usuario pendientes. Los fallos generales de foco y el objetivo completo siguen pendientes.

## Paquete anterior: primera compilación autorizada

El usuario pidió explícitamente compilar el .exe el 01/10/2026. Portable generado en `release/ZEN-20261001092421154/ZEN.exe`, incluyendo GPT-Live, contexto visual automático y proyectos con Codex. Conservar toda su carpeta; no incluye claves ni perfil, usa la configuración local existente y requiere .NET Desktop Runtime 10.

**Probado en esta compilación:** 218 pruebas en 23 archivos, compilación TypeScript/renderer y auxiliar Windows, y arranque real del ejecutable empaquetado: aislamiento, anclaje, captions, controles Live, biblioteca local y aprobación de proyectos de un uso. [Evidencia y hashes de archivos](evidence/portable-interface.json). Alcance de arranque/interfaz; no se repitió la API real ni el recorrido completo de foco. Pruebas físicas de voz/reunión y fallos anteriores de foco siguen pendientes. El objetivo completo continúa incompleto. Los apartados siguientes conservan el historial previo al empaquetado.

## Revisión: proyectos y carpetas con Codex

Creación delegada al harness Codex alojado, sesión gpt-6.1-sol independiente del agente guardado/Live. Cápsula con transición ZEN → Codex, conversación y proyecto alternables, revisión de archivos/destino y guardado de un uso sin sobrescribir. [Uso, implementación y límites](codex-projects.md).

**Probado:** 218 pruebas en 23 archivos y build; [API real de preparación y exportación de un proyecto sintético](evidence/codex-project-live.json), [IPC/Windows](evidence/codex-project-electron.json) y [Edge](evidence/codex-project-ui.json). Pendientes prueba física por voz, proyectos complejos/existentes y los fallos de foco generales anteriores. Sin nuevo .exe; el objetivo completo continúa incompleto.

## Revisión anterior: contexto visual automático

Una instantánea de ventana al invocar ZEN, disponible para SOL antes de activar una nueva sesión de voz; sin captura continua ni guardado local. Estado visible, caducidad, cancelación y permisos existentes conservados. JSON exacto de Live y agente guardado intactos. [Implementación, uso y límites](screen-context.md).

**Probado:** 207 pruebas en 22 archivos, build, captura de ventana propia en [Windows real](evidence/screen-context-windows.json) y [API real/WebRTC](evidence/screen-context-live.json): SOL leyó un código presente solo en la imagen, Live lo habló y cerró con confirmación. Interfaz y Electron comprobados de nuevo. Pendientes el recorrido manual con aplicaciones personales/dispositivos físicos y los fallos generales de foco registrados anteriormente. No se creó nuevo .exe ni se declara completo el objetivo general.

## Revisión anterior: GPT-Live

La nueva petición adelanta Live: **voz gpt-live-1 / echo**, delegación Responses **gpt-6.1-sol**, con el JSON exacto del último handoff en config/live-session.json. Agente guardado, herramientas locales y permisos conservados; la sesión automática Live solo incluye web_search. Peticiones a herramientas propias se revisan con su transcripción exacta antes de ejecutarlas.

**Probado:** 198 pruebas en 21 archivos, build, [Edge](evidence/live-ui.json), [Electron/Windows](evidence/live-electron.json) y [API real/WebRTC con voz sintética](evidence/live-webrtc.json): sesión, captions literales, audio remoto, delegación web/SOL, respuesta hablada observada y cierre confirmado. Se conservó un intento previo de comprobación del resultado que agotó tiempo: [evidencia](evidence/live-webrtc-result-timeout.json); después se corrigió el fixture de audio continuo y el timeout de la prueba. No representa una prueba física.

**No se generó un nuevo .exe.** Los portables existentes siguen con la voz anterior. [Implementación y cómo probar el proyecto](live-status.md). Pendientes dispositivos físicos, interrupciones en conversación real, Teams y los fallos de foco del recorrido general registrados antes. El objetivo completo sigue incompleto.

Los apartados posteriores describen revisiones anteriores; esta sección es el estado vigente de voz.

## Revisión anterior: última intervención y herramientas

La cápsula muestra únicamente el último mensaje de Tú/ZEN, transcripción parcial y stream público; sin historial visible ni campo de escritura. Conserva contexto opcional, aprobaciones, voz, reunión, Detener y preferencias separadas. Recogida 640×48 DIP y expandida 1120×210 DIP, con arrastre lateral entre pantallas siempre anclado arriba.

La ampliación autorizada añadió `tool_search`, `zen_files` y `zen_cloud`. [Configuración remota verificada](evidence/toolkit-config.json): gpt-6.1-sol, instrucciones, formato y demás campos conservados. Los escritorios autorizados son `C:\Users\Gamming\Desktop` y `C:\Users\samme\Desktop`; búsqueda/lectura local, sin subir carpetas completas. Se añadió lectura explícita totalmente local sin enviar el resultado al razonamiento ni al TTS. La transcripción de la petición hablada sigue remota. Codex implementó el módulo dentro de ZEN, sin delegación permanente a este chat.

**Probado:** 188 pruebas en 19 archivos y build; [28 comprobaciones de interfaz Edge](evidence/latest-ui.json); [Electron/Windows](evidence/latest-electron.json), incluyendo lectura local sin clave, captions/interrupciones, aislamiento, DPAPI con secreto ficticio y anclaje. API real para web, lectura sintética, código, shell alojado, skill propio, parche en memoria, generación de imagen, navegador visual de lectura y MCP público: [detalle y límites](toolkit-status.md). Sin carpetas personales subidas ni cuentas personales MCP conectadas.

**Falló el recorrido completo actual:** [objective-current.json](evidence/objective-current.json). Página/archivo/Notepad, perfil y creación aprobada pasaron; mantener foco al abrir página/archivo falló. Tampoco se estableció la precondición de foco de reunión, por lo que no se acredita mostrar resultados sin activación. Los éxitos históricos no sustituyen este resultado. Pruebas físicas, formatos binarios, conexiones personales y control general de Windows siguen pendientes. GPT-Live conserva su orden y JSON.

El paquete anterior a la última instrucción figura en [portable-interface.json](evidence/portable-interface.json): alcance de interfaz, `fullObjectivePassed: false`. **No generar nuevos .exe hasta que el usuario lo indique.** Los ajustes siguientes se realizan sobre el proyecto.

Los apartados siguientes conservan la evolución y evidencias de revisiones anteriores; el diseño y el estado actuales son los descritos arriba.

## Continuación del 1 de octubre

Se integró mediante avance directo el commit `0de7665` de `origin/main`: compañero visual, sonidos locales y ahorro por sesión. Se corrigió el rechazo real de la API al contexto web `small`: ahora se usa `low`, tipado contra el SDK y protegido por una prueba de regresión. No se modificó el agente guardado remoto.

**Probado hoy:** 141 pruebas unitarias en 14 archivos, compilación de la aplicación y auxiliar Windows, [interfaz Edge](evidence/continuation-ui.json), [Electron/Windows](evidence/objective-current.json) y [API real de ahorro](evidence/economy-live.json). Esta última completó dos tareas sintéticas en la misma sesión y aceptó la configuración de voz mini; no generó audio. El uso de tokens llegó como `null`: se conservan dos reservas pendientes de 0,50 EUR estimados, no gasto confirmado ni ahorro porcentual medido.

La comprobación de foco falló inicialmente. Ahora el recorrido establece una ventana propia y verifica su foco tanto con Electron como con Windows antes de mostrar el resultado sin activación. Un recorrido anterior al ajuste de chat superó esa precondición y el resultado conservó el foco; el paquete posterior falló al establecerla, como se detalla abajo. La prueba registra también los fallos actuales sin sustituir evidencia previa de éxito. Esto no sustituye Teams real ni garantiza ausencia de variaciones del escritorio durante pruebas automatizadas.

## Ajuste de interfaz: chat único y ancho doble

Aplicado a petición del usuario el 01/10/2026: recogida de **640×48 DIP**, despliegue de **1120 DIP**, centrados en el borde superior y limitados al área útil. Sin pestañas Actividad/Tareas/Contexto, fichas horizontales, solicitud desplegable ni tarjeta de bienvenida. Las respuestas y el stream público se presentan completos en el chat, con scroll; las aprobaciones permanecen visibles cuando son necesarias. Adjuntos mediante clip con revisión opcional, preferencias separadas, voz/reunión/Detener y continuidad por respuesta conservados. No se modificaron integraciones ni configuración remota del agente.

**Probado:** build, 141 pruebas en 14 archivos, [Edge headless](evidence/chat-ui.json) y [ejecutable Windows](evidence/chat-electron.json). Este último verifica 640×48 y 1120×260 DIP, chat sin navegación, mismo anclaje, aislamiento y preferencias. El paquete nuevo existe y pasó la comprobación de interfaz; su prueba funcional completa **falló la precondición de foco de reunión**. Páginas, archivos, Notepad, perfil y aprobación revisada pasaron en ese recorrido, pero no se etiqueta el paquete completo como validado. La evidencia portable anterior se conserva. Pendiente: repetir el recorrido completo con foco estable y validación física de voz/Teams/DPI; ninguna prueba API adicional fue necesaria para este ajuste.

## Arrastre superior y chat simplificado

Nueva petición aplicada el 01/10/2026: cabecera/personaje arrastrables lateralmente y entre pantallas, siempre en el borde superior del área útil. Posición horizontal conservada al expandir, recoger y reabrir; guardada fuera del repositorio. Coordenadas obtenidas en main desde Windows; el IPC solo admite comenzar/terminar y está bloqueado en Preferencias. Pérdida de foco, ocultar, salir o timeout detienen el seguimiento del cursor. Clic normal abre el chat; arrastrar no lo abre accidentalmente.

Campo de escritura simplificado: se quitaron «Te leo», las otras etiquetas permanentes y el medidor inactivo; los controles quedan en una fila y se evita duplicar el micrófono entre cabecera/campo. Estado del micrófono, reunión, push-to-talk y cancelación siguen disponibles.

**Probado:** build, 145 pruebas en 14 archivos, [gestos y diseño en Edge](evidence/drag-ui.json), [paquete de interfaz](evidence/portable-interface.json). El controlador movió la ventana nativa por los extremos de dos pantallas reales con cursor sintético, conservando el borde superior al expandir/recoger y guardando la posición. No valida movimiento físico del ratón, DPI reales variados ni desconexión física de monitor. La prueba de paquete es de interfaz y conserva por separado el pendiente funcional de foco en reunión. No se hicieron nuevas llamadas API.

## Órdenes humanas y autorización de medios

Corrección del 01/10/2026 ante el bloqueo comunicado por el usuario. El filtro local ahora reconoce preguntas directas como «¿Puedes pausar la música?» y «Oye, Cem, ¿Puedes abrirme Google y pausarme la música de YouTube?», imperativos/infinitivos, nombre ZEN y cortesía. Google y YouTube se resuelven como páginas; las peticiones compuestas se conservan para el agente sin convertirlas en un único nombre de aplicación. La comparación de URLs tolera la barra final equivalente, sin autorizar otro origen, ruta o parámetros. Notepad conserva su permiso local previo. Agente guardado, herramientas, instrucciones, modelo y JSON de configuración sin cambios.

Una petición reconocida autoriza la operación reversible solicitada; no existe un interruptor adicional de «permisos multimedia». La autorización se calcula exclusivamente con la petición humana original, no con memoria, documentos, capturas ni resultados del modelo. Negaciones, citas y destinos alternativos siguen bloqueados. No se ha activado acceso general de administrador, shell, ratón o teclado.

La pausa directa y la del puente comparten selección de sesión: solo un reproductor en reproducción que corresponda a la fuente pedida; si ninguno reproduce, una única sesión pausada. Se rechazan identificadores duplicados, fuentes distintas, sesiones obsoletas y falta de Pause explícito. Nombrar Spotify permite elegirlo aunque haya otro reproductor; pedir YouTube no autoriza pausar cualquier aplicación ni inferir YouTube a partir de Chrome/Edge o del título de una canción. Windows SMTC puede informar únicamente la aplicación del navegador: en ese caso la identificación automática del servicio **queda pendiente** y el clip del chat permite **Ver reproductores → Pausar este reproductor**, mostrando el título y el estado. Es selección para una acción concreta, no configuración en el chat.

Los fallos de herramientas presentan el diagnóstico local y los efectos anteriores verificados. Después de un fallo, el stream y el resultado del modelo no sustituyen la evidencia ni muestran su recomendación inventada de activar permisos. Si se preparó una creación junto con un fallo, su aprobación continúa pendiente. No se repiten efectos automáticamente.

**Probado:** 165 pruebas en 15 archivos, build y [regresiones/alcance](evidence/desktop-permissions.json). [Edge headless](evidence/desktop-permissions-ui.json): selector desde el clip, llamada al identificador elegido y estado Paused con mock, conservando chat compacto y aislamiento. [Windows SMTC real](evidence/native-media.json): autorización de una petición cortés, selección **acotada al reproductor propio de prueba**, pausa verificada y segunda pausa sin reanudar. [Portable actualizado](evidence/portable-interface.json): arranque, IPC, chat y anclaje; alcance de interfaz, sin acreditar el objetivo funcional completo. Ninguna llamada API adicional; ningún reproductor personal modificado. **Pendiente:** prueba con YouTube real, control general por ratón/teclado/UI Automation y el recorrido completo de reunión ya documentado.

## Implementado y probado

| Capacidad | Implementación y evidencia |
|---|---|
| Agente guardado | Estado actual y ampliación de herramientas en [toolkit-status.md](toolkit-status.md). Agents API, ZeN/gpt-6.1-sol. Se corrigió la frase autorizada y después se añadió zen_desktop con autorización específica: [corrección](evidence/saved-agent-config.json) y [ampliación](evidence/desktop-agent-config.json). Las opciones económicas autorizadas se aplican por sesión; [agente remoto conservado](evidence/economy-live.json). Validación de turno/resultado, sin mostrar reasoning_steps ni ejecutar acciones narrativas. |
| Búsqueda/continuación | [Búsqueda real Microsoft](evidence/saved-agent-live.json), 19.418 ms; [continuación real](evidence/agent-followup-live.json), 9.802 ms. Suscripción antes de entrada, idempotencia y una entrada activa por sesión. Mocks prueban idle distinto de éxito, ejecución/idempotencia de required_actions autorizadas y bloqueo de solicitudes incompatibles. |
| Interfaz | [Isla compacta v1](island-v1.md), 640×48 DIP y anclaje superior, última intervención desplegada de 1120 DIP, con [compañero original y sonidos locales](companion-design.md). Vista expandida exclusiva de última intervención y stream, preferencias separadas desde bandeja. Resultados completos con scroll, permisos concretos, micrófono y Detener visibles. [Edge headless actual](evidence/drag-ui.json), Electron/Windows y stream público API real verificados por separado. DPI/monitores físicos, escucha de sonidos y confort en llamada pendientes. |
| Página/archivo/aplicación | Órdenes directas acotadas, navegador aislado, visor de lectura y aplicaciones registradas/Notepad con ventana verificada. [Electron real](evidence/objective-electron.json): páginas/archivos propios, Notepad y foco conservado en modo reunión. |
| Creación revisada | Directorio elegido, destino/contenido inmutables, permiso de un uso, sin sobrescritura. Tests filesystem y Electron real: tarjeta visible, clic Permitir, archivo leído y segunda aprobación rechazada. |
| Visión/lectura | Auxiliar .NET: UI Automation y PrintWindow de ventana elegida, límites, exclusiones y revalidación. [Observación Windows](evidence/native-observation.json). [Imagen enviada y borrador](evidence/vision-agent-live.json): datos de prueba, perfil de prueba, sin enviar mensaje; resultado recuperado tras corregir presentación como objeto, sin repetir petición. Captura no persistida localmente. |
| Medios | Órdenes directas naturales y SMTC con selección vinculada al origen pedido; clip del chat para una sesión concreta. Pause verificado. [Reproductor real de prueba](evidence/native-media.json): segunda pausa no reanuda; reproductores personales no modificados. |
| Memoria | Vacía inicialmente, importación con preview editable; hechos/preferencias/tentativos, origen/fecha, búsqueda, corrección, exportación y borrado. Tests persistencia/reinicio/UI, Electron guarda y elimina. Solo contexto relevante. |
| Tareas | IDs/estados y progreso de eventos reales, concurrencia 1–3 (una por defecto), cola de pendientes acotada, prioridades alta/normal/baja y FIFO entre iguales, cola serial de efectos, cancelación individual/global, tiempo/pasos, resultados persistentes y recuperación sin repetir efectos. **165 tests en 15 archivos**; build y auxiliar compilados. |
| Ahorro | [Opciones por sesión y contador local](api-costs.md), reservas antes de llamadas de pago, recibos deduplicados y conservación de reservas con uso desconocido. Dos tareas API reales completas, continuación y configuración mini aceptadas. Consumo real y ahorro comparativo no cuantificados; no es un límite garantizado de factura. |
| Voz/reunión | Realtime/WebRTC + sideband, transcripción autenticada al mismo gestor; voz mini y lectura breve del resultado implementadas. [Configuración mini aceptada](evidence/economy-live.json), sin generar audio en ese recorrido. Silencio persistente, reunión manual y resultados sin foco (Electron real). Push-to-talk: conecta silenciado, botón mantenido/Ctrl+Espacio con ZEN enfocado, suelta/cambio de foco silencia; mocks de negociación/cancelación. [Interrupción real anterior](evidence/voice-interruption-live.json): audio sintético limpiado con investigación activa, tarea completa por escrito. No valida hardware físico ni acredita audio del nuevo modelo mini. |
| Ejecutable | [Interfaz actual ejecutada](evidence/portable-interface.json), arranque/aislamiento/geometría y controlador de arrastre verificados; recorrido completo pendiente por precondición de foco. [Portable anterior](evidence/portable-package.json), ruta/hashes/pruebas completas anteriores. Sin claves ni datos personales; requiere .NET Desktop Runtime 10. Sin instalador/firma propia. |

clearRoundTripMs = 886,1 ms en voz incluye espera deliberada hasta investigación activa y transporte remoto: **no mide mute local ni interrupción hablada**. No se midió primera respuesta física o calidad acústica. Duración de visión no registrada: null.

El usuario dijo «perfecto validado» sobre la versión anterior. Es aceptación comunicada, sin atribuirle pruebas físicas específicas ni extenderla a cambios posteriores.

## Ampliación autorizada del agente

El usuario autorizó añadir zen_desktop manteniendo intactas las demás opciones. [Configuración remota verificada](evidence/desktop-agent-config.json). El bloqueo anterior quedó resuelto: puente implementado, con política sobre petición original, capacidades locales elegidas, deduplicación, resultados por call/turn e idempotencia.

[API + Windows reales](evidence/desktop-bridge-live.json): listar aplicaciones y abrir una página local mediante la función, título verificado y foco conservado, 35.277 ms conjuntamente. [Creación propuesta por el agente](evidence/desktop-creation-live.json): 83.587 ms, tarjeta con contenido correcto, ningún archivo antes de Permitir y creación verificada después. El foco de ese recorrido con aprobación humana cambió; no se presenta como foco conservado. El comparador del recorrido general se separó después. Todas las operaciones del puente no se validaron juntas contra API: lectura, captura, medios y apps tienen evidencia independiente; puente completo de esas rutas queda pendiente de recorrido real.

[Alcance y configuración](desktop-tools-proposal.md). No se declara control general de Windows por haber añadido una función limitada.

## Pendiente

- Control general Windows por UI Automation/ratón/teclado y navegación autenticada de LinkedIn. Borrador con captura de prueba validado; conversación real/envío no probados. Navegador ZEN no hereda cookies Edge/Chrome.
- Captura de monitor seleccionable, observación continua autorizada, portapapeles y organización general de proyectos. Hoy ventana seleccionada y creación nueva revisada.
- Presupuesto monetario duro por sesión. Prioridades, controles urgentes, pasos, tiempo y concurrencia implementados. Pausa bloquea efectos nuevos, sin suspender investigación remota.
- Detección fiable de llamada Teams; resultados discretos sin foco opt-in y push-to-talk ya implementados. Prueba física de push-to-talk pendiente.
- Palabra de activación fiable con consentimiento para micrófono continuo si se implementa. VAD/atajo no equivalen a «Hola Zen».
- Sandbox efectivo si se habilita código generado; no se habilitó shell arbitrario.
- Recorridos físicos: Teams real, micrófono ocupado, eco/auriculares, varios monitores/DPI, bloqueo/UAC/ventanas privilegiadas y pérdida de red real. Controles/mocks/diagnósticos existentes no sustituyen esos recorridos.
- Instalador, firma y actualizaciones. Portable disponible para probar.
- GPT-Live **registrado, no integrado ni probado**, por la orden de terminar primero tareas anteriores; [JSON y guion exactos](handoffs/order.md).

## Entorno

Windows; Node 22.17.1; Electron 44.5.1; .NET SDK 10.0.401; OpenAI SDK 7.25.0. [README](../README.md) contiene comandos. Se incorporó `origin/main` hasta `0de7665`; las correcciones y evidencias de esta continuación son locales, todavía sin publicar en GitHub.
