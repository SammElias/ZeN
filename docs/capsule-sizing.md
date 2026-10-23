# Cápsula ampliada y panel de media pantalla

Petición del 09/10/2026: aumentar ancho y alto de la cápsula un 30 % y ampliar el panel desplegado a media pantalla.

La cápsula pasa de 490×46 a 637×60 DIP (altura redondeada). La cabeza, navegación, estado y controles aumentan proporcionalmente; por debajo de 421 DIP se conservan controles compactos para que sigan cabiendo. Mantiene su orientación horizontal en los tres bordes y la región nativa redondeada coincide con la superficie visible.

Al expandir desde cápsula, mascota o tarjeta rápida, Inicio/Chat ocupan el 50 % del ancho y el 100 % de la altura del área útil del monitor donde está ZEN. La barra de tareas queda fuera. En pantallas estrechas se prioriza un ancho legible de 320 DIP, siempre limitado al área disponible. El panel crece hacia el interior desde su borde; la cápsula vuelve a su anclaje al recoger.

Se puede redimensionar manualmente el panel abierto; navegar y entrar/salir de pantalla completa conservan ese tamaño. Tras recoger, el siguiente despliegue recupera media pantalla. La tarjeta rápida sigue a 380 DIP y F11 sigue ocupando el monitor completo. Borradores, conversación, adjuntos y captura no se reinician por el cambio de tamaño. No hay nuevas llamadas a modelos ni capturas en la operación de layout.

## Verificación

- `npm run build`: correcto.
- `npm test -- --maxWorkers=2`: 363 pruebas, 41 archivos. Incluyen posiciones negativas, tres bordes, monitores pequeños, escalas simuladas 100/125/150/200 %, dimensiones manuales y estabilidad ante cambios de contenido.
- `scripts/mascot-ui.mjs`: controles dentro de la cápsula a 637/480/360/320 DIP, personaje ampliado, mirada, arrastre simulado, estados, borradores y movimiento reducido.
- `scripts/welcome-ui.mjs`: Inicio a 960×1032 y otros cinco tamaños, ancho real del viewport, pose con profundidad y compositor accesible.
- `scripts/chat06-ui.mjs`: recorrido del chat e historial sin regresiones.
- `scripts/package-win.mjs --interactions`: Electron/Windows real, perfil aislado sin clave, IPC y eventos DOM simulados. Ambos monitores observados tienen área útil 1920×1032, escala 100 %; cápsula 637×60, panel 960×1032. Los tres bordes, regreso a cápsula y F11/Esc pasan. Evidencia: `evidence/head-capsule-native.json`, `evidence/fullscreen-merge-native.json` y `evidence/portable-interactions.json`.

No se acredita arrastre o redimensionado con ratón físico ni cambios físicos de DPI. Las pruebas no llaman a la API ni modifican el perfil personal. Agente guardado y JSON Live conservados. Entrega y hash del EXE: `evidence/capsule-sizing-deployment.json`.

## Entrega

El único `C:/Users/Gamming/Desktop/ZEN.exe` fue sustituido el 09/10/2026 a las 19:28 y abierto de nuevo. SHA-256: `61C8337FA49F14A2DD1E4192E1DBB2A83925A8ED83B7B6F685991CA7BE361513`. Arranque del EXE extraído y recorrido nativo de interacciones correctos; hash del escritorio idéntico al paquete probado. Respaldo dentro de `release/desktop-backups`, sin carpetas nuevas en la raíz del escritorio. Computer Use localizó la instancia personal, pero su captura protegida no permite acreditar visualmente el contenido de esa instancia; las capturas verificadas proceden del perfil de pruebas aislado.
