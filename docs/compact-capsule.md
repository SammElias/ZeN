# Personaje solo en la cápsula — 16/10/2026

Petición posterior al rediseño de ventanas: retirar el personaje de las demás superficies y ganar espacio, siguiendo las referencias locales de Coucou.

- Inicio no reserva un escenario ni altura para la figura. Chat utiliza todo el ancho disponible; se retira la columna del personaje. Apariencia conserva el selector en una ventana de 400×280 DIP, sin otra figura, tonos de prueba ni caminatas que no aplican a la cápsula.
- La cápsula es la única presentación del personaje. La preferencia histórica de mascota flotante se conserva en disco, pero el nuevo shell la ignora y Preferencias no ofrece esa alternativa. No se alteran conversaciones, borradores ni configuración de agente/Live.
- Cápsula de 637×60 DIP: personaje/Inicio, estado con detalle breve, Chat, Captura de región, Adjuntar, Contexto, micrófono, Detener, Preferencias y Ocultar. Detener conserva su posición y se desactiva cuando no corresponde. Contexto tiene un punto cuando hay una referencia preparada; adjuntar o soltar no envía una petición.
- Colores diferenciados para trabajo, permiso, error, voz, pausa y traspaso externo a Codex. Solo los estados observados de cola/pensamiento/ejecución animan las barras; pausa, permiso y Codex externo no aparentan ejecución. Pulsar el permiso abre su revisión, sin autorizar nada. Una aclaración pendiente abre Chat y se distingue del traspaso externo a Codex.
- Se mantienen mirada y pensamiento en la cápsula. Se retira la lectura periódica del cursor para la ventana de trabajo sin personaje. Movimiento reducido y documento oculto suspenden las animaciones.
- Se revisaron `docs/media/chat.png` y `docs/media/hub-dictation.png` de Coucou: controles discretos, fondo grafito y jerarquía compacta. Imágenes y sonidos de ZEN conservados; no se incorporan recursos de Mochi.

## Validación

Build de producción y **389 pruebas en 43 archivos** pasan. El recorrido Electron/SQLite/IPC verifica la ausencia del personaje fuera de la cápsula, todo el ancho de Chat, controles visibles sin solapamiento en ocho estados, revisión de permiso, pensamiento, Detener, continuidad, imágenes, ventanas separadas y tamaños de 380/640/960 DIP. Entradas DOM simuladas, sin llamadas a modelos: `docs/evidence/desktop-shell-native.json`.

La limitación física documentada en `docs/desktop-shell.md` sigue pendiente: no se acredita visibilidad superior sobre otras aplicaciones, arrastre/DPI ni voz real. Las capturas internas verifican el diseño, no esas interacciones.

Entregado el 16/10/2026 en el único `Desktop/ZEN.exe`, después de que el usuario cerrase la instancia que bloqueaba el archivo. Copia verificada por SHA256 frente al EXE que pasó extracción y arranque; paquetes y respaldos dentro de `release`. Hash y estado de sustitución en `docs/evidence/desktop-shell-deployment.json`.
