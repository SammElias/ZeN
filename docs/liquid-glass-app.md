# Aplicación completa y cristal en ZEN

La petición del 3 de noviembre de 2026 sustituye la limitación anterior de cápsula con extensión fija. ZEN mantiene un único BrowserWindow y alterna entre dos modos:

- **Cápsula:** 820 × 68 DIP, frente a 760 × 56; núcleo orbital, estado y detalle de Codex, cinco integraciones, multimedia y controles. Conserva el anclaje a los bordes y el estado y la música simultáneos.
- **Aplicación:** ventana normal con navegación lateral y contenido que ocupa el espacio disponible, redimensionado por los bordes, arrastre por la cabecera, maximizar/restaurar y minimizar. Aparece en la barra de tareas y deja de estar siempre por encima de otras aplicaciones. El tamaño mínimo útil es 320 × 420 DIP; el tamaño inicial se adapta al área de trabajo, hasta 1280 × 900, y se puede maximizar.

Abrir una integración desde la cápsula pasa a la aplicación. Otra integración cambia de página sin modificar la ventana; repetir la activa, el núcleo o el control de integraciones vuelve a la cápsula. La bandeja ofrece Abrir ZEN, Mostrar cápsula y Salir. La X conserva el comportamiento de ocultar ZEN en segundo plano; Salir lo cierra.

## Distribución y apariencia

El diseño usa superficies de cristal, degradados y bordes iluminados, con la tipografía del sistema. Mantiene las funciones existentes, sin añadir proyectos, chat propio, ventanas por integración ni llamadas decorativas a modelos. Home muestra los estados observados; el correo usa una lista más compacta cuando hay espacio y Calendario coloca el mes y la agenda en dos columnas en la vista ancha. Codex conserva sus dos vistas internas Actividad/Resumen y los permisos dentro de Actividad.

En **Preferencias → Apariencia** se puede elegir:

- Tema oscuro o claro y acento violeta, ámbar o menta.
- Opacidad del cristal, de 28 % a 96 %, y desenfoque de 0 a 40 px. Se modifica la superficie, manteniendo legible el texto.
- Fondo Aurora, Atardecer o imagen local. Los controles permiten previsualizar y Guardar apariencia. Se respetan las preferencias de reducir movimiento y transparencia del sistema cuando están disponibles.

En Windows se solicita el material Acrylic de DWM y se conserva el degradado si no está disponible. La ventana es no transparente a nivel del constructor de Electron para permitir redimensionado nativo; el acabado translúcido se construye con el material de Windows y las superficies sobre el fondo de ZEN. No se simula una refracción física del escritorio ni se captura continuamente la pantalla. [Materiales y formas de ventana de Electron](https://www.electronjs.org/docs/latest/api/browser-window), [limitaciones de ventanas transparentes](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles).

Corrección posterior del marco de cápsula: Acrylic, sombra y resaltado nativos se activan únicamente en la aplicación completa. En cápsula se retira el backdrop exterior de Windows y la sombra CSS; la superficie interior conserva el acabado de cristal y sus preferencias. Su radio CSS de 18 DIP coincide con el recorte nativo. El marco se cambia solo al alternar de modo y la geometría nativa se aplica antes de notificar el nuevo modo al renderer. La prueba Win32 comprueba `DWMSBT_NONE` en cápsula al arrancar y después de recoger la aplicación, conservando los bordes de redimensionado de la app.

Esta corrección pasa las 809 pruebas/67 archivos, el recorrido nativo y el portable extraído. El EXE del escritorio coincide por hash y su arranque conserva cuenta/configuración y un observador vinculado. La sustitución se hace de forma atómica desde una copia verificada en `release`, con respaldo, tras encontrar un bloqueo de escritura del archivo anterior. El proceso real se comprobó en su modo App recordado, con Acrylic; la cápsula sin backdrop se comprobó al iniciar y tras volver de App en el recorrido aislado. Evidencia local: `capsule-frame-deployment.json`, `capsule-frame-native.json` y `capsule-frame-live.json` dentro de `docs/evidence`.

## Estado y privacidad

`companion-desktop-window.json` guarda únicamente modo, rectángulo normal y maximización en el perfil estable de ZEN. La posición anclada de la cápsula permanece independiente y los registros históricos de ventanas se conservan. Las señales de Codex y navegar no fuerzan el tamaño ni el foco de la aplicación. Minimizarla no provoca que el observador la vuelva a mostrar; restaurar desde Windows conserva el modo.

El recorte nativo redondeado se usa solo en cápsula. Al abrir la aplicación se retira con `setShape([])` y se habilitan las capacidades nativas; al recogerla vuelve al anclaje. No se recrean renderer, preload, sesión Google ni servicios durante el cambio. El modo y las dimensiones se guardan sin datos de correo, eventos ni respuestas de Codex.

La imagen se elige por diálogo nativo. Se admiten PNG/JPG/WebP de hasta 12 MiB, 24 megapíxeles y 8192 px por lado, tras comprobar el archivo regular y su identidad durante la lectura. Se comprueba la cabecera antes de decodificar, se normaliza a PNG y se reduce el lado largo a 2560 px. El original no se modifica. La copia queda en `appearance/` dentro del perfil, fuera del repositorio. El renderer recibe un identificador opaco `zen-theme://background/<UUID>` y el nombre base, sin ruta arbitraria. El protocolo sirve solo la imagen vigente y rechaza otros IDs, rutas, consultas y contenido ajeno. No se amplía el acceso remoto de CSP ni se permite HTML/SVG como fondo.

`companion-appearance.json` guarda los ajustes. Los cambios de opacidad/desenfoque son una vista previa local hasta Guardar; elegir un archivo conserva su copia local. Presentación retira la imagen y su nombre de la interfaz y de los estados enviados, descarta la vista previa y bloquea importaciones/cambios de apariencia hasta desactivarla. No se utiliza el fondo como contexto de IA ni se publica con las fuentes.

Las reglas de lectura de Gmail/Calendar/Home/música y la separación Actividad/Resumen de Codex siguen siendo de main, con descarte de respuestas tardías y revisión de efectos. Minimizar, ocultar, recoger, pausa y Presentación mantienen la retirada de datos privados antes de IPC. Las conexiones cifradas de Google se conservan; la integración no cambia OAuth ni Google Cloud.

## Validación

Build y **809 pruebas en 67 archivos** pasan. Los casos nuevos cubren geometría independiente, persistencia del modo/maximización, cambio de monitor, ajustes de cristal, fuentes seleccionadas, formatos activos rechazados, límites de bytes/píxeles, identificadores opacos y conservación de los archivos de cuenta.

El recorrido Electron nativo valida ambas geometrías en la misma ventana, navegación sin recreación ni cambios nativos, redimensionado, maximizar/restaurar, guardado y recuperación del rectángulo, minimizar con respuesta de Codex presente y comprobar su retirada antes de IPC, restauración y retorno al anclaje. Se consultan las regiones de interacción de la ventana propia mediante Win32 `WM_NCHITTEST`: izquierda/derecha/inferior corresponden a bordes de redimensionado. La cabecera usa la región nativa de arrastre y sus botones la excluyen.

Se verifica vista previa y guardado de opacidad/tema, normalización con el decodificador real de Electron de un fondo sintético, carga mediante el protocolo local, rechazo de rutas arbitrarias y retirada en Presentación. Se prueban anchos nativos 320/380/760 y vistas anchas de 1180, conservando las regresiones de correo, Calendar, música, Home, permisos y Codex. Las capturas de `docs/ui-preview/companion/glass-*.png` contienen datos de prueba. Evidencia local en `docs/evidence/companion-native.json` y `docs/evidence/portable-shell.json`.

Las pruebas no consultan correo o eventos reales, no ejecutan reproducción real y no consumen una API de modelos. La consulta de regiones Win32 no acredita un recorrido físico del puntero, múltiples escalados/DPI, foco con juegos o notificaciones físicas; los límites anteriores siguen vigentes.

El EXE portable extraído pasa el mismo recorrido con salida cero. El único `Desktop/ZEN.exe` se sustituye por esa copia, con hash idéntico y respaldo dentro de `release/desktop-backups`. Se verifica el arranque normal del bundle probado y un único observador nativo vinculado. Los archivos de cuentas, preferencias, históricos y configuración de Codex conservan sus hashes; la instancia anterior de ZEN ya estaba cerrada y Codex no se detiene. No se crean carpetas nuevas en el escritorio ni se publica el proyecto. Evidencia local en `docs/evidence/single-executable.json` y `docs/evidence/liquid-glass-deployment.json`.
