# Pruebas de ZEN

## 01 · Capas de verificación ![](assets/violeta.svg)

| Capa | Comando | Alcance |
| --- | --- | --- |
| Unitarias | `npm test -- --maxWorkers=4` | Esquemas, reglas de visibilidad, peticiones, almacenamiento y casos de error. |
| Tipos y producción | `npm run build` | Ejecuta TypeScript sin emitir y construye main, preload y renderer. |
| Auxiliares | `npm run build:native` | Compila los cuatro proyectos del manifiesto de Windows. |
| Electron | `npm run test:electron` | Recorrido de la ventana, IPC y funciones del compañero con un perfil temporal. Requiere bundles y auxiliares compilados. |
| Portable | `node scripts/single-file-smoke.mjs release/single-file/ZEN.exe` | Comprueba extracción, arranque y recorrido del ejecutable concreto. |

El repositorio carece de un script de lint separado. Los comandos históricos de API y agente tienen otro alcance. Para la entrega del compañero usa el recorrido de Electron y el portable según [Despliegue](DEPLOYMENT.md).

## 02 · Regresiones prioritarias ![](assets/azul.svg)

- **Peticiones.** Recibo del chat correcto, rechazo de otro destino, conservación de borrador y ausencia de reenvío automático tras un timeout. [Pruebas de petición](../tests/companion-request.test.ts)
- **Datos de Codex.** Respuesta final disponible solo en Resumen. Probar ausencia, respuesta tardía, destino cambiado y permisos de un uso. [Pruebas del lector](../tests/companion-reader.test.ts)
- **Sonido.** Observación automática, selección de fuente y ejecución solo desde un control explícito. Al ocultar detalles, comprobar que no se envíen controles. [Pruebas de medios](../tests/companion-media.test.ts)
- **Apuntes y respaldo.** Guardado de prompts, Markdown, apertura desde Inicio, exportación, cancelación, restauración de datos y copia de recuperación. El recorrido Electron comprueba que Apuntes recupera la biblioteca de ambos formatos, conserva los ajustes y revoca el permiso si se cambia de sección durante el diálogo. También hay pruebas de formato incompatible y de fallo al aplicar los ajustes. [Pruebas de respaldo](../tests/companion-backup.test.ts)
- **Cápsula.** El recorrido de Electron comprueba la cabecera compartida, las alturas de 68, 102 y 126 DIP en Flotante, el truncamiento de un título de audio largo y el espacio libre para los controles de Windows. Prueba Sonido a 320, 520, 700 y 701 DIP, y el Workspace a 320, 380 y 760 DIP. También calcula contraste para los tres temas y comprueba que maximizar desde la cápsula abre el Workspace.
- **Ubicación.** El recorrido combina comprobaciones del DOM con `WM_NCHITTEST` y la región Win32 en los botones de las cuatro posiciones y en el candado de la isla compacta. Comprueba que el candado comparte estado con la cápsula, bloquea el arrastre y permite cambiar de ubicación. También verifica el foco, el borrador de Inicio, la restauración de la geometría flotante y las selecciones rápidas o repetidas. La prueba de persistencia carga un estado anterior y comprueba la recuperación al perder un monitor.
- **Iconos de sección.** El recorrido verifica los cinco destinos desde la isla, el repliegue al repetir el icono, el cambio directo de panel y la reapertura desde una barra sin panel. Comprueba Enter y Espacio, el foco, los borradores retenidos y clics rápidos con el candado activo. Los objetivos de 30 DIP se comprueban en las cuatro posiciones con Win32 y el ajuste a un área estrecha, con pruebas de geometría.
- **Preferencias.** Abrir Ajustes desde la barra y volver a Inicio. Cambiar de categoría con cambios pendientes, descartar la previsualización, provocar un conflicto de atajos, volver a la sección anterior y comprobar que la posición coincide con la cápsula. El recorrido prueba las seis categorías a 320 DIP y conserva las pruebas de imagen, sonido y respaldos.
- **Barra lateral y menú.** El recorrido prueba las filas de 32 DIP, el acceso al menú con la página abierta, el foco al descartarlo, la posición del pie con sesión activa, pausada o ausente y el control del reproductor autorizado. La región Win32 se comprueba a 96 DPI. Los escalados de 125 % y 150 % siguen pendientes de prueba en Windows.
- **Audio de interfaz.** Las pruebas cubren envolvente, silencio heredado, volumen portable, descarte de repeticiones, inversión y recuperación ante fallos de reproducción. El recorrido Electron mide las reproducciones programadas, comprueba la preescucha y verifica que cambiar de sección con los efectos desactivados mantenga el silencio. La escucha física se verifica por separado. [Pruebas de audio](../tests/companion-interface-audio.test.ts)
- **Isla.** El recorrido comprueba las dos siluetas en ambos bordes, su centro, el arrastre simulado, el anclaje guardado, el candado y la apertura del panel hacia dentro. Win32 verifica las coordenadas de la región, el paso de clic fuera de la silueta y el orden Z. El recorrido flotante comprueba clic, teclado, contracción con retardo, continuidad del borrador y recepción de resultados. El cambio físico entre monitores con distinto DPI se comprueba aparte.
- **Borde luminoso.** Las pruebas cubren el recorrido sobre las curvas y el respaldo de las preferencias. El recorrido de Electron comprueba la capa decorativa y los objetivos nativos en las cuatro posiciones, las paletas, el trazo estático, el movimiento reducido emulado, la pausa al minimizar y el guardado de Apariencia. Registra las actualizaciones del lienzo y una muestra breve de CPU del renderer.
- **Emblema.** El recorrido Electron verifica el recurso en la isla y la cápsula en las cuatro posiciones y lo compone sobre tres fondos. Comprueba también Acerca de, el favicon y la orientación durante la actividad. `node scripts/icon-smoke.mjs release/single-file/ZEN.exe` verifica las nueve resoluciones del recurso PE, sus huecos transparentes y los bordes suavizados. También compara el icono extraído por Windows a 16, 32 y 48 px. El recorrido del portable comprueba el icono y el comando de reapertura de la barra de tareas.
- **Workspace.** Comprobar media pantalla, cambios de distribución, candado, retorno al anclaje y restauración al abrir. La prueba Win32 comprueba los bordes redimensionables y el hit test nativo del botón de maximizar. [Pruebas de geometría](../tests/workspace-window.test.ts)
- **Cierre y restauración.** El recorrido envía los comandos Win32 nativos de cierre y restauración. Comprueba que la X minimiza la ventana con una entrada normal en Windows y que se restauran el mismo identificador de ventana, la geometría, Inicio y su borrador.
- **Movimiento.** Invertir la apertura de la isla antes de alcanzar su ancho final. Cambiar de sección rápidamente y volver a la activa. Comprobar que Apuntes mantiene el borrador después de navegar y de un conflicto de guardado. El recorrido usa datos sintéticos y la región nativa de la ventana de Windows. Las respuestas del compañero se reciben mediante eventos y lectura de resultados de Codex.
- **Ubicación y cristal.** El recorrido cambia entre las cuatro ubicaciones con el panel abierto, comprueba su reapertura con el borrador intacto y verifica el fondo personalizado en las dos presentaciones. Win32 comprueba el paso de clic fuera de las siluetas acopladas y flotantes. El selector de ubicación sigue disponible con el candado activado.

## 03 · Evidencia y límites ![](assets/verde.svg)

En la entrega del respaldo del **12 de noviembre de 2026** pasaron el build, 564 pruebas en 61 archivos y el recorrido del portable extraído. El recorrido aislado confirmó exportación, cancelación, copia anterior y restauración. La regeneración de estos documentos se valida aparte con enlaces, coherencia y comparación del código.

En la entrega del borde luminoso pasaron el build, **581 pruebas en 64 archivos** y el recorrido del portable extraído en Windows a **96 DPI**. Dos arranques del paquete con el mismo perfil aislado recuperaron la paleta y los valores guardados. En una muestra de un segundo en Apariencia, el lienzo principal se actualizó 27 veces con la animación activa y cero veces con el borde estático. El proceso del renderer registró aproximadamente 54 y 33 ms de CPU, respectivamente. Queda pendiente la comprobación física entre monitores con escalas distintas.

En la revisión del Workspace pasaron el build, 563 pruebas en 62 archivos y el recorrido de Electron. En Windows 11, con un perfil aislado y dos monitores al 100 %, se comprobaron Win + Izquierda/Derecha, Win + Arriba/Abajo, Win + Mayús + Izquierda/Derecha y el doble clic en la zona de título. Quedan pendientes la observación del menú de Win + Z, el acoplamiento y ajuste de proporciones por arrastre, y los cambios de resolución y DPI.

En la revisión del orden Z pasaron el build, 564 pruebas, el recorrido de Electron y el portable extraído. En Windows 11 se comprobó con un perfil aislado que Chrome puede cubrir ZEN, que Alt+Tab devuelve el foco a la cápsula, que el candado conserva un orden Z normal y que el Workspace vuelve a media pantalla tras reiniciar. El recorrido Win32 verifica el botón de maximizar y los bordes nativos. Las combinaciones Win + Izquierda/Derecha quedan pendientes de repetir en esta revisión.

En la revisión de la cabecera compartida pasaron el build, 565 pruebas en 62 archivos, el recorrido de la ventana empaquetada y el del portable extraído. El recorrido aislado verificó la posición y el diseño al desplegar y recoger, el ancho estrecho y la maximización desde la cápsula.

En el refinamiento visual v2.2 pasaron TypeScript, el build, las 565 pruebas en 62 archivos y los recorridos de la ventana empaquetada y del portable extraído. Se comprobaron la altura original, la selección, los títulos largos, el contraste de los tres temas y el ajuste horizontal con los controles nativos visibles.

En la entrega de la isla pasaron TypeScript, el build, 566 pruebas en 62 archivos y los recorridos de la ventana empaquetada y del portable extraído. La prueba Win32 se ejecutó a 96 DPI. El arrastre entre monitores con distinta escala y la superposición física con otras aplicaciones quedan pendientes para esta versión.

En el cambio lateral del **14 de noviembre de 2026**, la compilación nativa, TypeScript y las 567 pruebas en 62 archivos pasaron. Win32 confirmó que las cuatro siluetas laterales coinciden con ambos bordes a 96 DPI y permiten clics a través de los hombros recortados. Las capturas del renderer reproducen ese recorte con canal alfa. La comprobación física entre monitores con distintas escalas y la superposición manual se realizan aparte.

En la entrega de movimiento pasaron TypeScript, 567 pruebas y los recorridos de Electron y del portable extraído. El recorrido verificó la inversión de la isla, el foco al crear un apunte y la conservación del borrador después de navegar o de un conflicto de guardado.

En la unificación de isla y cápsula pasaron TypeScript, 568 pruebas y los recorridos de Windows empaquetado y del portable extraído. Se verificaron la región superior en compacto y expandido, el fondo importado en las cuatro posiciones y la reapertura del panel con el borrador original. Las pruebas Win32 se ejecutaron a 96 DPI.

El selector de ubicación pasó el build, 576 pruebas y los recorridos de Electron, del paquete Windows y del portable extraído a 96 DPI. Un segundo arranque con el mismo perfil de prueba recuperó el Workspace a la derecha y restauró sus coordenadas y dimensiones anteriores al pasar a Flotante. Quedan pendientes las pruebas físicas al 125 %, 150 % y 200 % y el arrastre entre monitores con escalas distintas.

El centro de Preferencias pasó el build, 576 pruebas y los recorridos de Electron, del paquete Windows y del portable extraído. Con un perfil aislado se corrigió un conflicto de atajos y se recuperó el atajo guardado y la última categoría después de reiniciar. Las seis categorías encajaron a 320 DIP y con factores de zoom del renderer entre el 100 % y el 200 %. La escala nativa del monitor de pruebas era 96 DPI.

Para los sonidos de interfaz pasaron el build, 574 pruebas y los recorridos de Electron, del paquete de Windows y del portable extraído. Se comprobó un solo efecto por transición, preescucha, silencio al repetir la sección y persistencia del volumen y del interruptor. Los recorridos de prueba registran las reproducciones con la salida silenciada. Queda pendiente la escucha física.

Para el emblema pasaron el build, 574 pruebas y los recorridos de Electron y del portable extraído. Windows leyó el icono de ambos ejecutables a 16, 32 y 48 px. Se comprobaron los nueve tamaños del ICO, las dos presentaciones en las cuatro posiciones, la transparencia sobre tres fondos y el recurso de reapertura de la barra de tareas. Queda pendiente la inspección visual de notificaciones reales.

La ejecución de un portable y las sesiones sintéticas acreditan los casos descritos. El foco sobre aplicaciones reales, el arrastre físico, los cambios de DPI, los avisos de Windows y las conexiones reales de Codex requieren su propia comprobación cuando resulten afectados.

## 04 · Criterio de cierre ![](assets/ambar.svg)

- [ ] Reproducir la acción normal y el caso de error pertinente.
- [ ] Probar con datos sintéticos y preservar perfiles reales.
- [ ] Registrar comando, resultado, artefacto cuando aplique y aspectos pendientes.
- [ ] Actualizar únicamente la documentación afectada. Si solo cambia Markdown, comprobar enlaces y contrastar los comandos con el repositorio.
