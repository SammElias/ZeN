# Sistema de diseño de ZEN

Contraseñas reutiliza la navegación, paneles, menús, botones y tokens de HUB. Una sola pantalla compacta contiene buscador, proyectos plegables y filas de cuentas. Los controles de copia y visibilidad permanecen en cada fila con nombres accesibles; el menú secundario agrupa edición y eliminación. La máscara fija no comunica la longitud de la clave. El formulario de desbloqueo no muestra metadatos. En ancho estrecho las acciones pasan a la siguiente línea.

## 01 · Identidad y superficies ![](assets/violeta.svg)

La cápsula pequeña reúne el emblema de ZEN, un indicador de estado, siete accesos, ubicación, candado y agarre. El emblema mantiene su orientación. Los nombres de los accesos están disponibles mediante tooltips y etiquetas accesibles. Al desplegar, la cabecera permanece sobre el contenido de la sección. HUB organiza la biblioteca, la lista y el lector con los colores del tema de ZEN.

La interfaz, el favicon, la ventana, la bandeja y el ejecutable usan el mismo emblema blanco en espiral. El PNG original se conserva íntegro. El generador mantiene la relación de aspecto y el alfa al escalarlo a nueve resoluciones de 16 a 256 px. En tamaños de 16 a 24 px, la textura fina pierde definición y algunos huecos se suavizan al compartir píxel con un borde. [PNG original](../scripts/assets/zen-emblem.png) · [Generador](../scripts/app-icons.mjs)

La isla usa los mismos tokens, fondo y emblema que la cápsula. Las posiciones laterales miden **48 × 505 DIP** en compacto. Arriba y Flotante muestran una isla de **505 × 50 DIP**. Si el área útil es menor en ese eje, los controles se agrupan en dos columnas de **89 × 315 DIP** o dos filas de **315 × 89 DIP**. Los siete iconos de navegación tienen objetivos de **30 × 30 DIP**, nombres accesibles e información al pasar el cursor. El emblema controla la presentación general. El selector de posición y el candado junto al agarre ocupan su propio grupo. La región nativa recorta las curvas del contorno y deja pasar clics fuera de la silueta. [Dimensiones](../src/shared/island.ts) · [Geometría](../src/main/companion-workspace-window.ts)

Los accesos comparten una paleta. Home usa azul, HUB ámbar, Calendario rosa, Métricas verde, Volumen menta y Configuración gris azulado. Monocromo usa tonos neutros. Una raya recuerda la última sección y el marcador de selección identifica un panel visible.

La cápsula mantiene sus dimensiones y anclaje al mostrar u ocultar el panel. La superficie del panel se sitúa debajo, a la derecha o a la izquierda según la ubicación. Flotante utiliza el lado con espacio disponible. La región Win32 contiene únicamente la silueta pequeña y el panel.

**Permisos de Codex** usa una superficie de **350 DIP** de ancho junto a la cápsula. Su altura inicial se calcula entre **238 y 306 DIP** según el comando y la cola, y se limita al área de trabajo. El texto original se ajusta al ancho y se desplaza dentro del bloque. **Detalles** muestra la hora de caducidad y permite copiar la solicitud completa. En los últimos veinte segundos el encabezado muestra la cuenta atrás. Las decisiones quedan en una fila y **Abrir en Codex** baja de línea en anchos estrechos. El control de cierre recoge el panel sin decidir.

**Modo simple** adapta el panel a cada sección y al área útil del monitor. Avisos usa **480 × 240 DIP**, Home **530 × 415 DIP** y Preferencias **560 × 370 DIP**. Los desplegables abren información secundaria dentro del panel desplazable. HUB usa la geometría y la interfaz habituales. Todas las vistas comparten el tema y el contorno luminoso de ZEN.

El candado indica modo automático cuando está abierto y modo fijado cuando está cerrado. El mismo botón mantiene su posición junto al agarre y muestra su estado en la etiqueta emergente. El emblema permite recoger el panel fijado.

Los siete accesos admiten apertura por cursor, clic y teclado. El marcador de la sección permanece activo al pasar al contenido. Los controles de ubicación y el candado siguen ocupando sus posiciones y responden a su activación habitual.

La cápsula y el panel desplegado comparten un borde luminoso de **2,5 DIP** y un halo interior de hasta **5 DIP**. Ámbar solar es la paleta inicial, con intensidad del **60 %** y un tramo luminoso que abarca el **18 %** del recorrido. La vuelta normal dura **6 s**, la lenta **9 s** y la rápida **4 s**. El color es independiente del acento de ZEN y el movimiento se usa como decoración silenciosa.

El pulso recorre las cuatro esquinas redondeadas del panel y sigue su tamaño y posición. La cápsula y el panel usan la misma fase de animación. Al replegar, la cápsula continúa el recorrido y, al volver a abrir, el panel se incorpora en la fase actual. El borde del panel permanece fijo mientras se desplaza el contenido.

En los bordes acoplados, los remates se funden dentro de los hombros de la silueta. La extensión inicial es de **16 DIP** y se puede ajustar de **0 a 18 DIP**. En Flotante, el recorrido se cierra sobre las esquinas. El efecto usa una capa no interactiva y conserva la región nativa existente. Con movimiento reducido, el trazo queda fijo. [Valores y paletas](../src/shared/companion-neon.ts) · [Contorno](../src/renderer/neon-contour.ts)

## 02 · Tokens y escala ![](assets/rosa.svg)

| Elemento | Valor o regla actual |
| --- | --- |
| Texto y detalle base | `#F1F2F5` y `#91949E`. Usar los tokens efectivos de cristal en cada tema. |
| Acento y borde base | `#B4A0EC` y blanco al 7 %. El tema admite violeta, ámbar y menta. |
| Estado de Inicio | Trabajo `#67B4FF`, permiso `#EEB96A`, turno terminado `#85CFA9`, error `#FB858D`. |
| Tipografía | Segoe UI Variable con Segoe UI de reserva. Etiquetas de 13 px y metadatos de 11 px en el espacio de trabajo. |
| Controles | Botones generales del panel de 34 px como mínimo, radio de 9 px en controles y 14 px en tarjetas. Separaciones de 8 px entre controles y 16 px entre secciones como base. |
| Cristal | Monocromo, oscuro y claro. Opacidad del 0 al 100 % en pasos de 1 %, con 78 % inicial. El 0 % quita el tinte de la cápsula y del panel. Desenfoque de 0 a 40 px. Fondos Aurora, Atardecer o imagen local. |

Usar `--glass-*` y el fondo del tema para respetar preferencias. La cabecera recogida tiene su propio contorno y evita el marco y la sombra nativa exterior. Las superficies de edición favorecen el contraste.

Todas las secciones comparten una superficie de cristal fuera del contenido desplazable. La escena se dibuja detrás de una capa con la opacidad y el desenfoque configurados. Inicio, Codex, Sonido, HUB, Calendario y Ajustes conservan ese fondo al navegar y hacer scroll. El filtro afecta al fondo; el texto, las portadas y las referencias visuales permanecen nítidos. La preferencia del sistema de reducir transparencia vuelve opaca la superficie y desactiva el desenfoque.

Templates usa las superficies de HUB y miniaturas de proporción fija que conservan la composición completa. La galería adapta las columnas al espacio disponible. El detalle separa la referencia y el contenido en paneles anchos, y los apila cuando falta espacio. El selector de plataforma y la acción de copiar aparecen antes de la vista previa. El texto del prompt se puede seleccionar y mantiene su legibilidad sobre el fondo del usuario.

La navegación y Templates heredan el tema general de ZEN. El ajuste claro u oscuro guardado por HUB se conserva como **Tema del lector** para apuntes y prompts. Sus campos y superficies de lectura mantienen más opacidad para facilitar el contraste.

Descubrimiento de apps reutiliza los paneles de HUB. Cada pregunta destaca el inglés y muestra debajo su apoyo en español. Los cuatro botones de bloque se ajustan al ancho y el formulario conserva un área de scroll propia.

Apuntes usa el encabezado y los márgenes de HUB, un único campo de texto con foco accesible y scroll interno. En vacío el campo muestra «Escribe aquí…». El aviso y el botón de reintento aparecen si el almacenamiento falla.

Pizarra reúne tres grosores, cinco colores, goma y Deshacer en una barra que se ajusta al ancho disponible. Reiniciar queda al extremo. La selección usa borde y fondo, y la muestra de color activa lleva una marca. El lienzo ocupa todo el ancho y alto bajo la barra. Al cambiar de tamaño, el dibujo conserva sus proporciones y sus trazos cercanos a los bordes. Los cinco colores tienen variantes claras y oscuras de alto contraste.

Traductor reúne los idiomas, los campos de texto y las acciones en un panel de cristal de HUB. Original y traducción aparecen lado a lado cuando hay espacio y se apilan en ancho estrecho. La clave se introduce en un campo enmascarado.

Officina usa un escenario prerenderizado con luz cálida, conexiones cian y controles de puestos, mesa y traspasos. El plano conserva sus proporciones y se adapta al ancho y alto disponibles. En ancho estrecho, el panel de equipo e historial se sitúa debajo del plano. La luz ambiental, los gestos y las señales se suspenden al ocultar la vista o al reducir el movimiento.

Cuando un puesto queda libre alterna poses localizadas sobre el plano con su propio ritmo. Las pantallas simulan revisar notas, seguir dependencias, leer código, recorrer pruebas y verificar un despliegue. Los ciclos enlazan el último fotograma con el primero y cambian de ritmo con el estado del puesto conservando la imagen actual. Cada pantalla proyecta un reflejo suave sobre su escritorio. Cuando llega un traspaso, aparece un aviso luminoso breve en el monitor receptor. Con movimiento reducido, las pantallas muestran una imagen estática. La iluminación y la planta de la mesa también tienen movimiento ambiental. Los efectos se ajustan a la perspectiva del plano y quedan detrás de los controles.

El campo de **Chat global** queda fijo en la parte inferior. El historial comparte el panel desplazable con **Equipo** y mantiene el plano visible. Identifica los mensajes del usuario, de Coordinación y las asignaciones automáticas de Officina. Las solicitudes de aprobación conservan su acceso al panel de Permisos de Codex.

**Actividad del equipo** muestra el puesto, su estado y el encargo. El color acompaña a la etiqueta de texto. El plano resalta el puesto que trabaja en Codex y su gesto se detiene cuando el turno espera permiso, finaliza o se reduce el movimiento.

`--zen-surface` y `--zen-field` distinguen tarjetas y campos del fondo translúcido. El ámbar identifica acciones principales, el violeta identifica ZEN y Monocromo usa tonos neutros para los controles. Los estados de sesión conservan texto y un indicador de color. Las transiciones breves siguen el ajuste de movimiento y la preferencia del sistema.

Los tokens de movimiento usan 90 ms para pulsar, 120 ms para realce, 160 ms para navegación y menús, 200 ms para paneles y 250 ms para la apertura de isla y apuntes. El giro entre Apps dura 480 ms y usa dos caras unidas que se mueven sobre el eje horizontal con perspectiva suave y desaceleración. La cápsula y el borde exterior quedan fijos. Las demás transiciones de navegación conservan su desplazamiento de 10 DIP cuando existe un orden. [Tokens de movimiento](../src/shared/companion-motion.ts)

El menú de HUB comparte el giro de 480 ms. El sentido sigue el orden vertical y solo gira el panel de contenido. El menú permanece fijo y el cambio es instantáneo con movimiento reducido.

Al usar la isla con el cursor, el panel se despliega y se recoge al ritmo de **600 ms** por transición. El movimiento nace del borde que comparte con la cápsula y el repliegue descubre el escritorio. Volver durante el repliegue restaura el panel desde la posición en la que estaba. Con movimiento reducido se aplica la posición final cuando concluye la espera.

Los tonos de interfaz duran de 38 a 165 ms. Un toque acompaña los controles directos, la navegación efectiva tiene una selección tonal y la isla sube al expandirse y baja al contraerse. Paneles, menús y apuntes usan una apertura y un cierre suaves. Las confirmaciones y avisos siguen resultados observados. El desplazamiento, la escritura, el autoguardado y las actualizaciones de contenido son silenciosos. [Catálogo de efectos](../src/shared/companion-interface-audio.ts)

## 03 · Componentes ![](assets/azul.svg)

- **Botones.** Primario para la acción de la vista. Secundario para copiar, cambiar de pestaña o navegar. Los botones solo con icono conservan nombre accesible.
- **Campos y tarjetas.** Mantener etiquetas, foco y mensajes de error próximos. En Home, Clima, Hoy, Sueño y las píldoras de Codex, HUB y Sonido preceden al editor de peticiones. El editor agrupa el chat de destino y los atajos sobre el cristal compartido. Las barras de Sonido se animan cuando hay reproducción y el movimiento está habilitado.
- **Navegación.** La cápsula usa iconos de 18 px sin etiquetas permanentes. Cada sección conserva su color, nombre accesible y tooltip. El acceso activo tiene fondo, borde e indicador; la última sección recordada usa una señal distinta cuando su panel está oculto. Monocromo conserva tonos neutros. Codex abre **Actividad** con selector de chat y cronología. El emblema ámbar abre la revisión de permisos. El comando aparece en un bloque desplazable que admite teclado.
- **Métricas.** Tres tarjetas seleccionables sobre cristal muestran medida, día y última consulta correcta. El historial usa una fila por día y un hueco para cada valor ausente. Home muestra una tarjeta compacta de sueño junto a Hoy. La cápsula puede mostrar la duración en el espacio del icono de Métricas.
- **Hoy.** En Home, la fecha abre Calendario desde una tarjeta sobre el mismo cristal. En ancho suficiente se muestra junto a Sueño. En una ventana estrecha las tarjetas se apilan.
- **Clima.** En Home, un panel sobre el mismo cristal reúne temperatura actual, condición, máxima, mínima y lluvia prevista. El pronóstico identifica el período y muestra la atribución a OpenWeather. El cambio de ciudad y clave se abre dentro del panel.
- **Volumen del sistema.** Sonido muestra el porcentaje sobre el deslizador de ancho completo. El control comparte el acento del tema y mantiene el foco del teclado visible.
- **Supervisor de Codex.** Lista estrecha de chats y una cronología sobre cristal. El estado combina color y texto. Si falta ancho, la lista se recoge en el selector **Chats** y puede abrirse con teclado.
- **Confirmaciones.** Mostrar la acción concreta y una salida de cancelación. El análisis y los permisos se revisan en ZEN. Importar un respaldo usa diálogo nativo.

## 04 · Adaptación y accesibilidad ![](assets/turquesa.svg)

Preferencias usa una navegación de **208 DIP** y un panel interno más opaco para facilitar la lectura sobre fondos personalizados. Por debajo de 700 DIP disponibles, las categorías se disponen en dos columnas sobre el contenido. Debajo de 480 DIP, cada control se coloca bajo su etiqueta. La vista usa el scroll del Workspace y las miniaturas de apariencia son inertes. [Estilos de Preferencias](../src/renderer/preferences.css)

La cápsula y el panel comparten una ventana. El panel admite el tamaño y acoplamiento nativos de Windows. La cápsula conserva su tamaño incluso al redimensionar el contenido.

El estado y el título de Sonido usan 13 px a ancho habitual. Los títulos largos se truncan y mantienen el texto completo en el tooltip. El foco se dibuja dentro del botón y las transiciones siguen el ajuste de movimiento y la preferencia del sistema. Los recorridos usan 4,5:1 para texto y 3:1 para iconos funcionales como referencia. [WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum)

Fuentes visuales: [tokens y estilos del panel](../src/renderer/workspace-polish.css), [Inicio](../src/renderer/CompanionHome.css), [HUB](../src/renderer/NotesWorkspace.css) y [apariencia](../src/shared/companion-appearance.ts).


Calendario combina una fecha destacada con una cuadrícula de siete columnas. En anchuras estrechas se apilan. La agenda tiene su propio scroll. Los estados de actualización usan texto y las etiquetas **Local**, **Sincronizado** y **Pendiente** explican el origen.

La tarjeta **Próximo evento** ocupa el espacio junto al estado de sincronización. En paneles estrechos aparece sobre la cuadrícula. Muestra el título, la fecha y la hora o la etiqueta **Todo el día**.
