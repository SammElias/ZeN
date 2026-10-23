# Animación de pensamiento — 09/10/2026

La presentación local `thinking` muestra tres puntos violeta animados dentro de una pequeña burbuja. La cabeza oscila suavemente en cápsula/cabecera, escenario del chat y mascota flotante, conservando el seguimiento del cursor y las texturas originales. La amplitud del cuerpo completo es menor para preservar la unión con la ropa. En Inicio se animan solo los puntos: las manos siguen apoyadas sobre el título.

La animación depende del estado observado, no del texto del modelo ni de una estimación de avance. Cola y pensamiento la activan; fin, cancelación, error, pausa, ejecución y espera de aprobación la desactivan. Se conserva la prioridad visual de escucha/reproducción y la separación entre conversaciones. No añade llamadas API, imágenes generadas, temporizadores de tarea ni inferencias de permiso.

Con movimiento reducido los puntos permanecen estáticos. La animación se suspende al ocultar el documento o la ventana y desaparece al desmontar el personaje. La burbuja no recibe clics ni ocupa espacio en el layout; cápsula de 637×60 y panel a media pantalla conservados.

El avatar fijo también observa el tamaño de los contenedores de su hueco. Así sigue la posición real cuando aparecen barras de actividad o avisos, aunque el tamaño de la figura no cambie; se evita que los puntos se superpongan a los controles. Este seguimiento usa ResizeObserver, sin sondeo por fotograma.

## Verificación

- Build de producción correcto; 363 pruebas unitarias en 41 archivos.
- Recorrido de renderer Edge con eventos identificados como simulados: cápsula, Chat e Inicio; tres puntos activos, cabeza según superficie, movimiento reducido estático y salida por pausa/finalización/cancelación/error/ejecución/permisos. También conserva mirada, borradores, navegación y el avatar único. Evidencia en `evidence/mascot-ui.json`, apartado `thinkingViews`.
- Recorrido Electron/Windows con perfil aislado: animación activa y retirada al completar, sin cambiar límites de ventana. Captura `ui-preview/mascot-native/thinking.png`; resultado en `evidence/mascot-native.json`.
- Sin generación del modelo ni prueba física de voz. Los eventos de estado de estas pruebas son sintéticos, no una respuesta API real.

Entrega del único `Desktop/ZEN.exe`, hash y respaldo: `evidence/thinking-animation-deployment.json`.
