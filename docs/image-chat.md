# Chat y referencia visual actual · 01/10/2026

Implementado a petición del usuario: campo de escritura con pegado de capturas y captura automática de los **píxeles visibles del monitor donde está ZEN**. Se conservan las integraciones, el JSON exacto de Live y el agente guardado.

## Uso

Haz clic en **Escribe o pega una captura…**, pega con Ctrl+V, escribe lo que necesitas y envía. La miniatura permite quitarla antes de enviar; también puedes arrastrar una imagen o usar el clip del campo. Enter envía, Shift+Enter añade una línea. Si envías solo la imagen, la petición es «Ayúdame con lo que aparece en esta captura».

La imagen pegada tiene prioridad sobre la automática para esa petición. Escribir silencia el micrófono y la respuesta Live en curso, conservando la conexión; reactivar el micrófono vuelve a voz con una referencia nueva. La cápsula sigue mostrando únicamente la última intervención y su stream, sin historial visible.

**Ver captura** abre la imagen exacta preparada para SOL, con hora y título de la ventana detrás de ZEN. Ese título es metadata: la imagen incluye el monitor completo. La vista previa amplía temporalmente el panel. El indicador de la cabecera renueva la referencia.

Abrir/invocar la cápsula, iniciar voz, reactivar el micrófono o pulsar para hablar renueva la captura. Las peticiones escritas sin imagen elegida también la renuevan. No hay captura continua entre frases: si cambia la página, actualiza y espera «Captura preparada» o «Captura enviada a SOL». Una referencia nueva no reinicia una tarea ya iniciada. Con el micrófono apagado puede permanecer una respuesta anterior; preparar una captura no genera respuesta por sí mismo.

## Implementación

- HWND real de la cápsula y geometría nativa física determinan el monitor, incluso con la cápsula oculta. Se revalidan monitor, ventana detrás y exclusiones; si cambian durante la operación se descarta la imagen.
- Copia de píxeles visibles mediante CopyFromScreen, sin fallback a PrintWindow para la captura automática. La captura opcional de una ventana elegida conserva la ruta anterior. [Documentación oficial](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.graphics.copyfromscreen).
- Se excluye temporalmente la propia cápsula mediante protección de contenido y se espera la composición de Windows, sin ocultarla ni cambiar su foco/opacidad. Las capturas concurrentes mantienen la exclusión hasta terminar la última. [Comportamiento y límites de Electron](https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable).
- Se enmascaran en negro las regiones visibles de otras ventanas de ZEN y ventanas excluidas. Si la ventana detrás está excluida, se rechaza la captura. Las exclusiones por título no detectan todos los secretos dentro de una página; el resto del monitor visible forma parte de la referencia.
- El guard del escritorio ahora solicita solo lectura de objetos y verifica el escritorio interactivo Default del hilo. No cambia de escritorio ni eleva permisos. [OpenInputDesktop](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-openinputdesktop).
- Timeout de cinco segundos, JPEG hasta 1920 píxeles por lado y límite de 3 MB. Una referencia en RAM de main durante dos minutos, sin imagen en logs, perfil o archivos de producción. Solo «Ver captura» entrega explícitamente los píxeles al renderer.
- Pegado PNG/JPEG/WebP: reducción y miniatura locales, IPC estricto del frame local, observación de un uso con TTL de dos minutos. Preparar o pegar no sube la imagen. SVG/datos inválidos rechazados. Ocultar/Detener impide que una preparación pendiente lance una nueva tarea.
- Texto usa la autoridad compartida. Una imagen/documento no concede permisos. La imagen automática llega a SOL después de session.started y Live recibe aviso para consultar la nueva referencia. «Enviada» acredita transporte escrito, sin acuse independiente de interpretación.
- Se reinicia el reloj visual al conectar una sesión Live nueva: antes, el tiempo acumulado podía ocultar captions nuevos. Resultados antiguos quedan suprimidos hasta una nueva petición; las captions de voz no sustituyen una petición escrita. Reactivar voz espera una transcripción humana nueva antes de presentar captions pendientes. Se conserva la presentación estable de voz de 900 ms.

## Probado

- **232 pruebas en 25 archivos**, compilación de aplicación y auxiliar Windows.
- [Windows real con ventanas sintéticas propias](evidence/screen-display-windows.json): monitor de ZEN, dos pantallas y cambio de monitor, página nueva, cápsula excluida y una región sensible visible enmascarada. Se compara con una captura sintética donde la región sí era visible. Un [intento inicial](evidence/screen-display-attempt.json) falló porque el contador incluía colores del fondo; se corrigió la comparación de la prueba, sin cambiar el enmascarado.
- [Selección nativa anterior repetida](evidence/screen-target-windows.json): pasó también la cápsula oculta. Esa prueba conserva la ruta de ventana; la evidencia de píxeles de monitor es la anterior.
- [API real mediante IPC Electron](evidence/image-chat-live.json): petición escrita con adjunto sintético; el agente leyó **739162**, presente solo en la imagen. La interfaz simulada verifica el identificador de observación elegido y la ruta compartida lo prioriza sobre la captura automática.
- [API real + WebRTC](evidence/screen-replacement-live.json): misma sesión Live/SOL, primero **222222** y después **384729** desde capturas de monitor sintéticas; transcripciones, audio remoto y session.closed confirmados. Audio sintético, sin micrófono físico. Estimación Live/SOL registrada: 0,0623435 USD; TTS del fixture aparte.
- [Interfaz Edge](evidence/image-chat-ui.json): miniatura local, ningún adjunto antes de enviar, Enter/Shift+Enter, observación exacta enviada, captions anteriores suprimidos y vista previa exacta. Mensajes, fuentes, preferencias, proyectos y controles conservados.
- [Ejecutable empaquetado](evidence/portable-interface.json): arranque real, campo de escritura, IPC de imagen válido/inválido, aislamiento, anclaje y funciones anteriores. Alcance de interfaz; no acredita objetivo completo.

Solo se usaron ventanas e imágenes sintéticas propias. No se subieron LinkedIn ni capturas personales en las pruebas.

## Pendiente

Validación manual con tus páginas, micrófono y altavoces. Pantallas protegidas, cambios de DPI y escritorios bloqueados no están acreditados por este recorrido. Una instantánea no describe cambios posteriores. Los píxeles enviados tienen el tratamiento de datos del proyecto API; no se cambia la retención remota en el JSON exacto.

La lectura explícita «sin API» conserva el resultado local, pero una página visible puede aparecer en una captura automática autorizada por separado. No se suben carpetas completas. El [objetivo general](objective-verification.md) sigue pendiente por pruebas físicas y fallos de foco registrados.
