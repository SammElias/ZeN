# Pegado de capturas corregido · 01/10/2026

La captura del usuario mostraba «The source image cannot be decoded.». Se reprodujo exactamente dentro de Electron: la preparación de una imagen usaba una URL `blob:`, bloqueada por la política de imágenes de producción (`img-src 'self' data:`). La vista previa web no tenía esa restricción y sus pruebas anteriores no detectaban el problema.

## Implementado

La imagen se lee mediante FileReader como URL `data:` antes de decodificarla y redimensionarla. La política de producción, el aislamiento del renderer, los límites de tamaño y los formatos PNG/JPEG/WebP se conservan. Una imagen dañada muestra un mensaje en español y mantiene cualquier captura válida adjunta anteriormente. Al añadir una imagen válida se limpia el aviso anterior.

La vista previa ahora aplica la misma restricción de imágenes, para detectar esta clase de regresión. Conserva un único clip y el menú compacto de tres opciones; los modelos, integraciones y JSON de configuración no se han cambiado.

## Probado

- [Reproducción Electron](evidence/image-decoding-policy.json): una imagen sintética reproduce el error exacto con `blob:` y decodifica correctamente con `data:` bajo la política de producción.
- [Renderer real Electron](evidence/image-decoding-electron.json): evento de pegado con PNG válido, miniatura decodificada, archivo dañado rechazado en español, captura válida anterior conservada y ninguna infracción de CSP. Clip único comprobado.
- [Interfaz Edge](evidence/image-decoding-ui.json): menú, pegado, prioridad de captura, carpeta adjunta, transcripciones y controles conservados; sin errores de página.
- 235 pruebas en 26 archivos y compilación aprobadas. [Portable verificado](evidence/portable-interface.json): `release/ZEN-20261001145815191/ZEN.exe`, con comprobación del pegado y aislamiento dentro del paquete.

Son pruebas locales con imágenes sintéticas; no se hizo una nueva llamada a la API ni se envió la captura personal del usuario para verificarlas. Puede repetirse la reproducción con `node scripts/image-decoding-smoke.mjs` y la prueba del renderer con `node scripts/electron-smoke.mjs`, después de compilar.

## Pendiente

Pegado físico desde el portapapeles del usuario y recorrido con sus aplicaciones. La captura automática y el transporte a la API conservan las evidencias anteriores; esta revisión corrige la preparación local de imágenes manuales. Pruebas físicas de voz, Teams, DPI y fallos generales de foco siguen pendientes. El [objetivo completo](objective-verification.md) todavía no está terminado.

Para probar esta revisión, salir de ZEN anterior desde la bandeja y abrir el nuevo ejecutable, conservando toda su carpeta. Pegar una captura con Ctrl+V: debe aparecer su miniatura antes de enviarla.
