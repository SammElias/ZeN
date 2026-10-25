# Navegación y accesos compactos — 24/10/2026

Aplicación de las mejoras aprobadas por el usuario: cuatro iconos Home/Spotify/Gmail/Codex más claros, selección visible, nombre al pasar el ratón o enfocar con teclado, apertura suave a la derecha y Escape para recoger. Se conservan cápsula orbital, anclaje y ventana común. La tira no gana altura.

## Uso

La cabecera conserva estado, retorno a la aplicación, Integraciones, Más opciones y Ocultar. Más opciones reúne última integración, volver al chat fijado, Avisos, sonidos, silencio de 30 minutos, presentación y preferencias. Los menús contextuales son nativos del sistema, sin nuevos BrowserWindow; las notificaciones/Avisos siguen siendo la única ventana aparte.

Los iconos se ordenan con arrastre dentro de la tira, Alt + flechas o las acciones Mover a izquierda/derecha del menú contextual. Clic derecho o Shift+F10 ofrecen acciones por integración. Solo se admite una permutación exacta de los cuatro identificadores conocidos; no se interpretan archivos, URLs ni comandos desde el arrastre. El orden y la última integración se guardan en companion-launcher.json fuera del repositorio. No contiene datos de correo, música ni sesiones. Preferencias no reemplaza la última integración; Permisos vuelve a Codex. Pulsar el núcleo orbital recogido restaura la última integración, también tras reiniciar.

## Spotify compacto

Desde Spotify → Ver en cápsula, o clic derecho en su icono → Ver en cápsula, la zona central muestra carátula si existe, título, artista y play/pausa admitidos por Windows. Si aún no hay una fuente elegida, se ofrece el selector explícito; no se elige un navegador automáticamente. Pulsar la canción abre el reproductor completo y × vuelve al estado de Codex.

La selección vive únicamente en RAM y se conserva al pasar entre la página Spotify y su modo compacto. La retirada de una vista anterior no puede cerrar la fuente de la nueva. El auxiliar fijo conserva comprobación de identidad de sesión, capacidades, cola acotada, id de acción de un uso y ausencia de reintentos de efectos. Se actualiza cada dos segundos solo con selección y superficie visible/autorizada. Presentación, pausa, ocultación, cambio a otra integración o cerrar el modo compacto retiran el acceso; un permiso pendiente tiene prioridad sobre la música. No detiene la reproducción al cerrar y no consulta Spotify Web API ni modelos.

## Gmail y Codex

Al consultar el buzón conectado, Gmail solicita mediante GET el contador messagesUnread de INBOX. El indicador conserva solo recuento y hora en RAM, sin asuntos/cuerpos. No hay consultas de correo desde la cápsula, menús o segundo plano. Tras 15 minutos se retira la insignia numérica; el tooltip identifica cuándo se obtuvo la observación. Presentación/pausa la ocultan antes del IPC y desconectar/configurar otra cuenta la borra. Se conserva OAuth Desktop propio de solo lectura.

Codex → clic derecho → Ver en cápsula muestra la fase y la última acción observadas del chat fijado. Su icono lleva el número real de permisos pendientes y ofrece acceso a la revisión completa o al chat exacto. Ninguna acción compacta concede un permiso. Se conservan la redacción de previews pendientes fuera de Permisos, presentación, política de un uso, hooks y confianza existentes.

## Validación y límites

Build y 510 pruebas en 57 archivos pasan. Incluyen persistencia de orden/última integración, rechazo de identificadores duplicados/ajenos, preferencias corruptas o no escribibles, separación de metadatos multimedia y ocultación del contador Gmail. Las pruebas de Gmail usan HTTP de Google simulado y callback loopback local; no correo real.

El recorrido Electron con perfil, música, buzón y hooks aislados comprueba navegación, menús y acciones ofrecidas, orden mediante teclado, Escape, contador observado/oculto, última integración, fase/acción de Codex, reproducción compacta, selección conservada en ambos sentidos, cierre atrasado de otra vista sin autoridad, permisos y límites anteriores. Las capturas del propio Electron pueden fallar de forma intermitente en el compositor de Windows; el capturador de pruebas reintenta únicamente esta lectura acotada hasta tres veces. Nunca repite controles multimedia ni efectos externos.

El comprobador de Windows usa un recibo JSON en el perfil efímero de su propio proceso para evitar bloqueos del transporte stdout de Electron GUI. Verifica PID y ruta exacta del EXE y sigue exigiendo salida normal con código cero; no acepta el archivo global de pruebas ni un recibo de otra instancia. La extracción portable usa el mismo recibo del proceso aislado observado, sin inspeccionar la instancia de producción ni el perfil del usuario.

La revisión física de menús/arrastre, reproducción real, notificaciones, DPI/monitores y el consentimiento Google siguen fuera de esta prueba. Continúa vigente el límite anterior de Computer Use sobre el navegador. No se cambian confianza, hooks, configuración histórica ni chat/proyecto fijados; no se detiene Codex ni se publica a GitHub.

La distribución es únicamente Desktop/ZEN.exe, con respaldo en release y verificación del EXE extraído antes de sustituirlo. Evidencia local de entrega: docs/evidence/launcher-polish-deployment.json.

Entrega terminada: SHA256 602f53f0378e063486bb409b363d568eab8e5415e52984d5933aaf977bb3aa27. La copia del escritorio coincide y el arranque normal ejecuta el main probado con un único observador nativo. Los archivos de cuenta de Gmail y chat fijado permanecen idénticos tras el reemplazo. No se hizo commit/push.
