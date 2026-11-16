# Sistema de diseño de ZEN

## 01 · Identidad y superficies ![](assets/violeta.svg)

La cápsula reúne el emblema de ZEN y el estado de Codex, navegación, Sonido, acciones rápidas y controles nativos de Windows. El emblema mantiene su orientación. Las etiquetas y los indicadores conservan el estado de Codex y sus transiciones. Al desplegar, la cabecera permanece sobre el contenido de la sección. Apuntes conserva su organización de biblioteca, lista y lector con los colores del tema de ZEN.

La interfaz, el favicon, la ventana, la bandeja y el ejecutable usan el mismo emblema blanco en espiral. El PNG original se conserva íntegro. El generador mantiene la relación de aspecto y el alfa al escalarlo a nueve resoluciones de 16 a 256 px. En tamaños de 16 a 24 px, la textura fina pierde definición y algunos huecos se suavizan al compartir píxel con un borde. [PNG original](../scripts/assets/zen-emblem.png) · [Generador](../scripts/app-icons.mjs)

La isla usa los mismos tokens, fondo y emblema que la cápsula. Las posiciones laterales miden **48 × 285 DIP** en compacto. Arriba y Flotante muestran una isla horizontal de **285 × 50 DIP**. El emblema abre la cápsula. El candado junto al agarre controla el arrastre y comparte su estado con la cápsula. La región nativa recorta las curvas del contorno y deja pasar clics fuera de la silueta. El cristal desenfoca el fondo personal o el degradado de ZEN dentro de la ventana. [Dimensiones](../src/shared/island.ts) · [Geometría](../src/main/companion-workspace-window.ts)

La barra expandida agrupa identidad y avisos, navegación, multimedia, ubicación y controles. En la barra lateral de **160 × 478 DIP**, el selector se sitúa debajo de multimedia y encima del pie. El selector usa cuatro botones de **30 × 30 DIP** con icono, nombre accesible y tooltip. La ubicación activa muestra fondo de acento, marcador inferior y `aria-pressed`. El espacio flexible antes de multimedia mantiene fijo el pie con o sin sesión. [Selector](../src/renderer/CapsulePosition.tsx) · [Menú de cápsula](../src/main/companion-capsule-menu.ts)

## 02 · Tokens y escala ![](assets/rosa.svg)

| Elemento | Valor o regla actual |
| --- | --- |
| Texto y detalle base | `#F1F2F5` y `#91949E`. Usar los tokens efectivos de cristal en cada tema. |
| Acento y borde base | `#B4A0EC` y blanco al 7 %. El tema admite violeta, ámbar y menta. |
| Estado de Inicio | Trabajo `#67B4FF`, permiso `#EEB96A`, turno terminado `#85CFA9`, error `#FB858D`. |
| Tipografía | Segoe UI Variable con Segoe UI de reserva. Etiquetas de 13 px y metadatos de 11 px en el espacio de trabajo. |
| Controles | Botones generales del panel de 34 px como mínimo, radio de 9 px en controles y 14 px en tarjetas. Separaciones de 8 px entre controles y 16 px entre secciones como base. |
| Cristal | Monocromo, oscuro y claro. Opacidad del 74 al 100 % con 90 % inicial. Desenfoque de 0 a 40 px. Fondos Aurora, Atardecer o imagen local. |

Usar `--glass-*` y el fondo del tema para respetar preferencias. La cabecera recogida tiene su propio contorno y evita el marco y la sombra nativa exterior. Las superficies de edición favorecen el contraste.

`--zen-surface` y `--zen-field` distinguen tarjetas y campos del fondo translúcido. El ámbar identifica acciones principales, el violeta identifica ZEN y Monocromo usa tonos neutros para los controles. Los estados de sesión conservan texto y un indicador de color. Las transiciones breves siguen el ajuste de movimiento y la preferencia del sistema.

Los tokens de movimiento usan 90 ms para pulsar, 120 ms para realce, 160 ms para navegación y menús, 200 ms para paneles y 250 ms para la apertura de isla y apuntes. El cambio de sección desplaza 10 DIP cuando existe un orden. El indicador de selección sigue el foco visual y las entradas desaceleran al acercarse al destino. [Tokens de movimiento](../src/shared/companion-motion.ts)

Los tonos de interfaz duran de 38 a 165 ms. Un toque acompaña los controles directos, la navegación efectiva tiene una selección tonal y la isla sube al expandirse y baja al contraerse. Paneles, menús y apuntes usan una apertura y un cierre suaves. Las confirmaciones y avisos siguen resultados observados. El desplazamiento, la escritura, el autoguardado y las actualizaciones de contenido son silenciosos. [Catálogo de efectos](../src/shared/companion-interface-audio.ts)

## 03 · Componentes ![](assets/azul.svg)

- **Botones.** Primario para la acción de la vista. Secundario para copiar, cambiar de pestaña o navegar. Los botones solo con icono conservan nombre accesible.
- **Campos y tarjetas.** Mantener etiquetas, foco y mensajes de error próximos. Las tarjetas muestran un estado principal y acceso a su detalle. Inicio agrupa petición, accesos rápidos, actividad y avisos.
- **Navegación.** Iconos de 18 px y etiquetas de 11 px a ancho habitual. La sección activa usa icono ámbar, texto de primer plano, un borde interior y un indicador inferior de 2 px. Monocromo conserva su acento neutro. En los anchos más estrechos quedan los iconos, con sus nombres accesibles. Codex conserva **Actividad** y **Resumen**.
- **Confirmaciones.** Mostrar la acción concreta y una salida de cancelación. El análisis y los permisos se revisan en ZEN. Importar un respaldo usa diálogo nativo.

## 04 · Adaptación y accesibilidad ![](assets/turquesa.svg)

Preferencias usa una navegación de **208 DIP** y un panel interno más opaco para facilitar la lectura sobre fondos personalizados. Por debajo de 700 DIP disponibles, las categorías se disponen en dos columnas sobre el contenido. Debajo de 480 DIP, cada control se coloca bajo su etiqueta. La vista usa el scroll del Workspace y las miniaturas de apariencia son inertes. [Estilos de Preferencias](../src/renderer/preferences.css)

La cápsula y el Workspace comparten cabecera. El ancho horizontal inicial usa la mitad del área útil del monitor. La superficie horizontal mide **68 DIP** de alto. A **520 DIP** o menos, el selector y los controles pasan a una segunda fila y la superficie mide **92 DIP**. Windows reserva **34 DIP** para el título nativo cuando corresponde. En la barra acoplada ese espacio queda fuera de la región visible. El Workspace admite el redimensionado nativo y los paneles laterales se abren hacia el interior.

El estado y el título de Sonido usan 13 px a ancho habitual. Los títulos largos se truncan y mantienen el texto completo en el tooltip. El foco se dibuja dentro del botón y las transiciones siguen el ajuste de movimiento y la preferencia del sistema. Los recorridos usan 4,5:1 para texto y 3:1 para iconos funcionales como referencia. [WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum)

Fuentes visuales: [tokens y estilos del panel](../src/renderer/workspace-polish.css), [Inicio](../src/renderer/CompanionHome.css), [Apuntes](../src/renderer/NotesWorkspace.css) y [apariencia](../src/shared/companion-appearance.ts).
