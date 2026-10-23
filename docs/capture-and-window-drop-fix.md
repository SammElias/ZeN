# Captura y arrastre de ventanas — 16/10/2026

Petición: la aplicación aparece negra al capturar y pierde el foco al arrastrar una ventana hacia ZEN.

## Cambios

- La exclusión temporal abarca cápsula, Chat y paneles propios, también los creados durante una captura. Se conserva y restaura la protección anterior con préstamos concurrentes; no se ocultan ni activan ventanas para capturar. La máscara negra ya no incluye ventanas del proceso de ZEN. Un título externo que contenga «ZEN» no se considera por sí solo una ventana propia; la identidad se comprueba por PID. Se conservan las exclusiones configuradas y de credenciales.
- Pantalla usa una instantánea WGC del monitor actual con las máscaras externas existentes. El arrastre usa una instantánea WGC del HWND elegido, en vez de `PrintWindow`, que puede devolver éxito sin una imagen útil en ventanas GPU. El único fotograma se copia y la sesión se cierra; espera máxima de fotograma de tres segundos, auxiliar acotado, sin grabación ni foco nuevo. No se suprimen los indicadores de captura de Windows. Ventanas protegidas, vacías, minimizadas, cambiadas o fuera de los límites admitidos no generan un adjunto utilizable. No se eluden protecciones del sistema.
- El observador reconoce tanto cápsula como Chat. Durante un movimiento externo la cápsula deja pasar el ratón; no se abre Chat, no se cambia el orden de ventanas desde la atenuación y `focusOverlay` no activa ZEN. El modo pasivo usa `showInactive`. Los errores del gesto aparecen sin abrir ni enfocar la ventana.
- La cápsula indica «Suelta la ventana» y «Capturando ventana». Se comprueba que se soltó el botón; Escape, desaparición del origen o expiración cancelan la recepción. Se comprueba PID/título antes y después de capturar. Al terminar se prepara una referencia local revisable; no se envía al modelo por soltarla.
- Sin cambios de agente, modelo, Live, conversaciones, credenciales o presupuesto.

## Evidencia y límites

- Build nativo y de producción, **391 pruebas en 44 archivos**. Pruebas nuevas de exclusión de todas las superficies, panel creado durante captura, destinos cápsula/Chat y limpieza del estado de arrastre.
- `node scripts/capture-fix-smoke.mjs`: captura nativa real de una ventana Electron con contenido GPU conocido, verificación RGB `[45,103,137]`, foco conservado y protecciones restauradas. El bloqueo de apertura/foco durante arrastre se comprueba por IPC con el estado de movimiento simulado. No es una prueba física del gesto. Evidencia en `docs/evidence/capture-fix-native.json` e imagen exclusivamente sintética en `docs/ui-preview/capture-fix/window.png`.
- La captura de monitor devuelve contenido. **No se pudo verificar el píxel controlado de la ventana de prueba en el monitor**: otra aplicación permaneció visible incluso cuando se notificaba el foco de la ventana de prueba. Se registra `monitorFixtureVerified:false`. No se conserva una imagen del escritorio del usuario. Quedan pendientes la composición real sobre otras aplicaciones, el arrastre físico completo hacia ambos destinos y varios monitores/DPI. No afirmar validación física completa.
- Recorrido Electron/SQLite/IPC del paquete pasa: cápsula, paneles independientes, historial/imágenes, permisos, Detener y ausencia de personaje fuera de la cápsula. Acciones DOM simuladas; cero llamadas API.
- Distribución: único `Desktop/ZEN.exe`; paquetes y respaldos en `release`. Sustituido y verificado el 16/10/2026 a las 18:29 (Madrid), tras pasar extracción y arranque del EXE único. SHA256 `C6AB34BE24DF9EBC9B0DB718BDFB76F27119DEB08DB9DD02A59FA3752771CEF8`. Estado de entrega en `docs/evidence/capture-window-deployment.json`.

## Referencias técnicas

Se usan las interfaces públicas de Windows: [captura de un HWND](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow), [pool sin dispatcher](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded) y [exclusión de captura](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity).
