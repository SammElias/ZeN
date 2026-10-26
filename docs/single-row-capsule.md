# Cápsula en una sola fila

Petición del 25/10/2026: agrupar la cabecera en cuatro bloques independientes y reducir su altura, conservando la información y las funciones existentes. La cápsula pasa de **760 × 80 a 760 × 56 DIP**, un 30 % menos de altura. Desplegada mantiene exactamente la misma cabecera y ancho, con el contenido hacia abajo hasta el límite previo de 680 DIP.

Los cuatro bloques, de izquierda a derecha, son:

1. **Codex:** núcleo orbital con sus animaciones/traza, fase real y segunda línea de chat o acción. Pulsar el estado abre su actividad o revisión de permisos. El movimiento y la privacidad mantienen sus reglas anteriores.
2. **Navegación:** Home, Codex, Gmail y Spotify con sus iconos, nombres y contadores correspondientes. Ese es el orden inicial en perfiles nuevos; el orden personalizado existente se conserva. Arrastre, Alt + flechas y menú contextual siguen funcionando para las cuatro secciones visibles. El registro histórico de cinco entradas sigue válido, sin reescribir preferencias para mover Avisos al bloque de controles.
3. **Música:** título, artista/fuente y carátula de Windows cuando estén disponibles. Se conservan la observación automática y los controles del reproductor compacto elegido explícitamente. Un marcador sin reproducción u oculto por privacidad mantiene el espacio del bloque estable cuando no hay canción.
4. **Controles:** volver a la aplicación de trabajo, mostrar integraciones, más opciones, Avisos con contador y ocultar ZEN. El contador deja de duplicarse sobre Más opciones. La aplicación de retorno se identifica al pasar por la flecha, conservando el destino y la política de foco previos.

Avisos sigue siendo una sección interna y conserva el comportamiento de alternancia: pulsarlo recogido abre Avisos; repetirlo desplegado recoge; ir a otro icono navega sin cerrar. No se crean ventanas nuevas.

La fila usa cuatro columnas permanentes, con separadores y mínimos adaptados al ancho disponible. Las señales no montan otra cabecera ni cambian el tamaño nativo. En monitores estrechos se compactan iconos y texto, con puntos suspensivos y nombres/descripciones accesibles. Los detalles de estado y música completos siguen disponibles en el título al pasar el cursor o en su sección; no se promete texto completo simultáneo a 320 DIP. Se conserva la posición por monitor, los límites del área útil y la región redondeada agrupada.

## Validación

Build y las 602 pruebas de 60 archivos pasan. Las comprobaciones Electron verifican el tamaño nativo 760 × 56, cuatro bloques en una sola fila, navegación de cuatro iconos más la campana, cinco controles visibles, rectángulos sin solaparse y geometría estable al navegar o recibir actividad. Se aplican realmente anchos nativos de 320, 380 y 760 DIP en la prueba aislada, con redimensionado desactivado de nuevo después; producción sigue fija. Se conservan los recorridos de Home, Gmail/papelera, música, permisos y privacidad. Las pruebas antiguas que esperaban 80 DIP se actualizan a la nueva altura, sin presentar la cabecera anterior de dos filas como validación nueva.

El EXE extraído se comprueba antes de reemplazar el único `Desktop/ZEN.exe`, con respaldo dentro de `release/desktop-backups`, hash idéntico, bundle arrancado y observador único. La evidencia local se guarda en `docs/evidence/single-row-deployment.json`; las capturas de `docs/ui-preview/companion/capsule-single-row-live.png` y `capsule-music-narrow.png` contienen datos simulados, no mensajes/canciones reales del usuario.

La entrega no cambia cuentas, credenciales, chat fijado, históricos ni preferencias, no autoriza Google ni ejecuta correo/reproducción reales. Tampoco modifica hooks/confianza/relay, detiene Codex, llama a modelos o hace commit/push. Permanecen los límites físicos previos de foco, DPI, monitores y Computer Use.
