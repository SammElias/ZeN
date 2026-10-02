# Dimensiones actualizadas el 02/10/2026

La petición posterior de ampliar el robot sustituye las medidas de esta primera versión por **320×72 DIP** arriba y **72×320 DIP** en ambos laterales. Detalles y evidencia en [robot-interface.md](robot-interface.md); los contratos funcionales descritos abajo permanecen vigentes.

# Mini cápsula con despliegue conservado · 01/10/2026

El usuario pidió reducir la interfaz recogida a icono, estados y micrófono, y confirmó que debe mantenerse el despliegue.

## Implementado

- Cápsula recogida de **240×40 DIP**, frente a los 640×48 anteriores. Icono del compañero, estado breve con punto, micrófono, flecha y cierre; Detener sustituye al cierre mientras hay trabajo. Nombre ZEN, ficha de captura y acceso a Codex se presentan al desplegar.
- Icono y cabecera conservan arrastre horizontal y cambio de monitor, siempre arriba. La posición guardada usa la misma proporción horizontal; no se migra ni borra configuración.
- Icono o flecha abren el panel existente de 1120 DIP de ancho: último mensaje/stream, escritura, pegado de capturas, carpeta de análisis y controles de voz/reunión. Recoger conserva trabajo, voz y conversación. Ctrl+Alt+Z y bandeja siguen disponibles.
- Los fragmentos hablados no abren automáticamente el panel recogido. Las aprobaciones concretas conservan su revisión visible. No se cambian consentimiento, captura automática, cierre Live, modelos, JSON ni herramientas.
- Tamaño compacto coherente entre geometría Windows, renderer e IPC; controles con etiquetas y tooltips accesibles, sin área transparente antigua de 640 DIP.

## Verificación

238 pruebas en 27 archivos y build aprobados. Las pruebas de geometría comprueban tamaño, borde superior, pantallas con coordenadas negativas, límites al expandir y restauración de posición. La cápsula estrecha puede estar más cerca del borde; al desplegar, el panel ancho se limita al monitor, y al recoger vuelve a la ubicación de la cápsula.

[Interfaz Edge](evidence/mini-capsule-ui.json): 240×40, nombre oculto, controles dentro de cabecera, desplegar/recoger, chat/adjuntos, Codex, streaming estable y reunión. [Electron/Windows empaquetado](evidence/mini-capsule-electron.json): tamaño nativo 240×40, caption sintético sin desplegar, controles sin recortes, panel 1120, arrastre a dos monitores con cursor sintético y posición conservada. Se mantienen aislamiento, IPC, captura manual y lectura local.

Nuevo [portable verificado](evidence/portable-interface.json): `release/ZEN-20261001155525543/ZEN.exe`. Sal de la versión anterior desde la bandeja y abre esta, conservando la carpeta completa. Los modelos y ambos JSON de configuración no tienen cambios. Sin nuevas llamadas API ni capturas personales enviadas.

Las expectativas anteriores de texto ZEN visible y de centrado sin clamping en cualquier posición se ajustaron al tamaño nuevo; la prueba del puntero espera su actualización real. La comprobación física con ratón, micrófono y cambios de DPI del usuario sigue pendiente; el objetivo completo continúa incompleto.
