# Correo enriquecido en ZEN

La [corrección posterior del formato por respuesta](gmail-all-replies.md) elimina el presupuesto HTML compartido que podía excluir mensajes posteriores, admite citas más grandes, incorpora estilos internos permitidos y unifica la vista de respuestas en texto. Sus cifras y límites sustituyen los de la primera entrega cuando difieran.

Implementación autorizada el 25/10/2026 después de la propuesta Original / Texto, respuestas plegables e imágenes opcionales. Al abrir una conversación se expande inicialmente su último mensaje disponible y se pliegan los anteriores. Se puede abrir cualquiera y alternar entre el texto completo disponible y el HTML saneado del remitente. Si un mensaje solo contiene texto, se conserva el lector de texto.

El formato admite tablas, colores, tipografía, espaciado y enlaces con aspecto de botón. El contenido mantiene fondo claro independiente de la interfaz de ZEN. No pretende reproducir toda la aplicación Gmail: se conservan las funciones existentes de bandeja, búsqueda, actualización, papelera y Abrir Gmail; no se añade envío, traducción ni descarga de adjuntos.

## Aislamiento

El HTML se extrae de los MIME ya recibidos por el lector de hilos y se limpia en main con una lista de etiquetas, atributos y propiedades CSS permitidos. Se eliminan scripts, eventos, estilos externos, formularios, marcos, SVG, objetos, URLs de CSS y protocolos que no sean web. No se interpreta HTML de adjuntos como cuerpo. El texto alternativo existente se conserva separado.

Cada cuerpo tiene un identificador aleatorio de vista, solo en RAM. Un protocolo local `zen-mail` lo sirve exclusivamente con Gmail visible y autorizado. El iframe usa `sandbox="allow-scripts"` sin `allow-same-origin`, sin Node ni preload/bridge. El correo no puede ejecutar scripts. El único script permitido por un hash CSP es el visor local fijo que ajusta la altura, recoge clics de enlaces y recibe imágenes ya validadas. El documento bloquea conexiones, fuentes, formularios, contenido anidado, multimedia y objetos; las imágenes solo pueden ser data URI raster. La CSP del renderer principal conserva sus restricciones de scripts/estilos y permite marcos únicamente del protocolo del lector.

Los mensajes entre visor y padre se comprueban por ventana origen, origen opaco, identificador de vista y tipos/valores permitidos. Los enlaces quedan inertes hasta pulsarlos. Main abre únicamente URLs HTTP/HTTPS normalizadas de la vista vigente, sin credenciales y sin protocolos del sistema ni destinos locales literales. Los clics no se convierten en instrucciones para Codex o el modelo.

## Imágenes

Las imágenes remotas no se cargan al abrir el mensaje. Mostrar imágenes hace una petición explícita para ese cuerpo e informa de que el servidor puede registrar la apertura. El navegador del visor nunca consulta los servidores de imágenes: main descarga HTTPS sin cookies, autorización de Gmail, referrer ni datos de sesión del navegador. Cada resolución DNS se valida como pública y se fija la dirección concreta usada por la conexión TLS; los redireccionamientos se vuelven a validar y están limitados. Se bloquean destinos locales, privados, reservados y formatos activos.

Se admiten PNG/JPEG/GIF/WebP con firma y tipo comprobados, máximo 1 MiB, 4 millones de píxeles y dimensiones de hasta 8192 por imagen. Hay hasta 16 imágenes por cuerpo, un presupuesto RAM compartido de 8 MB de URI y una carga explícita activa. El lote tiene 20 s de presupuesto y cada petición 10 s. No se reintentan errores automáticamente. Las imágenes correctas se reutilizan en RAM y las fallidas se pueden volver a solicitar mediante el botón.

Las imágenes CID/data ya incluidas en el MIME pueden mostrarse sin red adicional. Un CID cuyo archivo solo esté disponible como adjunto queda señalado como no disponible; no se amplía el transporte de Gmail para descargarlo. Se mantienen límites de HTML/MIME e hilos y los avisos de contenido incompleto. Algunas plantillas que dependen de CSS externo o imágenes de fondo no reproducirán todos los detalles.

Cambiar conversación/consulta/sección, recoger, ocultar, pausar, Presentación o desconectar elimina vistas y cancela lecturas. Plegar un mensaje o pasar a Texto cancela la carga de imágenes de ese cuerpo. Los resultados tardíos se descartan. El material del correo no se guarda en archivos, historial de ZEN, logs o resúmenes ni se envía a modelos.

## Validación y entrega

Build y 648 pruebas en 62 archivos pasan. Hay casos para tablas/estilos, HTML hostil, esquemas, CID, límites, direcciones privadas y DNS mixto, fijación de dirección, redireccionamientos, cancelación, MIME/tamaño/píxeles, acceso por vista, caché RAM y ausencia de lecturas externas sin petición. El recorrido Electron comprueba HTML y color real, iframe sin acceso al padre/bridge, bloqueo efectivo por CSP de script y fetch inyectados en la prueba, cero solicitudes remotas del navegador, formato Texto/Original, plegado, imágenes manuales, enlaces explícitos y privacidad, conservando las regresiones anteriores. Se usan exclusivamente correos y transportes simulados.

Las nuevas dependencias y licencias se incluyen con lockfile; la dependencia transitiva source-map-js se actualiza a 1.2.2 para evitar una vulnerabilidad de su versión inicial. No se realizan actualizaciones masivas del resto del proyecto. El EXE extraído se valida antes de sustituir el único Desktop/ZEN.exe, con copia de respaldo en release, hash idéntico, arranque y observador único. Evidencia local: `docs/evidence/rich-mail-deployment.json`; vista sintética: `docs/ui-preview/companion/gmail-rich-original.png`.

Se conserva OAuth y sus ámbitos existentes; no hace falta volver a autorizar para el formato. No se lee correo real, no se modifica Cloud/hooks/confianza/relay/Codex, no se hacen peticiones de modelos ni commit/push. Se conservan cuentas, preferencias e históricos y los límites físicos anteriores.

Referencias: [estructura MIME de Gmail](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages), [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [sanitize-html](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html).
