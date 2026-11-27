# Flujos de usuario

[Diagramas de arquitectura y Officina](diagrams/index.html)

**HUB → Contraseñas.** La primera apertura explica que la maestra será necesaria para recuperar el acceso a las cuentas y pide crearla y confirmarla. Las siguientes muestran solo el desbloqueo; hover nunca descifra. Tras una acción explícita aparecen un buscador local, Nuevo proyecto y proyectos plegables con contador y Añadir cuenta. Se admiten servicios repetidos y edición independiente por cuenta. Renombrar y eliminar proyecto se ofrecen en su menú; eliminar muestra el total de cuentas y requiere confirmación. Las filas mantienen Copiar usuario, Copiar contraseña y el ojo; Editar y Eliminar están en el menú secundario.

Con la bóveda abierta, **Windows Hello** permite activar el acceso local tras confirmar la maestra y completar los avisos de Windows. A partir de ahí, **Desbloquear con Windows Hello** aparece junto al formulario de contraseña maestra. Cancelar el diálogo deja la bóveda bloqueada. El mismo menú dentro de la bóveda permite desactivar Windows Hello.

Las claves usan una máscara fija de ocho puntos, también al editar: se conserva la anterior sin enviarla al formulario y Cambiar contraseña abre un campo de sustitución enmascarado. El ojo revela una sola clave hasta diez segundos; otro clic, cambiar de cuenta, perder foco o navegar la ocultan. Bloquear está en la cabecera. Salir o replegar bloquea y borra la búsqueda y los formularios sin guardar. Una copia permanece disponible para pegar treinta segundos, con el mensaje Contraseña copiada, independientemente del repliegue.

## 01 · Abrir y navegar ![](assets/violeta.svg)

- Abre ZEN desde la bandeja o con `Ctrl+Alt+Z`. La cápsula pequeña es el acceso permanente.
- El orden inicial de la cápsula es **Home**, **HUB**, **Calendario**, **Métricas**, **Volumen** y **Configuración**. En Windows, con el candado abierto, deja el cursor 150 ms sobre un acceso para abrir su sección. Si el panel está recogido, se despliega durante 600 ms. Salir del icono cancela la espera inicial. El clic y el teclado actúan de inmediato. La otra aplicación conserva el foco hasta que hagas clic en ZEN.
- Los iconos del emblema, ubicación y candado se accionan con un clic o con el teclado.
- La cápsula, el contenido y sus menús cuentan como una sola zona. Tras 450 ms fuera del conjunto, el panel se recoge hacia la cápsula durante 600 ms. Volver a entrar antes de que termine restaura el panel. ZEN espera a que termine un arrastre o diálogo antes de volver a comprobar el cursor.
- La primera apertura muestra directamente la app elegida. Con el panel abierto, cambiar de app gira solo el contenido según el orden visible del menú. Bajar o avanzar a la derecha gira hacia abajo. Subir o volver a la izquierda invierte el giro. Con movimiento reducido, el cambio es instantáneo. Volver a pulsar la app activa conserva su vista.
- Cierra el candado para conservar la presentación actual y bloquear el arrastre. Si el panel está abierto, conserva su estado al pasar a otra aplicación y sigue los ajustes normales de superposición de Windows. Si solo está la cápsula, el cursor la deja recogida y un clic en un acceso abre el panel fijado. Usa el emblema o Escape para recogerlo.
- Cambiar el candado cancela el temporizador de apertura o repliegue. Al desbloquear dentro del panel, el plazo de 450 ms empieza al salir. El repliegue conserva la posición, la sección y el borrador. Si lo recoges con el cursor sobre un icono de Apps, puedes volver a ese icono o pasar directamente a otro para abrir el panel.
- El emblema oculta el panel visible o recupera la última sección. Cuando indica un permiso pendiente, abre primero su revisión. El menú contextual del emblema ofrece ubicación, distribución, siempre encima, preferencias, avisos, silencio, minimizar y salir.
- La selección marca un panel visible. Al ocultarlo, una raya discreta recuerda la última sección. Las flechas recorren los accesos según su orientación y Enter o Espacio los activan. Escape respeta primero diálogos y menús.
- El selector de **Arriba**, **Izquierda**, **Derecha** y **Flotante** permanece accesible junto al candado y al agarre. El candado bloquea el arrastre. El panel conserva su contenido al cambiar de ubicación.
- En Windows, una nueva solicitud abre **Permisos de Codex** junto a la cápsula, por encima de las ventanas del escritorio. La aplicación anterior conserva el teclado hasta que hagas clic en ZEN. Al resolver la última solicitud o cerrar la tarjeta, ZEN recupera su vista y prioridad anteriores. Usa el emblema ámbar para volver a una solicitud que siga pendiente.
- Volumen abre Sonido. Ocultar su panel libera la consulta de controles sin enviar órdenes al reproductor.
- `Ctrl+Alt+C`, si conservas el atajo inicial, vuelve al chat fijado. La X y **Minimizar ZEN** conservan la aplicación en Windows. **Salir de ZEN** termina la instancia.

## 02 · Pedir, revisar y continuar ![](assets/azul.svg)

**Officina** se abre desde la cápsula con el tamaño habitual de la ventana de ZEN. Elige un proyecto y un encargo en la cabecera. Los cuatro diseños conservan la entrada, los pasillos y los siete puestos de Grafito. Al cambiar el acabado mantienes el encuadre, incluido el zoom que hayas aplicado. Los rótulos identifican al agente y siguen su habitación al mover la cámara. Pulsa una habitación o una fila de **Equipo** para abrir su despacho. Enter y Espacio abren la habitación enfocada. **Volver a Officina** y Escape recuperan el plano y el foco de origen. En ventanas estrechas el panel se sitúa debajo de la escena. **Tablero del proyecto** da acceso a todas las tareas.

Officina abre el último diseño elegido y ocupa el espacio del plano. Grafito es el diseño inicial. La rueda y los botones − / + cambian el zoom. Arrastrar desplaza el encuadre, el porcentaje restablece la vista inicial y «Ver todo» encaja la escena completa. Con el foco en el plano se pueden usar las flechas, +, − y 0. Al abrir un puesto desde el plano o Equipo se accede al despacho, a su entrega y a sus decisiones. Escape o «Volver a Officina» recupera la cámara del plano y el foco de origen. El encuadre también se puede ajustar dentro del despacho. En **Preferencias → Officina → Diseño de oficina**, pulsa la miniatura de Grafito, Monocromo, Línea Roja o Nexo. Al volver encontrarás el mismo proyecto, el encargo seleccionado y el borrador del despacho. En esta categoría también puedes ajustar las animaciones.

Las acciones **Aprobar**, **Revisar** y **Responder** aparecen junto al puesto cuando hay una solicitud para el encargo visible. El despacho muestra la pregunta, la propuesta y el siguiente destinatario cuando están registrados. Las solicitudes de otros encargos del mismo puesto se identifican por título y pregunta. Los permisos nativos abren el flujo de revisión de Codex. **Chat global** conserva el contexto y el resultado de cada decisión.

El selector **Encargo** de la cabecera sincroniza el plano, Equipo, los resultados de cada puesto y Chat global. Al enviar una petición o crear una tarea, toda la oficina pasa al nuevo encargo. Los puestos sin participación aparecen **En espera** durante el trabajo y **Sin participación** al cierre. Elegir un encargo anterior recupera los estados y las aportaciones correspondientes.

Sobre la mesa de **Coordinación** aparece el título del encargo en vista. El rótulo cabe en una línea y el título completo se puede consultar en el selector.

El botón **Pantalla completa** abre Officina en el monitor actual. En horizontal verás los siete puestos alrededor de un pasillo transversal. Pulsa un puesto para ver su habitación entera y consultar su panel. **Cambiar de despacho** te lleva directamente a otro agente y **Volver a Officina** (Alt + ←) recupera el plano dentro de pantalla completa. Para observar el monitor y al agente de cerca, pulsa **Ampliar el puesto**. Esta vista ocupa toda la pantalla y conserva el selector de despacho. **Ver habitación completa** recupera la sala entera y su panel. El botón de salida devuelve la ventana a su encuadre anterior. El zoom del plano y el de cada habitación se guardan por separado para la ventana y la pantalla completa.

Las pantallas comparten su actividad entre la planta y el despacho. El ritmo aumenta mientras el agente trabaja. Un traspaso confirmado produce un pulso entre los puestos implicados cuando el plano está visible y las animaciones están activadas.

Escribe en el campo fijo de abajo, visible desde **Equipo** y **Chat global**. Comprueba el destinatario indicado junto al campo. **Para Coordinación** inicia la coordinación del objetivo. Si seleccionas un especialista, el puesto recibe el primer encargo directamente. Pasar el ratón sobre un escritorio solo muestra su actividad. En **Chat global** también puedes elegir el destinatario desde el campo de envío. **Enviar** abre la conversación del nuevo encargo. Junto al campo, **Activar cola** aparece cuando hay turnos listos y la cola está desactivada. Si un envío queda sin confirmar, revisa el chat correspondiente en Codex. Si todavía no hay un proyecto seleccionado, el campo pide el nombre. En **Chats en Codex** están los accesos a los chats de los puestos y a la carpeta del proyecto.

Pulsa **Elegir carpeta de trabajo** y selecciona la raíz del proyecto que quieres analizar. Al enviar el objetivo, los chats de Codex trabajan desde esa carpeta y pueden recorrer sus subcarpetas. Si la carpeta elegida corresponde a otro proyecto, el campo de envío muestra su nombre antes de cambiar de tablero. Con **Adjuntar archivos** puedes añadir hasta ocho al próximo encargo. Los adjuntos enviados aparecen en su historial y puedes retirar los que aún estén en el borrador.

En **Equipo**, cada puesto muestra su estado dentro del encargo seleccionado. El plano 3D mantiene los rótulos junto a su habitación con un estado breve y la acción pendiente cuando la hay. Pulsa un puesto o actívalo con Enter para abrir su ficha y consultar el encargo, la propuesta y la evidencia. Puedes **Aprobar y continuar**, **Pedir cambios**, **Rechazar** o **Enviar respuesta** según la solicitud. Los cambios y las respuestas necesitan texto. El rechazo confirmado cierra ese encargo. Una aprobación sensible pide revisar su alcance antes de confirmar. Escape cierra la ficha y conserva el texto durante la sesión. **Ver resultado** abre la aportación guardada y ofrece **Abrir en Codex** cuando falta el informe y se conoce el chat.

**Decisiones** abre la bandeja de todos los proyectos. Usa los filtros de proyecto y estado para ver pendientes o resueltas. Los permisos y las propuestas marcadas como bloqueantes aparecen primero, seguidos de prioridad y antigüedad. **Abrir agente** selecciona el puesto y el encargo de la fila.

En **Chat global**, abre **Actividad directa en Codex** para consultar el trabajo iniciado fuera del tablero y abrir el chat del puesto. Los estados y las conexiones del plano se calculan a partir del encargo elegido.

En un informe o un traspaso, pulsa la ruta de un archivo y elige **Abrir en VS Code** o **Mostrar en el Explorador**. El editor usa la línea indicada cuando el enlace la incluye. Si el enlace apunta a una carpeta, puedes abrirla en el Explorador. Las URL web se abren en el navegador predeterminado.

En **Opciones del proyecto → Eliminar proyecto**, confirma para quitar el proyecto seleccionado y su historial de Officina. Se conservan el proyecto y los chats de Codex, la carpeta de trabajo y los archivos adjuntos. Officina selecciona el último proyecto que se haya creado entre los que quedan.

El aviso situado sobre el equipo o la conversación indica el encargo y el siguiente paso. **Tu autorización es necesaria** aparece cuando Codex solicita un permiso y lleva a su revisión. **Cierre de Coordinación pendiente** muestra la versión aprobada por QA, cuando consta, y **Reintentar cierre** usa los informes que ya están guardados. **Ver informes** abre el detalle de la tarea.

Officina conserva la pausa o activación de la cola tras cerrar ZEN. Al volver al proyecto visible, **Esperando a Codex** identifica un envío local con reintento programado. Tras agotar los intentos, **Reintentar envío** vuelve a probar ese encargo. Si falta la confirmación de un envío, Officina busca su identidad en el chat y la cola de Codex y retoma su seguimiento cuando lo encuentra. **Revisar en Codex** permite comprobar un envío que siga sin confirmarse. La recuperación de un traspaso registrado usa el destinatario previsto. Al recuperar un cierre se repite la verificación de Coordinación y se conservan las entregas del equipo.

**Cola de Officina** muestra los encargos pendientes del proyecto visible y el puesto de cada turno. Enviar un encargo con la cola pausada lo deja en espera. Si Codex confirma que un turno fue interrumpido, Officina deja el turno disponible para consulta y continúa con el siguiente encargo habilitado.

**Chat global** ocupa todo el espacio disponible entre la cabecera y el campo de envío. El plano y la lista de agentes se consultan desde **Equipo**. El selector superior permite consultar encargos anteriores del proyecto. Cada mensaje del equipo identifica al autor y muestra un resumen de su asignación, decisión, entrega o resultado. Pulsa el mensaje para abrir su aportación completa con encabezados, listas, tablas y código. Escape cierra la ficha y devuelve el foco al control que la abrió. **Ver tarea** muestra un resumen por puesto. Despliega el puesto y la aportación que quieras consultar. Los criterios, pasos y controles de edición quedan en desplegables de la ficha. **Chats en Codex → Añadir a Proyectos de Codex** incluye **Copiar ruta de la carpeta** para registrarla como origen en Codex.

El tablero, las fichas de tareas, los resultados y el Centro de decisiones se abren dentro del panel expandido de la cápsula. El título y el botón de cierre permanecen visibles al desplazar el contenido. Si la ficha coincide con la franja de controles de Windows, su cabecera queda por debajo de los controles nativos. En pantalla completa, la ficha sigue el área de Officina.

Para adaptar la oficina, selecciona un puesto y pulsa **Editar puesto** en su ficha de actividad. El selector del diálogo incluye los seis puestos operativos y ZEN. El nombre visible se usa en el plano, Equipo y el campo de envío. Las instrucciones personalizadas se usan en los próximos turnos de ese proyecto. **Restaurar perfil predeterminado** recupera la configuración de desarrollo de aplicaciones del puesto. **Reglas fijas y formato de las respuestas** muestra las instrucciones comunes de permisos y Markdown.

Selecciona **ZEN** en la parte superior del plano o en **Equipo**. Elige una tarea con actividad guardada o las seis más recientes y pulsa **Revisar actividad**. **Instrucciones** muestra su mandato de observación. **Ver propuestas** abre el informe, la evidencia y la forma de comprobar cada mejora. Para autorizar un cambio de prompt, abre **Comparar prompts** y pulsa **Aplicar prompt**. Si el texto cambió desde la revisión, solicita una nueva. **Aprobar e iniciar seguimiento** encarga a ZEN la comprobación o preparación de la recomendación aprobada. Las aprobaciones anteriores se pueden recuperar con **Iniciar seguimiento**. La fila de ZEN en Equipo muestra el estado. **Ver seguimiento** abre su informe. También puedes **Descartar** cada propuesta.

Las detecciones y propuestas automáticas se consultan desde el puesto de **ZEN**. **Ver mejora en Coordinación** abre el encargo asociado con el resumen de cada puesto. Si la respuesta quedó fuera del formato de Officina, **Abrir respuesta en Codex** lleva al chat del encargo.

Activa **Mejoras automáticas** en el puesto de ZEN para enviar a Coordinación la última incidencia disponible y las nuevas detecciones confirmadas del proyecto. Desarrollo entrega una versión, Tester la valida y ALM puede instalarla en el destino local documentado. Desactiva esa opción o pulsa **Detener cola** para pausar los próximos turnos. Los permisos sensibles se revisan en Codex.

Al pegar texto que supera el límite de 800 caracteres del mensaje, Officina lo pliega en una tarjeta de hasta 32.000 caracteres. **Mostrar en el campo de texto** permite editarlo antes de enviar. Se puede enviar solo o con un mensaje breve. El historial conserva la tarjeta y permite leer el texto completo.

En el campo del chat, **Enter** envía y **Mayús+Enter** añade una línea. Puedes pegar capturas con **Ctrl+V** o arrastrar hasta tres imágenes al campo. La vista previa permite quitar cada imagen. Se pueden enviar con texto o solas y quedan accesibles desde el mensaje del historial. En un informe abierto, **Copiar informe** copia su contenido. En ventanas estrechas, las filas de las tablas muestran el título de cada campo junto a su valor.

Para revisar las pestañas abiertas de tu navegador habitual, pide en el objetivo la extensión de ChatGPT y el nombre del navegador si lo conoces. El Analista empieza por las pestañas accesibles. Las demás consultas usan el navegador integrado por defecto. Cuando Codex solicite acceso a un sitio o iniciar sesión, atiende la solicitud en Codex. Los encargos anteriores de revisión que quedaron esperando capturas muestran **Asignar revisión al Analista**.

Una pregunta posterior sobre lo que estás viendo o la pestaña activa reutiliza el navegador indicado en el mismo proyecto. Si una revisión se cerró con limitaciones, **Reintentar con la extensión** permite retomarla expresamente.

El maletín mantiene su contador violeta de turnos en cola. Con la cápsula replegada, también muestra los puestos activos, ! con el número de decisiones y ✓ durante tres segundos tras el último resultado confirmado. Al abrir desde !, una solicitud única lleva al puesto y varias abren la bandeja con el primer pendiente enfocado. Con ? puedes consultar la última sincronización y volver a comprobar la conexión. Los permisos de herramientas se revisan en **Permisos de Codex**.

Los proyectos previos con vínculo manual conservan su tablero y su historial. **Activar cola** permite retomar los encargos pendientes del proyecto visible. Una consulta o entrega con **Requiere actuación** pone en cola al destinatario. Los registros informativos quedan disponibles en la tarea. Si un envío queda incierto, revisa el chat antes de liberar el turno.

| Acción | Resultado |
| --- | --- |
| Escribir en Inicio y pulsar **Enviar a Codex** con chat fijado. | ZEN muestra el resultado de la entrega. Si devuelve un error, conserva el borrador. Si la entrega es incierta, revisar el chat antes de reintentar. |
| Pulsar **Abrir en Codex** sin destino fijado. | Se prepara el borrador o se ofrece el texto copiado. El usuario envía desde Codex. |
| Elegir **Resumir mis correos** o **Ver mi agenda**. | Se pide a Codex una consulta de lectura de los últimos siete días de correos no leídos en Recibidos o los próximos siete días de agenda, incluido hoy. Se conserva el borrador de Inicio. |
| Abrir **Codex**. | Elegir un chat observado entre los que necesitan permiso, los que están en curso y los recientes. Actividad distingue el estado del chat, su hora y la última acción. La cronología muestra los comandos recibidos. Expande una fila para ver el detalle disponible. La pestaña **Resumen** reúne las peticiones y resultados del chat fijado en la misma ventana. Usa las flechas izquierda y derecha para cambiar de pestaña con el teclado. |
| Ver un permiso pendiente en la cápsula. | Lee el comando y el chat y elige **Permitir esta vez** o **Rechazar**. Si hay varias solicitudes, cambia entre ellas con el selector. **Detalles** permite copiar la solicitud completa y consultar su caducidad. **Abrir en Codex** entrega la solicitud al diálogo habitual del chat de origen. |
| Usar **Analizar** desde Codex. | Seleccionar archivo, página o texto, revisar lo que se enviará y confirmar. Si cambió el contexto o venció la revisión, preparar una nueva. |

En Home, las píldoras de **Codex**, **HUB** y **Sonido** abren la actividad o los permisos, la biblioteca y el reproductor, respectivamente. Sonido indica el título y si hay una sesión en reproducción o en pausa.

**Clima** muestra la temperatura actual y la previsión de Dublín por defecto. Consulta la máxima, la mínima y la lluvia del resto de hoy o de mañana, según los tramos disponibles. En **Configurar clima** puedes elegir otra ciudad indicando su país, por ejemplo «Madrid, ES». Una instalación nueva solicita la clave de OpenWeather una vez.

El saludo a Samm cambia con la hora de Windows. El consejo usa el pronóstico vigente y el panel identifica una previsión anterior cuando ya ha caducado. **Ver calendario** lleva a la agenda desde el próximo compromiso disponible. Home muestra su fecha y hora y reserva los títulos y las descripciones para Calendario.

En **Preferencias → Resumen diario**, puedes desactivar el saludo, la agenda o las animaciones meteorológicas. Configura días habituales de oficina y excepciones por fecha. Un campo confirmado o las etiquetas `[oficina]` y `[teletrabajo]` identifican un evento explícito. Una rutina o una mención en texto aparecen como previsión o indicio. Si hay confirmaciones incompatibles, Home muestra «Modalidad sin confirmar».

La tarjeta **Sueño** muestra la duración, la puntuación y la fecha de la última noche registrada por Oura. Si queda pendiente la sincronización de anoche, indica la fecha del dato disponible. **Ver métricas** abre la sección de Métricas con el historial.

En espacios estrechos, el selector **Chats** recoge la lista. **Filtros** busca acciones del chat seleccionado o limita la cronología a comandos o archivos. Los comandos de otros chats locales se pueden revisar desde **Permisos** cuando ZEN ha observado su turno y dispone del comando completo. Las demás solicitudes abren el chat de origen. Las peticiones de Home y Calendario se envían al chat fijado.

En Home, el editor **Petición para Codex** está al final, debajo de Clima, Hoy, Sueño y los accesos a módulos. Puedes silenciar los avisos durante 30 minutos o reactivarlos desde el menú del emblema.

## 03 · Guardar y transferir apuntes ![](assets/verde.svg)

**HUB** abre en **Biblioteca de prompts**. En **Espacio de trabajo** están también **Contraseñas**, **Templates** y **Traductor**. Debajo de **Sistema**, que agrupa **Configuración** y **Respaldo y exportación**, está **Bloc personal** con **Apuntes** y **Pizarra**.

En Windows, con el candado abierto, deja el cursor 150 ms sobre una sección del menú de HUB para abrirla. El clic y la activación por teclado siguen disponibles al fijar la isla o al editar. Si hay un borrador pendiente en la biblioteca, cambiar mediante clic o teclado conserva la confirmación habitual.

En **HUB → Apuntes** puedes escribir directamente en una hoja continua. Enter añade un salto de línea y la hoja conserva el texto, el cursor y el punto de desplazamiento. Mientras escribes con el editor enfocado, apartar el ratón mantiene el panel abierto. Puedes cambiar de sección o recoger ZEN. Si falla el guardado, el texto sigue disponible en el editor y puedes reintentar.

**HUB → Pizarra** abre el lienzo listo para dibujar. Elige grosor, color o **Goma** y arrastra. Al elegir un grosor vuelves al último color del pincel. **Deshacer** o **Ctrl+Z** recupera el estado anterior al último gesto. **Reiniciar pizarra** pide confirmación antes de vaciarla. Al soltar, el dibujo se guarda y la isla reanuda su comportamiento habitual con el puntero.

En **Traductor**, pega el texto y pulsa **Enter** desde Original o el botón **Traducir**. Usa **Mayús + Enter** para una nueva línea. **Intercambiar idiomas** cambia entre español e inglés. **Copiar** copia el resultado. ZEN recuerda la dirección de traducción y limpia los dos campos al salir. La clave se configura la primera vez y se puede cambiar o quitar desde **Configurar Azure**.

En HUB, selecciona **Buscar en la biblioteca** para buscar apuntes por contenido, título o carpeta. El resultado se abre directamente en el lector. **Nuevo** permite crear un apunte o prompt y gestionar las carpetas. La **Biblioteca de prompts** permite guardar y copiar prompts y alternar entre Markdown y texto.

El filtro de apuntes y el editor ofrecen las mismas carpetas. Las categorías de versiones anteriores aparecen cuando ya contienen entradas del tipo que estás consultando. Puedes crear una carpeta vacía y empezar a usarla desde **Nuevo → Carpeta**.

El respaldo de **Ajustes → Datos y configuración** traslada la biblioteca y la configuración portable. **HUB → Respaldo y exportación → Restaurar biblioteca** admite los dos formatos y muestra qué recuperará antes de confirmar. El recorrido y la recuperación están en [Despliegue](DEPLOYMENT.md).

En **Preferencias → Datos y configuración → Sincronización entre equipos**, crea un perfil compartido en tu carpeta de Syncthing o vincula el equipo con el código de otro ZEN. Desde esa sección puedes sincronizar, elegir una versión en conflicto y activar el intercambio de la bóveda cifrada. [Guía](PERSONAL_SYNC.md)

En **HUB → Templates**, busca por nombre, descripción o etiqueta, filtra por área de trabajo o etiqueta o elige **Favoritos**. Abre una tarjeta, elige **Power Apps Canvas** o **React + TypeScript** y pulsa **Copiar prompt**. Puedes ampliar la **Referencia visual** y consultar el prompt de la plataforma seleccionada. **Adaptar a mi proyecto** sustituye localmente los campos que rellenes y conserva las variables pendientes entre llaves. Puedes copiar el original o el texto adaptado. Las 30 referencias incluidas muestran sus interfaces de ejemplo en inglés. La galería recupera sus filtros y su posición al volver del detalle.

**Nuevo template** y **Editar** permiten guardar el texto, las etiquetas, una referencia de hasta 4 MB y la atribución disponible. Puedes duplicar el registro para crear una variante. El editor guarda el borrador aparte y pide confirmación antes de descartarlo o de eliminar un template.

## 04 · Sonido, preferencias y estados ![](assets/turquesa.svg)

Sonido muestra el título y la fuente que publica Windows. Puedes seleccionar una sesión y usar sus controles disponibles. Cuando no hay una sesión, aparece **Sin reproducción**. En Preferencias, guarda el tema, el fondo y la densidad del cristal después de previsualizarlos. Pausa y Presentación limitan contenido y acciones sensibles según la vista.

En Sonido, arrastra **Volumen del sistema** entre el 0 y el 100 % o ajusta el nivel con el teclado. El control actúa sobre la salida predeterminada de Windows, incluso sin reproducción. Si Windows está silenciado, la tarjeta lo indica y conserva ese estado.

El fondo, el cristal y el desenfoque guardados se aplican a todas las secciones. En **HUB → Configuración**, **Tema del lector** conserva el contraste claro u oscuro de apuntes y prompts; la navegación y Templates siguen la apariencia general de ZEN.

El **Borde luminoso** de Apariencia controla tanto la cápsula como el contorno completo del panel desplegado. Los dos usan la misma paleta, intensidad y velocidad. La cápsula conserva el pulso al replegar el panel.

En **Preferencias → Sonidos y avisos**, puedes activar los efectos, regular su volumen y preescuchar la apertura con el ajuste actual antes de pulsar **Guardar**. El volumen inicial de los efectos es 18 %. Los perfiles anteriores heredan el ajuste de sonidos de aviso hasta que elijas un valor propio para la interfaz. Pausa, Presentación y el silencio temporal se aplican a ambos.

## Preferencias

Abre **Preferencias** desde **Ajustes**, Inicio o el menú del emblema. La vista recuerda la última categoría y **Volver** recupera la sección anterior. Los borradores siguen disponibles al cambiar de categoría. El guardado se confirma después de que ZEN lo aplica.

| Categoría | Ajustes y acciones |
| --- | --- |
| Apariencia | Tema, acento, fondo, opacidad del cristal de 0 a 100 %, desenfoque interno y **Borde luminoso**. Puedes encender el borde, elegir una de cuatro paletas, desactivar el movimiento y ajustar la intensidad, la velocidad y el remate de los bordes acoplados. La previsualización temporal se suspende al salir de la categoría. El archivo de imagen se aplica al elegirlo. Usa un fondo predefinido o **Quitar de la vista** para dejar de mostrar la imagen y confirma los cambios con **Guardar apariencia**. |
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

Para consultas rápidas, haz clic derecho en el emblema de ZEN y marca **Modo simple**. El tamaño del panel se ajusta a la sección. En Home, **Clima**, **Hoy** y **Sueño** aparecen primero y la petición para Codex se abre desde su desplegable. Calendario muestra el próximo evento y la agenda del día. El mes y los calendarios se pueden desplegar. Métricas muestra las lecturas de hoy con acceso al historial, y Sonido mantiene a mano el volumen y la reproducción. Preferencias ofrece un selector de categoría.

HUB se abre en su tamaño e interfaz habituales. Al cambiar de HUB a otra sección, vuelve la vista compacta. Desmarca **Modo simple** en el menú para recuperar el tamaño habitual de toda la app. El ajuste dura hasta que sales de ZEN. Usa **Presentación** si quieres ocultar contenido privado.


## 06 · Calendario

En Home, la tarjeta **Hoy** muestra el día de la semana y la fecha del equipo. Pulsa la tarjeta para abrir el calendario.

Calendario muestra la fecha seleccionada, el mes de lunes a domingo y la agenda del día. Los puntos señalan eventos, el contorno identifica hoy y el fondo de acento identifica la selección. **Hoy**, los controles de mes y **Actualizar** conservan su función independiente.

**Próximo evento** muestra el primer evento que todavía no ha empezado entre los eventos locales y sincronizados disponibles de los calendarios activos. Pulsa el evento para seleccionar su fecha y ver la agenda de ese día.

**Solo en ZEN** guarda eventos locales de forma persistente. El título y las fechas son obligatorios. Los horarios inexistentes o ambiguos por cambio de hora se rechazan con una explicación. Los eventos de día completo conservan fechas y fin exclusivo.

Con chat fijado, la primera apertura de un intervalo puede solicitar su consulta a Codex. El conector debe estar disponible en ese chat. ZEN incorpora únicamente una respuesta estructurada validada con el identificador de la petición. Si el chat tarda en contestar, ZEN muestra el aviso y todavía acepta la respuesta mientras esa consulta siga vigente. Actualizar conserva la copia anterior y los eventos locales.

Los destinos externos aparecen cuando Codex devuelve sus identidades y permiso de escritura. Guardar envía una solicitud por el mismo puente. El estado **Creado** requiere un identificador confirmado del proveedor. Una respuesta incierta conserva el formulario y bloquea la repetición automática. Mientras falta confirmación, los campos de la solicitud externa quedan bloqueados. Puedes elegir expresamente **Solo en ZEN** para guardar una copia local; la solicitud externa sigue pendiente y se informa de ello. **Comprobar en Codex** permite revisar la operación. Esta versión crea eventos sin asistentes ni invitaciones.

## 07 · Métricas de Oura

Pega el **Client ID** y pulsa **Conectar Oura**. ZEN lo recuerda en este equipo y lo rellena al volver a conectar. **Desconectar Oura** elimina la sesión y las métricas guardadas. El Client ID sigue disponible para reconectar.

**Hoy** muestra las últimas medidas disponibles de Sueño, Disposición y Actividad. Cada tarjeta indica su día local de Oura y su última consulta correcta. Selecciona una tarjeta para ver los últimos siete días, con el más reciente arriba. Un hueco indica que ese valor aún no está disponible.

Si falta el sueño principal asignado a hoy, la tarjeta indica «Sueño de anoche pendiente de sincronizar» y fecha la última noche disponible. Abre Oura en el móvil para sincronizar el anillo. ZEN consulta automáticamente los recursos con datos pendientes en intervalos de cinco minutos y espacia los reintentos si hay errores. **Actualizar** consulta Oura Cloud. La selección de una tarjeta o el acceso desde la cápsula usa la caché.

**En la cápsula** permite elegir solo el icono o la duración del sueño. Si la duración corresponde a una noche anterior, la cápsula indica su fecha.
