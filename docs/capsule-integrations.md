# Integraciones de la cápsula — 24/10/2026

El usuario autoriza desarrollar navegación de integraciones desde ZEN, empezando por Gmail y Spotify. Después confirma que ambos servicios ya están disponibles como MCP en Codex. Esta entrega reutiliza esas conexiones mediante peticiones revisadas en el chat fijado. No crea OAuth propio, no copia credenciales, no instala conectores ni altera su confianza.

## Alcance entregado

Un acceso de cuatro cuadros en la cápsula abre una ventana independiente con Codex, Spotify, Gmail y Conexiones. Al desplegar la cápsula aparecen los mismos accesos. Se conserva el tamaño exterior, el anclaje, el retorno a la aplicación, los estados reales, los permisos y los avisos.

Gmail ofrece revisar no leídos, buscar correos, resumir el correo de hoy y redactar un texto de respuesta para revisión. Spotify ofrece búsqueda, biblioteca, consulta explícita de reproducción actual y propuesta de playlist. Las peticiones incluyen límites de resultados y no autorizan enviar, borrar, archivar, marcar como leído, crear borradores remotos, reproducir ni modificar biblioteca o listas. La propuesta de playlist y el texto de respuesta no crean contenido en los servicios.

El usuario revisa el texto exacto y pulsa «Copiar y abrir mi chat». ZEN copia esa petición y abre únicamente el chat/proyecto fijados. El usuario pega y pulsa Enviar en Codex. No se crea otro chat, se reanuda una copia, se inyecta texto en la UI de Codex ni se inicia un turno desde ZEN. Los resultados y la revisión de operaciones posteriores permanecen en Codex. La navegación y la comprobación del catálogo no generan respuestas de modelo; el trabajo posterior de Codex consume el uso del plan correspondiente.

Se ofrecen enlaces fijos a las webs oficiales de Gmail y Spotify. El renderer no puede proporcionar otra URL. No hay lector de correo ni reproductor ficticios, contadores inventados o sincronización continua del buzón.

## Por qué el traspaso es explícito

La versión instalada expone `mcpServer/tool/call`, pero exige un chat cargado en ese app-server. Una prueba acotada, sin iniciar ni reanudar conversaciones, confirmó que el proceso independiente no tiene cargado el chat fijado y rechazó la petición con `-32600` antes de llamar Gmail. No se fuerza una segunda carga concurrente del chat para obtener acceso.

Los enlaces oficiales permiten abrir un chat existente; el parámetro de compositor `prompt` está documentado para chats nuevos. Por ello se utiliza revisión y portapapeles, sin inventar parámetros para un chat existente ni automatizar su interfaz. Referencias: [app-server](https://learn.chatgpt.com/docs/app-server), [enlaces de la aplicación](https://learn.chatgpt.com/docs/reference/commands).

## Catálogo y límites de autoridad

`CompanionConnections` consulta únicamente `mcpServerStatus/list`, con paginación limitada, caché de un minuto, comprobaciones concurrentes agrupadas y auxiliares de vida acotada. Conserva solo funciones conocidas de `codex_apps`, sin esquemas, descripciones remotas, recursos, nombres de cuentas ni tokens. No llama herramientas de Gmail/Spotify, no ejecuta prompts y no usa una clave API.

La consulta real con este código confirmó los cuatro accesos de cada proveedor. Esto acredita funciones detectadas; no prueba que cada cuenta mantenga autorización ni que una operación concreta vaya a completarse. La UI lo explica y permite comprobar de nuevo o revisar la conexión dentro de Codex.

Las acciones son enumeradas. La búsqueda humana está limitada a 240 caracteres sin controles y se inserta como criterio citado. No hay selección de RPC, programa, herramienta, destino o credencial desde el renderer.

Cada propuesta vive solo en RAM, es inmutable, tiene identificador aleatorio y caduca a los dos minutos. Se consume antes de copiar/abrir para rechazar dobles clics y no repetir efectos tras errores. Cancelar, cambiar de pestaña o consulta, cerrar la ventana, comprobar de nuevo, pausar o entrar en Presentación invalidan la revisión. El main vuelve a validar política, chat y carpeta al continuar. Si el portapapeles falla, no abre Codex; si falla la apertura, distingue petición copiada de chat abierto y no reintenta automáticamente.

Solo la ventana de integraciones recibe el texto de propuesta por IPC. Las respuestas imperativas no contienen texto privado y los snapshots llevan revisiones crecientes. Presentación elimina propuesta y recibo antes de IPC, borra la consulta de la UI y bloquea preparación, copia y apertura del servicio. No borra contenido ya copiado explícitamente al portapapeles.

## Validación

Build y 473 pruebas en 52 archivos pasan, con cuatro workers. Las nuevas pruebas comprueban el catálogo acotado, fallo y recuperación, caché, funciones parciales, cierre, revisión sin ejecución, origen/destino, expiración, cancelación, privacidad, dobles clics y errores de navegación/portapapeles.

El recorrido Electron utiliza un perfil, catálogo y eventos sintéticos aislados. Comprueba paneles independientes, navegación, revisión visible, chat exacto, rechazo desde cápsula, privacidad, ausencia de reproductor simulado, URLs fijas y anchuras 380/600. El portapapeles del recorrido es simulado para no sustituir el del usuario. La consulta real del catálogo no lee correo ni reproducción. No se prueba físicamente el navegador: continúa vigente el límite anterior de Computer Use y no se utiliza otro controlador para eludirlo.

Evidencias locales ignoradas: `integration-catalog-read.json`, `companion-native.json`, `single-executable.json` e `integrations-deployment.json`, bajo `docs/evidence/`. La entrega es únicamente Desktop/ZEN.exe, con respaldos dentro de release; sin commit, push ni publicación del EXE en esta petición.

## Preferencia de diseño

El usuario añade Figma durante el desarrollo para diseño y revisión visual. Plugin Management confirma el plugin instalado y habilitado. No hay herramientas de Figma expuestas a esta sesión, por lo que no se afirma haber creado o probado un diseño allí. Se conserva esta preferencia para futuras revisiones, sin reinstalar el plugin, cambiar permisos ni detener Codex.
