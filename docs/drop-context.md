# Contexto por arrastre · 02/10/2026

Arrastra contenido sobre la cápsula o el panel. Al soltar se abre el panel con una referencia local que puedes revisar o quitar. Escribe la petición y pulsa Enviar; también se integra en la petición de voz sellada explícitamente. Soltar no llama al modelo ni ejecuta instrucciones del contenido.

- Archivos: texto/código, PDF, DOCX, XLSX e imágenes PNG/JPEG/WebP. Máximo ocho adjuntos y una imagen o ventana por petición; los formatos no admitidos muestran un aviso.
- Los archivos se autorizan individualmente sin ampliar las raíces persistentes. Solo se leen al enviar, con extracción local y fragmentos pertinentes acotados. Se comprueba que no hayan cambiado y se conservan los filtros de secretos. Imágenes arrastradas por el navegador se preparan localmente al soltar.
- Texto y enlaces HTTP/HTTPS quedan como referencias, separados de la petición humana. Un enlace no se visita al soltar. El HTML se reduce a texto sin cargar recursos.
- Una carpeta debe arrastrarse sola. Conserva la ruta hacia Codex del escritorio y su compositor; requiere Enviar allí y no usa la API de ZEN para analizar la carpeta.
- Ventanas: mueve una ventana por su barra de título y suéltala sobre la cápsula. El observador nativo recibe eventos de movimiento de Windows y comprueba la posición del cursor durante ese gesto. Solo al soltar obtiene una instantánea de la ventana elegida, tras verificar identidad, proceso y exclusiones. No se añade un selector ni captura continua. Ventanas con movimientos personalizados pueden no generar esos eventos.
- La referencia visual caduca a los dos minutos; las autorizaciones de archivo/texto a los treinta. Detener revoca el contexto. Ocultar cancela la preparación en curso. Quitar un adjunto lo revoca y actualiza el contexto de voz. Un cambio invalida la confirmación visual anterior.

El contexto es información no confiable y no concede permisos. Se mantienen modelo, agente guardado, JSON Live, aprobaciones y aislamiento del renderer. Las animaciones y la preparación local no consumen tokens; interpretar con el modelo al enviar sigue teniendo su coste habitual. La captura explícita tiene prioridad sobre la automática.

## Evidencia y límites

- 300 pruebas unitarias en 35 archivos: extracción, redacción, revocación, cambios de archivo, cancelación, límites y caducidad.
- Edge con puente simulado: soltar texto/archivos/ventana no invoca al modelo, permite quitar/previsualizar y envía identificadores solo al solicitarlo. Carpetas conservan su ruta a Codex. Se incluye la regresión del parpadeo descrita en `stable-interface.md`.
- Electron real con renderer aislado: un `File` del sistema pasa por `webUtils.getPathForFile`; un `File` sintético no obtiene acceso al disco. Lectura explícita local y revocación comprobadas. La prueba del paquete exige `dropContextIpcVerified`.
- El auxiliar Windows compila. La prueba física mediante Computer Use no desplazó la ventana de referencia y no produjo un adjunto. **El gesto real de mover una ventana hacia la cápsula sigue pendiente de validación**; los eventos simulados de interfaz no lo acreditan. La cápsula tampoco pudo inspeccionarse visualmente de forma fiable en esa sesión, aunque la inspección DOM y las pruebas de bounds pasaron.
- Sin llamadas API para este cambio. No se acredita análisis real de los adjuntos por voz/modelo, DPI múltiple ni aplicaciones elevadas.

Fixture local reproducible: `scripts/drop-window-fixture.cjs` con Electron. No ejecuta acciones de entrada ni conecta a la red. Evidencias resumidas en `evidence/drop-context-ui.json`, `evidence/drop-context-electron.json` y `evidence/drop-context-native.json`.

Referencias de implementación: [Electron webUtils](https://www.electronjs.org/docs/latest/api/web-utils) y [SetWinEventHook de Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook).
