# Seguimiento visible del cursor — 09/10/2026

El personaje sigue el cursor global del escritorio en cápsula superior o lateral, escenario del chat, mascota flotante e Inicio. Se elimina la restricción de 240 DIP de la mascota flotante. El seguimiento no depende del foco, de estar sobre ZEN o del estado de la tarea. Usa la cara como centro, una respuesta suave y acotada y un movimiento más visible: cabeza hasta 10° en cápsula, 5° en figura completa más un acompañamiento de 1° del cuerpo, y 4° en bienvenida. También hay desplazamiento vertical y horizontal.

Se mantienen los PNG originales, los vestuarios y los gestos de pensamiento/voz. La unión de cabeza y torso usa un solape de textura con degradado local; no se inventan ojos independientes ni un modelo 3D. En Inicio el cuerpo responde detrás del título y las manos quedan fijadas delante. Los cambios de geometría actualizan la orientación sin esperar otro movimiento del ratón.

Una suscripción compartida en el renderer usa el cursor de Windows, con un máximo de 20 lecturas por segundo y eventos IPC solo al cambiar. El modo de demostración usa movimientos sintéticos. Ocultar, minimizar, desactivar animaciones o movimiento reducido suspende el seguimiento. No hay capturas nuevas, modelo, red ni API decorativa.

## Verificación

`mascot-ui.mjs` comprueba izquierda/derecha con coordenadas fuera de la ventana, amplitud visible y movimiento reducido en cápsula, Chat e Inicio, además de estados, vestuarios y continuidad existentes. Evidencia en `evidence/mascot-ui.json`, `gazeViews`; capturas `ui-preview/mascot/gaze-*.png`. `welcome-ui.mjs` verifica las capas de profundidad y tamaños 320–960 DIP. El recorrido Electron lee el cursor real vía IPC y confirma que orienta cabeza y cuerpo (`evidence/mascot-native.json`, `desktopCursor`). Las pruebas unitarias verifican dirección, saturación, coordenadas negativas/zoom y suspensión del muestreo.

No se acredita una prueba física exhaustiva de gestos, DPI o voz. El archivo entregado y su hash constan en `evidence/mascot-cursor-deployment.json`.
