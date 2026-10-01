# Contexto visual al invocar ZEN · 01/10/2026

Incluido en el portable actual `release/ZEN-20261001095454813/ZEN.exe`. Conserva config/live-session.json exactamente y el agente guardado con sus herramientas e instrucciones.

## Corrección actual: ventana detrás de la cápsula y estado de voz

La captura automática elige la ventana externa situada debajo del centro horizontal de ZEN, usando rectángulos nativos de Windows en píxeles físicos. Ya no sigue el foco de otro monitor ni el primer elemento externo de una lista global. Descarta ventanas minimizadas u ocultas por otro escritorio y conserva exclusiones; no cambia a otra aplicación si el objetivo está excluido. El auxiliar devuelve la geometría de la propia cápsula aunque esté oculta, sin habilitar la captura de otras ventanas ocultas. Si cambia la ventana situada detrás durante la operación, se descarta la imagen; expandir el panel sobre la misma ventana conserva la captura.

Abrir la cápsula con su cabecera/flecha, empezar una sesión de voz, activar de nuevo el micrófono o pulsar para hablar renueva la referencia. Al activar el micrófono, espera a terminar la preparación antes de transmitir audio. El pequeño indicador visual es un botón para actualizar; el panel muestra el título exacto de la ventana de referencia. Una sesión continua no observa cambios automáticamente entre frases: usa el indicador o vuelve a invocar ZEN cuando cambie la página.

La nueva imagen y su identificador/fecha/título se adjuntan a SOL y Live recibe aviso para consultar esa referencia, sin reutilizar una descripción anterior. «Enviado» sigue significando transporte escrito, sin acuse separado de interpretación. La nueva referencia no reinicia una tarea ya en curso.

El indicador de respuesta usa dos umbrales de volumen y mantiene «Respondiendo» durante pausas menores de 900 ms. Solo emite cambios de actividad; silenciar o desconectar lo limpia. La actividad de voz tiene prioridad visual sobre «Listo» y se eliminan las animaciones repetidas de ojos y destellos durante la voz. Esto solo regula la presentación, sin inferir turnos ni autorizar tareas por silencio.

**Probado:** 228 pruebas en 24 archivos; compilación de aplicación y auxiliar; [interfaz Edge](evidence/screen-target-ui.json); [portable real](evidence/portable-interface.json). [API real/WebRTC](evidence/screen-replacement-live.json): la misma sesión leyó primero 222222 en una imagen y después 384729 en la nueva, con voz sintética y cierre confirmado. [Windows real con ventanas propias](evidence/screen-target-windows.json): selección bajo la cápsula sobre dos monitores, movimiento y cambio de contenido. En ese recorrido no se registró prueba independiente del foco de la ventana de documentación; la prioridad ante foco de otro monitor se comprueba en las pruebas unitarias. Una repetición posterior del recorrido nativo, ampliado para cápsula oculta, [quedó bloqueada al acceder al escritorio interactivo](evidence/screen-target-attempt.json); esa ampliación no se acredita como prueba física pasada. Pendiente el recorrido con tus aplicaciones y micrófono reales. No se capturaron ni subieron aplicaciones personales en las pruebas.

Los apartados siguientes conservan la implementación y pruebas de la primera versión; la selección y actualización actuales son las descritas arriba.

## Uso

Abre la ventana que quieras consultar y pulsa Ctrl+Alt+Z, o llama a ZEN desde la bandeja. La captura se prepara antes de que ZEN reciba el foco. Iniciar la voz desde la cápsula prepara contexto si todavía no hay una referencia vigente. Di, por ejemplo: «Consulta con SOL lo que aparece en mi ventana y ayúdame con esto». La cápsula indica captura preparada, enviada, no disponible o caducada; ese estado no sustituye tu mensaje ni el de ZEN.

Se toma **una imagen por invocación**, de la ventana en primer plano. Si un clic ya dio foco a ZEN, usa la primera ventana externa visible en el orden de ventanas de Windows. No captura todas las pantallas ni graba vídeo. Para actualizar después de cambiar de aplicación, vuelve a invocar ZEN. En una sesión de voz nueva, el envío a SOL ocurre antes de activar el micrófono. Renovar contexto durante una sesión existente no reinicia una tarea ya en curso.

## Implementado

- Auxiliar Windows existente, sin recompilar .exe. Captura nativa de ventana; JPEG reducido a un máximo de 1280 píxeles por lado, límite de 3 MB. Comprueba identificador, proceso y título después de capturar para descartar ventanas cerradas o sustituidas.
- Exclusiones anteriores por título y preferencias, además de ventanas del propio proceso ZEN. No se elige otra aplicación para sustituir un primer plano excluido. Las exclusiones no detectan ni censuran todos los secretos visibles: la referencia incluye lo que esa ventana muestra, sin ocultación automática de campos de imagen.
- Captura cancelable con límite de cinco segundos. Una nueva invocación invalida la anterior; resultados tardíos no se adjuntan. Detener/Ocultar cancela capturas pendientes y retira la referencia local. Ocultar conserva investigación iniciada anteriormente.
- Una referencia en RAM de main durante dos minutos; no archivo, historial local, memoria de perfil, índice de archivos ni log con imagen. Renderer recibe únicamente estado/fecha. La prueba nativa guarda exclusivamente su fixture sintético bajo test-results para probar después visión, nunca una ventana personal.
- GPT-Live no acepta imágenes directamente. Main envía `response.item.create` al backend Responses gpt-6.1-sol después de session.started, con la imagen y su fecha como datos. Solo se envía una vez por referencia/sesión. Contexto textual breve informa a Live de su disponibilidad. La delegación normal analiza la imagen cuando la conversación lo requiere; adjuntarla no lanza una tarea independiente ni modifica la configuración de inicio.
- La API no proporciona acuse separado para response.item.create: «enviado» significa transporte escrito, no interpretación confirmada. Errores posteriores se siguen procesando. La prueba real de visión sí verifica lectura por SOL y resultado hablado.
- Las peticiones revisadas al agente guardado también adjuntan la referencia vigente, salvo un contexto elegido explícitamente, que tiene prioridad. La imagen no añade permisos de herramientas ni autoriza efectos. Texto de pantalla no se transforma en instrucciones del usuario; las operaciones locales siguen usando su petición original y la política existente.
- Cuando caduca o se retira, Live recibe aviso de que la referencia anterior no describe la pantalla actual. Caducar localmente no elimina contenido ya enviado ni sus resultados de la conversación remota. Las imágenes enviadas tienen el tratamiento de datos y consumo de la API del proyecto; no se cambian valores de retención del servidor en el JSON exacto.

La lectura «Lee localmente … sin API» sigue sin enviar **el resultado del archivo** al modelo/TTS. La captura automática es una autorización distinta: si el documento estaba visible al invocar ZEN, sus píxeles pueden formar parte de la referencia visual enviada a SOL. No se suben carpetas completas.

## Probado

- 207 pruebas unitarias en 22 archivos y build: captura por invocación, sin actividad al construir el servicio, referencias nuevas, exclusiones, ventanas sustituidas, cancelación, llamadas simultáneas, caducidad, timeout, metadata sin imagen, envío posterior a session.started y de un uso, sin ejecución de efectos ni cambios del JSON.
- [Windows real](evidence/screen-context-windows.json): captura de ventana sintética 760×460 con el auxiliar existente. No creó nuevo ejecutable ni capturó aplicaciones personales.
- [API real + WebRTC](evidence/screen-context-live.json): esa captura enviada a SOL; leyó correctamente el código **384729** del recuadro azul, que no estaba en la petición hablada. Audio sintético, transcripción literal, resultado hablado y audio remoto observados; cierre confirmado. Sin micrófono físico ni acciones Windows desde el modelo. Estimación registrada Live/SOL: 0,019 USD; el fixture TTS se factura aparte.
- [Interfaz Edge](evidence/screen-context-ui.json): aviso de disponibilidad/caducidad sin sustituir el último mensaje, indicador en cápsula compacta; conserva revisión, fuentes y preferencias. [Electron](evidence/screen-context-electron.json): aislamiento, claves en main, IPC validado, biblioteca local y anclaje. El smoke general no captura ventanas personales: usa lista vacía; la captura real se prueba por separado con ventana propia.

## Pendiente y límites

Probar manualmente el atajo/voz con tus aplicaciones, varios monitores y dispositivos físicos. PrintWindow puede devolver una captura negra o incompleta en aplicaciones con vídeo protegido/GPU; no se acredita soporte universal. El backend interpreta una instantánea, no sabe automáticamente qué cambió después. Hablar mientras una renovación sigue en curso puede iniciar delegación con el contexto anterior; espera el indicador de disponibilidad para preguntar sobre la nueva captura.

El objetivo general de ZEN continúa incompleto por pendientes y fallos de foco documentados en objective-verification.md. El portable actual sí incorpora este cambio; conserva toda su carpeta.

Protocolo verificado con el SDK local y la [documentación oficial de imágenes en GPT-Live](https://developers.openai.com/api/docs/guides/live-delegation#add-images-and-visual-context).
