# Home con estados visibles

La petición del 25/10/2026 convierte Home en un resumen de música, correo, trabajo y avisos dentro de la misma cápsula. Se conserva la cabecera de dos columnas y la navegación: pulsar otro icono cambia de sección; repetir el activo recoge la cápsula.

## Información y navegación

- **Tu música** usa exactamente la observación multimedia de Windows que alimenta la cabecera: canción, artista, fuente y carátula cuando se proporcionan. No crea un segundo sondeo ni otorga controles de reproducción. Abrir reproductor lleva a Spotify dentro de ZEN.
- **Tu correo** muestra el número de mensajes sin leer en INBOX de la cuenta conectada, con hora de consulta. Es un recuento de no leídos, no una inferencia de mensajes nuevos desde la visita anterior. Sin conexión ofrece Conectar Gmail. Mientras se consulta o si falla, no inventa un cero; un recuento anterior se distingue de uno actualizado. Hay actualización manual y cada 60 segundos únicamente con Home visible.
- **Tu trabajo** sigue las fases recibidas del chat fijado: pensando, usando herramientas, permiso, terminado, error o interrupción. Un permiso pendiente tiene prioridad y abre su revisión completa; la tarjeta no aprueba nada. No se presenta la última herramienta como si siguiera ejecutándose después de Stop.
- **Avisos** muestra el número pendiente y el tipo del último aviso, sin copiar texto privado de respuestas o permisos. Ver avisos abre la sección existente y marca las notificaciones de la app como leídas.

Preferencias y conexiones siguen accesibles en A tu manera. En anchos estrechos se conserva la cuadrícula legible con desplazamiento del contenido; no se crean ventanas adicionales.

## Gmail y privacidad

La nueva operación `gmailSummary` está separada de listar y leer correos. Main exige la única ventana de ZEN, Home desplegado, visible y no minimizado, sin pausa ni Presentación, antes y después de la petición. El servicio niega resúmenes por defecto salvo autorización explícita del estado de Home. El único GET de datos es `labels/INBOX?fields=messagesUnread`, con respuesta acotada a 8 KiB y validación de entero no negativo. El transporte admite únicamente ese campo y rechaza campos duplicados u otros parámetros. Se conserva la renovación OAuth existente; no se añaden credenciales, ámbitos ni cambios de Google Cloud.

Salir de Home, recoger, ocultar, minimizar, pausar o activar Presentación revoca las lecturas y descarta resultados tardíos. El renderer retira su resumen y su temporizador al dejar de estar visible. El contador de cabecera se retira antes de IPC cuando la ventana está oculta; la política de Presentación/pausa sigue ocultándolo. Home no puede invocar la lista ni los cuerpos de Gmail y la cápsula cerrada no sondea el correo. El recuento y la metadata multimedia permanecen en RAM, sin persistencia, prompts ni registro de contenido.

## Validación

Build y 589 pruebas en 60 archivos superadas. Las pruebas Gmail incluyen contador cero real, ausencia de cuenta, errores, formato inválido, privacidad, revocación durante lectura/renovación y separación de permisos para lista/cuerpos. El transporte prueba la consulta mínima y el rechazo de parámetros adicionales.

El recorrido de Electron empaquetado comprueba canción y estado simultáneos, contador Gmail, avisos, refresco, Pensando/Usando herramientas/permiso/fin, navegación de las cuatro tarjetas sin recoger, lectura de avisos y bloqueo privado antes de IPC. Se usan Google, eventos y metadata simulados en un perfil aislado. La captura `docs/ui-preview/companion/workspace-home.png` contiene datos sintéticos. También se comprueba el EXE portable extraído antes de sustituir el del escritorio.

La entrega y los hashes se registran localmente en `docs/evidence/home-status-deployment.json`. El reemplazo verifica el EXE anterior, conserva una copia dentro de `release/desktop-backups`, protege cuentas/configuraciones/históricos y comprueba el bundle arrancado y su observador único. No se actualizan hooks, confianza ni relay, no se detiene Codex, no hay API de modelos ni commit/push. No se lee correo real ni se ejecuta reproducción para estas pruebas; no se atribuye validación física de DPI, foco o navegador y sigue vigente el límite de Computer Use anterior.
