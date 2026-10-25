# Contenido de escritorio — 25/10/2026

## Cabecera conjunta y multimedia automática

La cabecera conserva dos columnas mientras haya multimedia: estado y acción observada de Codex a la izquierda, contenido multimedia a la derecha. Esto se aplica tanto a la cápsula de 760×80 DIP como a la cabecera del panel desplegado, incluidos trabajo en curso y permisos pendientes. Los cinco iconos y controles siguen en la segunda fila. Los cambios de metadata no recrean ni redimensionan la ventana.

Un observador independiente consulta las sesiones multimedia que publica Windows, también de Chrome y otros reproductores, sin exigir selección previa. Conserva la sesión observada mientras siga reproduciendo; si deja de hacerlo, considera CurrentSession de Windows y después un orden estable entre las demás sesiones en reproducción. Si ninguna reproduce, retira el contenido automático. Solo son visibles las sesiones que el reproductor publica a Windows; no se captura audio ni se inspeccionan ventanas, pestañas, DOM o URLs.

La observación es de solo lectura: no entrega ID de sesión ni controles, no cambia la selección manual y nunca llama play/pausa por sí misma. El reproductor de la integración conserva selección explícita, capacidades, cola y acciones de un uso. La cabecera observa cada dos segundos mientras está visible, también dentro de Home, Gmail y Codex. Ocultación, pausa y Presentación cancelan y retiran datos antes de exponerlos; los resultados tardíos se descartan. La información se mantiene en RAM, sin historial, modelo ni telemetría con títulos.

## Gmail por conversaciones

Recibidos usa threads.list y threads.get, no una fila por mensaje. La fila muestra la última respuesta real según internalDate, el recuento del hilo y su estado de lectura. Deduplicar por ID de conversación conserva separados los asuntos iguales de conversaciones diferentes y evita duplicar filas entre páginas o respuestas tardías.

Al abrir se muestran las intervenciones cronológicas con remitente, destinatario, fecha y texto. HTML se convierte en texto inerte, sin scripts, enlaces activos ni imágenes remotas. No se descargan adjuntos. La lectura queda vinculada a IDs obtenidos de la consulta actual y a sus páginas/búsqueda; una consulta nueva revoca las anteriores. Se mantienen 20 conversaciones por página, cinco páginas y 100 conversaciones de ventana, con aviso al alcanzar el límite. El cuerpo admite hasta 100 mensajes, 200.000 caracteres por mensaje y 1.000.000 por hilo, con avisos explícitos y sin presentar un cuerpo cortado como completo.

El recuento de la insignia sigue siendo INBOX messagesUnread proporcionado por Google al consultar, sin sondeo del buzón desde la cápsula. Los tokens y la credencial Desktop cifrada se conservan; no cambian APIs, scopes ni configuración de Google Cloud. La entrega no consulta correos reales para probar el diseño.

## Última respuesta de Codex

Codex muestra su última respuesta final confirmada del chat y carpeta fijados, conservando Abrir Codex y los permisos/actividad. El texto se muestra literalmente e inerte; no ejecuta instrucciones del mensaje ni revive un chat propio. Mientras llega una nueva respuesta final se conserva la anterior y su fecha. El límite de vista es 64.000 caracteres, con indicación de recorte y acceso al chat original.

El relay existente admite last_assistant_message exclusivamente desde Stop. Se conserva solo en RAM y se retira antes de IPC cuando el panel Codex no es visible, en pausa o Presentación. No se copia en notificaciones, resúmenes, diagnósticos ni archivos de estado. Para iniciar/restaurar se consulta en modo de solo lectura la fila exacta del índice local y el rollout confinado a sesiones de Codex, con identidad de chat y cwd por turno, respuesta assistant/final_answer completada y task_complete correspondiente. No se reanuda el chat, envía trabajo ni llama a un modelo. La recuperación recorre ventanas inversas de hasta 2 MiB, con presupuesto de 16 MiB y cabecera de 64 KiB, reconstruyendo las líneas entre ventanas. Una caché RAM evita releer contenido de archivos inalterados. Si una respuesta nueva no puede confirmarse, no se sustituye por otra anterior como si fuera nueva; el hub conserva cualquier respuesta ya observada en RAM. No se interpreta una respuesta de otro chat/proyecto como válida.

La actualización sustituye únicamente los cuatro archivos binarios del relay propio, tras comprobar su versión previa conocida y guardar un respaldo. No reinstala ni modifica las definiciones de hooks, confianza o configuración de Codex, y no detiene Codex.

## Navegación

Con el panel recogido, cada icono abre su sección. Si ya está desplegado, repetir el icono activo lo recoge; otro icono cambia de sección manteniendo abierto el panel y su geometría. Main resuelve cada clic con el estado vigente, incluidos clics rápidos. Esta petición sustituye el cierre al pulsar cualquier icono de la entrega anterior.

## Validación y límites

Build, compilación nativa y 577 pruebas en 60 archivos pasan. El recorrido Electron con proveedores aislados comprueba agrupación/hilos, fuentes Windows, lectura sin autoridad de reproducción, estado de Codex y música simultáneos, privacidad antes de IPC, respuesta final inerte y navegación sin cierre al cambiar sección. Se comprueban anchos nativos efectivos de 320, 380 y 760 DIP y EXE portable extraído. Las pruebas focalizadas incluyen 22 casos multimedia, 41 Gmail/transporte y 59 de última respuesta/observador/privacidad.

La sonda nativa real de Windows confirma una sesión en reproducción y el formato de observación sin ID/controles, sin imprimir metadata privada ni accionar reproducción. No acredita entrada física, DPI/monitores, retorno de foco o notificaciones recibidas. La recuperación local de respuesta se verifica sin imprimir su contenido. El límite previo de Computer Use sobre Chrome permanece vigente, sin usar otro controlador para eludirlo.

Se entrega únicamente Desktop/ZEN.exe, con compilaciones y respaldos dentro de release. Configuraciones históricas, cuenta, credenciales de Gmail y chat/proyecto fijados se preservan. Sin llamadas al modelo, commit ni push.

Fuentes primarias: [Google Gmail threads](https://developers.google.com/workspace/gmail/api/guides/threads), [Stop de Codex](https://learn.chatgpt.com/docs/hooks).

## Entrega

Desktop/ZEN.exe sustituido por el portable probado, SHA256 f37b2ee9996856b5f58d6e64ca8e14ca601c23845cb033dc2c03952147834636. Respaldo del EXE y cuatro archivos del relay anterior dentro de release/desktop-backups. El relay instalado coincidía con la versión local conocida de 23/10; se actualizaron sus binarios sin escribir hooks.json/config.toml, comprobados por hash antes y después. Arranque normal con bundle idéntico y observador único confirmado. Cuentas, credenciales y configuraciones preservadas.

La lectura real acotada recuperó la respuesta previa de 310 caracteres sin imprimirla y la sonda Windows confirmó reproducción publicada sin accionar controles. El recorrido del nuevo Stop con texto se probó de forma aislada; no se declara recepción genuina nueva del mensaje de este turno antes de su finalización. No se leyó correo real para verificar la agrupación. Evidencia local: docs/evidence/desktop-content-deployment.json, windows-now-playing-read.json y codex-last-reply-local-read.json.
