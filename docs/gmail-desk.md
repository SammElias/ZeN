# Gmail: carpetas, bandeja y lectura

Petición del 04/11/2026: adaptar el control de Gmail a la referencia visual de correo con tres paneles. Se mantiene la identidad y el tema de ZEN; el tema claro ofrece superficies lila y blancas y el oscuro conserva el contraste de la app.

## Interfaz

- Barra lateral: Recibidos, Destacados, Enviados, Borradores, Todos los correos, Spam y Papelera; Abrir Gmail y Ajustes. Los accesos tienen funciones reales. Abrir Gmail usa el enlace externo existente; no se presenta un editor de envío que ZEN no tenga.
- Bandeja central: búsqueda en la carpeta elegida, actualización, Todos/Leídos/Sin leer sobre conversaciones cargadas, avatar con inicial, remitente, fecha, asunto y vista previa. Un hilo por fila; selección visible y papelera contextual.
- Lector derecho: asunto, navegación anterior/siguiente, respuestas plegables, Original/Texto, imágenes externas manuales, confirmación de papelera y análisis/resultado de Codex existentes. Bandeja y lector se desplazan por separado; el cursor de lectura conserva carpeta, formato y mensajes abiertos en RAM.
- Ventanas estrechas: carpetas en una fila de iconos desplazable y alternancia entre bandeja y lectura; volver muestra la carpeta actual. Ajustes y autorización de papelera siguen accesibles.

Los ajustes de conexión y desconexión quedan separados de la lectura. No se añaden introducciones, métricas inventadas, envío de correos, modificación de estrellas, archivos adjuntos o borrado permanente.

## Lectura de carpetas

La consulta usa un enum fijo y los labels de sistema INBOX, STARRED, SENT, DRAFT, SPAM y TRASH. Todos omite el selector de label y conserva la exclusión predeterminada de spam/papelera. Solo estas dos carpetas habilitan includeSpamTrash. La búsqueda sigue acotada a 240 caracteres, veinte hilos por página y cinco páginas/cien hilos; no hay lecturas de carpetas en segundo plano. El recuento global de correo conserva únicamente el INBOX ya autorizado.

El token de página queda ligado a carpeta y consulta. Cambiar carpeta retira la lectura y la revisión de efectos, cancela peticiones anteriores e invalida las vistas enriquecidas y el contexto de análisis. Papelera se consulta en lectura y no permite preparar otro traslado del hilo ya eliminado. El transporte solo amplía la lista cerrada de labels, sin rutas arbitrarias, consultas sin límite o nuevas operaciones de escritura.

La API admite [listar hilos por label con gmail.readonly](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/list); los [labels de sistema](https://developers.google.com/workspace/gmail/api/guides/labels) se usan sin modificarlos. No cambia OAuth, ámbitos, cliente, tokens ni Google Cloud. Papelera modificable mantiene su consentimiento y revisión previos.

## Validación y entrega

Build y 828 pruebas en 67 archivos. Los diecinueve casos añadidos cubren rutas por carpeta, ámbitos conservados, selector desconocido rechazado, límites del transporte, vínculo de paginación, cursor RAM y rechazo de otra mutación dentro de Papelera.

Electron valida los tres paneles, legibilidad del remitente, desplazamiento independiente, las siete carpetas, ajustes separados y lectura a 320/760/1180, conservando el aislamiento HTML, imágenes manuales, lectura persistente, revisiones, análisis de Codex, sesiones y cápsula sin recuadro. Las pruebas de calendario y regreso a cápsula esperan a datos y propiedades nativas estables; se conservan las mismas condiciones, sin tolerar resultados incorrectos. Las capturas gmail-desk-dark/light dentro de docs/ui-preview/companion contienen datos sintéticos.

El EXE extraído pasa el recorrido antes de sustituir el único Desktop/ZEN.exe, con respaldo bajo release, hash idéntico y comprobación del bundle y observador nativo. Cuentas, preferencias, geometría, históricos y configuración de Codex se conservan. No se leen cuentas reales para las pruebas, se llaman modelos, se cambia Cloud ni se publica. Evidencia local en docs/evidence/gmail-desk-deployment.json.
