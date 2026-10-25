# Una cápsula, recogida o desplegada — 24/10/2026

El usuario solicita que las integraciones salgan hacia abajo desde la propia cápsula, sin ventanas de trabajo nuevas ni despliegue lateral, y que Avisos tenga un icono. También pide eliminar el parpadeo de la extensión. Esta entrega sustituye la restauración de rectángulos independientes y las ventanas de Avisos de las versiones anteriores.

## Dos estados de la misma superficie

Solo se construye un BrowserWindow de ZEN. Recogido mide 637×60 DIP cuando el monitor lo permite; desplegado conserva el ancho, la cabecera y el anclaje y añade contenido hacia abajo, hasta 680 DIP de altura total. Aprovecha el espacio inferior disponible. Solo se desplaza hacia arriba si un anclaje lateral próximo al borde inferior impide un contenido legible; al recoger recupera el anclaje original. No hay redimensionado libre, maximización ni una posición separada por integración.

Home, Spotify, Gmail, Codex y Avisos están siempre en la cabecera. La campana muestra avisos sin leer y abre su contenido bajo esa misma cabecera. Preferencias, revisión de permisos, Más opciones y acciones de clic derecho también son contenido interno. Los enlaces explícitos a Codex, servicios web e inicio de sesión Google siguen usando sus aplicaciones correspondientes; las notificaciones del sistema conservan la configuración existente. No se crean ventanas auxiliares de ZEN ni menús popup para las integraciones.

La navegación no cambia la geometría ni sustituye la cabecera. Escape y el núcleo recogen; los iconos seleccionan el contenido y despliegan. Los modos compactos de música/estado son contenido de la cápsula recogida, sin un tercer tamaño. Se conservan reproductor, Gmail de lectura, orden personalizable, última integración, actividad del chat fijado, permisos, presentación y sonidos. Los cuatro iconos de una preferencia anterior migran manteniendo su orden y añadiendo Avisos al final; las configuraciones de ventanas anteriores se conservan como histórico inactivo.

## Estabilidad de presentación

Se elimina la animación de recorte lateral y se mantiene la misma estructura DOM de cabecera en ambos estados. Main compara el rectángulo antes de llamar a setBounds. La forma nativa se calcula solo cuando cambian dimensiones y agrupa las líneas iguales: el área de entrada es idéntica, con menos de 40 rectángulos en lugar de cientos. Se conserva topmost durante navegación y solo se cambia cuando es necesario ocultar/restaurar; no se alterna la presencia en la barra de tareas al desplegar. Las señales de actividad no cambian tamaño, región, orden ni foco.

## Validación

Build y 516 pruebas en 58 archivos pasan. Las nuevas pruebas comprueban anclajes, extensión hacia abajo, monitores pequeños/negativos, falta de espacio inferior, equivalencia exacta de la región nativa y migración de preferencias.

El recorrido Electron real con perfil, correo, música y hooks aislados comprueba cinco iconos, Avisos/menús/permisos en la cápsula, un único BrowserWindow, apertura/recogida sin perder el anclaje, cabecera DOM conservada y ausencia de llamadas de geometría/región/topmost al cambiar de página. Las señales también se verifican sin mutaciones de la ventana nativa. Se mantienen las pruebas de selección/controles de música compacta, Gmail, redacción y permisos de un uso.

La captura de la propia ventana permite revisar el aspecto renderizado; no acredita ausencia absoluta de parpadeo físico en todos los controladores GPU, monitores o DPI. No se acredita reproducción física, correo real ni notificaciones recibidas. El límite anterior de Computer Use continúa vigente. Sin cambios de hooks/confianza, sin detener Codex ni llamadas al modelo.

Entrega única en Desktop/ZEN.exe con respaldo dentro de release, comprobación de extracción/arranque y copia de hash idéntico. Evidencia local: docs/evidence/capsule-downward-deployment.json.

Entrega terminada: SHA256 19513d8740e5558412fb260e4d6e8aabe428c928838a55168de16c91566a710f. La copia del escritorio y el main ejecutado coinciden con el paquete probado; observador único confirmado y archivos de cuenta conservados. El despliegue ignora únicamente registros de procesos ya terminados al comprobar bloqueos; mantiene la negativa a reemplazar si hay una instancia viva de identidad desconocida. No se hizo commit/push.
