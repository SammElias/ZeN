# Flujos de usuario

## 01 · Abrir y navegar ![](assets/violeta.svg)

- Abre ZEN desde la bandeja o con `Ctrl+Alt+Z`. La cápsula pequeña es el acceso permanente.
- En Windows, con el candado abierto, deja el cursor 150 ms sobre **Home**, **Codex**, **Sonido**, **HUB** o **Calendario** para abrir esa sección. Si el panel está recogido, se despliega durante 600 ms. Salir del icono cancela la espera inicial. El clic y el teclado actúan de inmediato. La otra aplicación conserva el foco hasta que hagas clic en ZEN.
- Los iconos del emblema, ubicación, candado y Ajustes se accionan con un clic o con el teclado.
- La cápsula, el contenido y sus menús cuentan como una sola zona. Tras 450 ms fuera del conjunto, el panel se recoge hacia la cápsula durante 600 ms. Volver a entrar antes de que termine restaura el panel. ZEN espera a que termine un arrastre o diálogo antes de volver a comprobar el cursor.
- La primera apertura muestra directamente la app elegida. Con el panel abierto, cambiar de app gira solo el contenido según el orden visible del menú. Bajar o avanzar a la derecha gira hacia abajo. Subir o volver a la izquierda invierte el giro. Con movimiento reducido, el cambio es instantáneo. Volver a pulsar la app activa conserva su vista.
- Cierra el candado para conservar la presentación actual y bloquear el arrastre. Si el panel está abierto, conserva su estado al pasar a otra aplicación y sigue los ajustes normales de superposición de Windows. Si solo está la cápsula, el cursor la deja recogida y un clic en un acceso abre el panel fijado. Usa el emblema o Escape para recogerlo.
- Cambiar el candado cancela el temporizador de apertura o repliegue. Al desbloquear dentro del panel, el plazo de 450 ms empieza al salir. El repliegue conserva la posición, la sección y el borrador. Si lo recoges con el cursor sobre un icono de Apps, puedes volver a ese icono o pasar directamente a otro para abrir el panel.
- El emblema oculta el panel visible y recupera la última sección cuando solo se ve la cápsula. El menú contextual del emblema ofrece ubicación, distribución, siempre encima, preferencias, silencio, minimizar y salir.
- La selección marca un panel visible. Al ocultarlo, una raya discreta recuerda la última sección. Las flechas recorren los accesos según su orientación y Enter o Espacio los activan. Escape respeta primero diálogos y menús.
- El selector de **Arriba**, **Izquierda**, **Derecha** y **Flotante** permanece accesible junto al candado y al agarre. El candado bloquea el arrastre. El panel conserva su contenido al cambiar de ubicación.
- Los avisos se consultan en Inicio y los permisos en Codex. Los indicadores de Home y Codex conservan el contador. El estado junto al emblema corresponde a señales observadas.
- Los controles completos de reproducción están en Sonido. Ocultar su panel libera la consulta de controles sin enviar órdenes al reproductor.
- `Ctrl+Alt+C`, si conservas el atajo inicial, vuelve al chat fijado. La X y **Minimizar ZEN** conservan la aplicación en Windows. **Salir de ZEN** termina la instancia.

## 02 · Pedir, revisar y continuar ![](assets/azul.svg)

| Acción | Resultado |
| --- | --- |
| Escribir en Inicio y pulsar **Enviar a Codex** con chat fijado. | ZEN muestra el resultado de la entrega. Si devuelve un error, conserva el borrador. Si la entrega es incierta, revisar el chat antes de reintentar. |
| Pulsar **Abrir en Codex** sin destino fijado. | Se prepara el borrador o se ofrece el texto copiado. El usuario envía desde Codex. |
| Elegir **Resumir mis correos** o **Ver mi agenda**. | Se pide a Codex una consulta de lectura de los últimos siete días de correos no leídos en Recibidos o los próximos siete días de agenda, incluido hoy. Se conserva el borrador de Inicio. |
| Abrir **Codex → Actividad**. | Elegir un chat observado entre los que necesitan permiso, los que están en curso y los recientes. ZEN mantiene la selección y muestra una única cronología. Abre cada fila para ver su detalle o usa **Abrir en Codex** para continuar en el chat. |
| Abrir **Codex → Resumen**. | Leer, copiar o abrir la última respuesta final disponible. Si todavía falta, se muestra un estado vacío. |
| Usar **Analizar** desde Codex. | Seleccionar archivo, página o texto, revisar lo que se enviará y confirmar. Si cambió el contexto o venció la revisión, preparar una nueva. |

En Home, las píldoras de **Codex**, **HUB** y **Sonido** abren la actividad o los permisos, la biblioteca y el reproductor, respectivamente. Sonido indica el título y si hay una sesión en reproducción o en pausa.

En espacios estrechos, el selector **Chats** recoge la lista. **Filtros** busca acciones del chat seleccionado o limita la cronología a comandos o archivos. Para permisos de otros chats, usa **Revisar en Codex**. Las peticiones de Home y Calendario se envían al chat fijado.

En **Continúa donde lo dejaste**, selecciona un apunte para abrir su ficha o una acción de Codex para revisar su detalle. **Avisos** destaca permisos y errores. Puedes silenciarlos durante 30 minutos y reactivarlos antes.

## 03 · Guardar y transferir apuntes ![](assets/verde.svg)

En **HUB**, elige una carpeta y crea una entrada con título y descripción. Añade comandos, Markdown o imágenes según el contenido. **Biblioteca de prompts** permite guardar y copiar prompts. Usa la vista Markdown para leer el contenido con formato y el editor para corregirlo. El formateador local y la preparación de una petición a Codex son acciones distintas.

El filtro de apuntes y el editor ofrecen las mismas carpetas. Las categorías de versiones anteriores aparecen cuando ya contienen entradas del tipo que estás consultando. Puedes crear una carpeta vacía y empezar a usarla desde **Nuevo → Carpeta**.

El respaldo de **Ajustes → Datos y configuración** traslada la biblioteca y la configuración portable. **HUB → Respaldo y exportación → Restaurar biblioteca** admite los dos formatos y muestra qué recuperará antes de confirmar. El recorrido y la recuperación están en [Despliegue](DEPLOYMENT.md).

En **HUB → Templates**, busca por nombre, descripción o etiqueta, filtra por estilo o elige **Favoritos**. Abre una tarjeta para ampliar su **Referencia visual** y leer el **Prompt propuesto**. **Adaptar a mi proyecto** sustituye localmente los campos que rellenes y conserva las variables pendientes entre llaves. Puedes copiar el original o el texto adaptado. La galería recupera sus filtros y su posición al volver del detalle.

**Nuevo template** y **Editar** permiten guardar el texto, las etiquetas, una referencia de hasta 4 MB y la atribución disponible. Puedes duplicar el registro para crear una variante. El editor guarda el borrador aparte y pide confirmación antes de descartarlo o de eliminar un template.

## 04 · Sonido, preferencias y estados ![](assets/turquesa.svg)

Sonido muestra el título y la fuente que publica Windows. Puedes seleccionar una sesión y usar sus controles disponibles. Cuando no hay una sesión, aparece **Sin reproducción**. En Preferencias, guarda el tema, el fondo y la densidad del cristal después de previsualizarlos. Pausa y Presentación limitan contenido y acciones sensibles según la vista.

El fondo, el cristal y el desenfoque guardados se aplican a todas las secciones. En **HUB → Configuración**, **Tema del lector** conserva el contraste claro u oscuro de apuntes y prompts; la navegación y Templates siguen la apariencia general de ZEN.

El **Borde luminoso** de Apariencia controla tanto la cápsula como el contorno completo del panel desplegado. Los dos usan la misma paleta, intensidad y velocidad. La cápsula conserva el pulso al replegar el panel.

En **Preferencias → Sonidos y avisos**, puedes activar los efectos, regular el volumen y preescuchar la apertura con el ajuste actual antes de pulsar **Guardar**. El volumen inicial es 18 %. Los perfiles anteriores heredan el ajuste de sonidos de aviso hasta que elijas un valor propio para la interfaz. Pausa, Presentación y el silencio temporal se aplican a ambos. El volumen multimedia se controla desde Sonido.

## Preferencias

Abre **Preferencias** desde **Ajustes**, Inicio o el menú del emblema. La vista recuerda la última categoría y **Volver** recupera la sección anterior. Los borradores siguen disponibles al cambiar de categoría. El guardado se confirma después de que ZEN lo aplica.

| Categoría | Ajustes y acciones |
| --- | --- |
| Apariencia | Tema, acento, fondo, opacidad, desenfoque interno y **Borde luminoso**. Puedes encender el borde, elegir una de cuatro paletas, desactivar el movimiento y ajustar la intensidad, la velocidad y el remate de los bordes acoplados. La previsualización temporal se suspende al salir de la categoría. El archivo de imagen se aplica al elegirlo. Usa un fondo predefinido o **Quitar de la vista** para dejar de mostrar la imagen y confirma los cambios con **Guardar apariencia**. |
| Cápsula y panel | Ubicación, **Fijar panel y posición**, restauración al inicio y acceso a distribución. Estos controles se aplican al momento. Pulsa **Guardar** para aplicar siempre encima, monitor del puntero, pantalla completa, clic fuera, barra de tareas y animaciones. |
| Sonidos y avisos | Efectos, volumen, preescucha, notificaciones, sonidos de aviso, Pausa y Presentación. El silencio temporal y la prueba de aviso actúan sobre la configuración guardada. |
| Atajos | Mostrar cápsula y volver al chat de Codex. ZEN comprueba conflictos al guardar. |
| Datos y configuración | Exportar, importar y preparar el restablecimiento de apariencia. El restablecimiento abre Apariencia con los valores iniciales para revisar y guardar. |
| Conexión y diagnóstico | Estado de Codex, cuenta, chat fijado y señal. En **Detalles técnicos** están la revisión de hooks y el comando de copia. **Acerca de ZEN** muestra las atribuciones. |

| Estado | Comportamiento esperado |
| --- | --- |
| Cargando | La petición o lectura muestra progreso cuando existe y evita duplicar el envío. |
| Éxito | «En cola» acredita la entrega. «Turno terminado» corresponde a actividad observada. La importación informa del respaldo anterior. |
| Error | La vista muestra el fallo y una acción disponible. El borrador se conserva si no se pudo entregar. |
| Vacío | Una vista sin sesión, actividad, notas o respuesta muestra su estado y mantiene accesible la navegación. |

## 05 · Tamaño y accesibilidad ![](assets/rosa.svg)

El panel aprovecha el tamaño de la ventana. La cápsula conserva sus dimensiones al abrir contenido. Si falta longitud en su eje, sus controles usan dos filas o columnas. El panel dispone de su propia superficie desplazable. Comprobar foco, navegación por teclado, textos largos y movimiento reducido con los criterios de [Diseño](DESIGN_SYSTEM.md).


## 06 · Calendario

Calendario muestra la fecha seleccionada, el mes de lunes a domingo y la agenda del día. Los puntos señalan eventos, el contorno identifica hoy y el fondo de acento identifica la selección. **Hoy**, los controles de mes y **Actualizar** conservan su función independiente.

**Solo en ZEN** guarda eventos locales de forma persistente. El título y las fechas son obligatorios. Los horarios inexistentes o ambiguos por cambio de hora se rechazan con una explicación. Los eventos de día completo conservan fechas y fin exclusivo.

Con chat fijado, la primera apertura de un intervalo puede solicitar su consulta a Codex. El conector debe estar disponible en ese chat. ZEN incorpora únicamente una respuesta estructurada validada con el identificador de la petición. Si el chat tarda en contestar, ZEN muestra el aviso y todavía acepta la respuesta mientras esa consulta siga vigente. Actualizar conserva la copia anterior y los eventos locales.

Los destinos externos aparecen cuando Codex devuelve sus identidades y permiso de escritura. Guardar envía una solicitud por el mismo puente. El estado **Creado** requiere un identificador confirmado del proveedor. Una respuesta incierta conserva el formulario y bloquea la repetición automática. Mientras falta confirmación, los campos de la solicitud externa quedan bloqueados. Puedes elegir expresamente **Solo en ZEN** para guardar una copia local; la solicitud externa sigue pendiente y se informa de ello. **Comprobar en Codex** permite revisar la operación. Esta versión crea eventos sin asistentes ni invitaciones.
