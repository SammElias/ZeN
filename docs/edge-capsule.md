# Bordes, barra de tareas y chat

Petición autorizada del 01/10/2026: mover ZEN por el borde superior y ambos laterales, orientar la cápsula como una línea vertical y poder recuperarla desde la barra de tareas con contexto nuevo. La petición posterior de ordenar el chat corrige la distribución demasiado ancha de la captura, el campo de texto y los controles.

Arrastrar la cabecera elige el borde más cercano, con una zona de estabilidad de 24 DIP en las esquinas. La cápsula mide 240×40 DIP arriba y 40×240 DIP en los laterales. Los botones permanecen derechos y el estado gira en vertical. El chat se despliega hacia el área útil con ancho máximo de 640 DIP; se ajusta a pantallas pequeñas. Monitor, borde y posición se guardan localmente; las posiciones anteriores se migran al borde superior.

Ocultar conserva el trabajo y minimiza ZEN, mostrando su entrada en la barra de tareas. Restaurar la ventana vuelve a la cápsula y retira la entrada. Cada restauración humana solicita una referencia visual nueva, con la geometría del monitor restaurada antes de capturar. La selección de la ventana detrás se adapta al borde izquierdo, derecho o superior. Capturas excluidas y la propia cápsula mantienen sus protecciones; las imágenes continúan solo en RAM y expiran a los dos minutos. No se inicia escucha ni captura continua por restaurar. Los resultados pasivos de reunión no se tratan como una nueva invocación humana.

La ficha de captura y «Actualizar» quedan juntas. Campo de texto y controles comparten márgenes de 16 DIP; los botones se redistribuyen en pantallas pequeñas. Se conserva la última intervención, su stream literal, adjuntos, voz y aprobaciones concretas.

## Verificación

- Build y 244 pruebas unitarias en 27 archivos: geometría, esquinas, monitores con coordenadas negativas, migración/persistencia y renovación del contexto en los laterales.
- [Interfaz Edge](evidence/edge-capsule-ui.json): rail vertical, botones dentro de la cabecera, despliegue/recogida, alineación de captura/compositor/controles, viewport pequeño y regresiones de conversación/voz/proyectos.
- [Electron en Windows](evidence/edge-capsule-electron.json): dimensiones nativas en los tres bordes, expansión dentro del monitor, persistencia y minimizar/restaurar. Dos restauraciones producen dos referencias distintas con capturas sintéticas; no se hicieron llamadas API.
- [Paquete portable](evidence/portable-interface.json): ejecutable real con pruebas de interfaz y aislamiento. Alcance de interfaz, sin acreditar el objetivo general.
- [Copia al escritorio](evidence/edge-capsule-desktop.json): `ZEN bordes/ZEN.exe`, acceso directo `ZEN.lnk` actualizado y 18 archivos verificados por SHA-256. La versión abierta y los paquetes anteriores se conservan.

Las restauraciones nativas automatizadas no sustituyen un clic físico en la barra de tareas. Arrastre físico, DPI y varios monitores físicos siguen pendientes de comprobar con el usuario. Los pendientes generales de voz/reunión se conservan en [objective-verification.md](objective-verification.md).
