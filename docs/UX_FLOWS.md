# Flujos de usuario

## 01 · Abrir y navegar ![](assets/violeta.svg)

- Abre ZEN desde la bandeja o con `Ctrl+Alt+Z`, si conservas el atajo inicial. En la isla, activa el emblema con un clic, Enter o Espacio para abrir la barra.
- Selecciona **Home**, **Codex**, **Sonido**, **Apuntes** o **Ajustes** en la isla o en la barra. El icono abre el panel con un clic, Enter o Espacio. Si ese panel ya está visible, el mismo icono repliega ZEN a la isla. Elegir otro icono cambia de panel directamente. Al replegar se conserva el contexto y el foco vuelve al icono. **Avisos** se abre desde la campana.
- Elige **Arriba**, **Izquierda**, **Derecha** o **Flotante** en **Ubicación de ZEN**, visible en la isla y en la barra. Puedes usar Tab y activar un botón con Enter o Espacio. El selector funciona con el candado puesto y conserva el panel abierto al moverlo.
- Usa el candado junto al agarre para bloquear o desbloquear el arrastre desde la isla compacta o la barra. ZEN guarda el monitor, el anclaje y la última geometría flotante. Los paneles se abren hacia el interior junto a la barra. **Contraer a isla** oculta el panel y el emblema lo recupera. Escape cierra primero el menú o diálogo activo.
- El pie reúne candado, **Más opciones** y **Contraer a isla**. El menú agrupa **Volver a mi aplicación**, **Ajustar posición**, **Siempre encima** y **Apariencia y preferencias**. La **X** y **Minimizar ZEN** llevan la ventana a la barra de tareas. Vuelve a la misma vista desde la barra, Alt+Tab o la bandeja. **Salir de ZEN** cierra la aplicación por completo.
- **Más opciones → Distribución de ventana** permite elegir ubicación y controlar la restauración al iniciar. También ofrece las dos mitades, ventana libre, maximizar y recuperar la posición anterior. **Mantener expandida** evita la contracción al perder foco.
- `Ctrl+Alt+C`, si conservas el atajo, vuelve al chat observado o fijado. **Volver a mi aplicación** usa la ventana anterior cuando puede recuperarla.

## 02 · Pedir, revisar y continuar ![](assets/azul.svg)

| Acción | Resultado |
| --- | --- |
| Escribir en Inicio y pulsar **Enviar a Codex** con chat fijado. | ZEN muestra el resultado de la entrega. Si devuelve un error, conserva el borrador. Si la entrega es incierta, revisar el chat antes de reintentar. |
| Pulsar **Abrir en Codex** sin destino fijado. | Se prepara el borrador o se ofrece el texto copiado. El usuario envía desde Codex. |
| Elegir **Resumir mis correos** o **Ver mi agenda**. | Se pide a Codex una consulta de lectura de los últimos siete días de correos no leídos en Recibidos o los próximos siete días de agenda, incluido hoy. Se conserva el borrador de Inicio. |
| Abrir **Codex → Actividad**. | Ver señales y comandos observados. Si hay un permiso, revisar la acción antes de permitir una vez, rechazar o devolverla a Codex. |
| Abrir **Codex → Resumen**. | Leer, copiar o abrir la última respuesta final disponible. Si todavía falta, se muestra un estado vacío. |
| Usar **Analizar** desde Codex. | Seleccionar archivo, página o texto, revisar lo que se enviará y confirmar. Si cambió el contexto o venció la revisión, preparar una nueva. |

**Continúa donde lo dejaste** abre un apunte reciente en su ficha o enlaza con la actividad de Codex. Los avisos destacan permisos y errores. Puedes silenciarlos durante 30 minutos y reactivarlos antes.

## 03 · Guardar y transferir apuntes ![](assets/verde.svg)

En **Apuntes**, elige una carpeta y crea una entrada con título y descripción. Añade comandos, Markdown o imágenes según el contenido. **Biblioteca de prompts** permite guardar y copiar prompts. Usa la vista Markdown para leer el contenido con formato y el editor para corregirlo. El formateador local y la preparación de una petición a Codex son acciones distintas.

El respaldo de **Ajustes → Datos y configuración** traslada la biblioteca y la configuración portable. **Apuntes → Respaldo y exportación → Restaurar biblioteca** admite los dos formatos y muestra qué recuperará antes de confirmar. El recorrido y la recuperación están en [Despliegue](DEPLOYMENT.md).

## 04 · Sonido, preferencias y estados ![](assets/turquesa.svg)

Sonido muestra el título y la fuente que publica Windows. Puedes seleccionar una sesión y usar sus controles disponibles. Cuando no hay una sesión, aparece **Sin reproducción**. En Preferencias, guarda el tema, el fondo y la densidad del cristal después de previsualizarlos. Pausa y Presentación limitan contenido y acciones sensibles según la vista.

En **Preferencias → Sonidos y avisos**, puedes activar los efectos, regular el volumen y preescuchar la apertura con el ajuste actual antes de pulsar **Guardar**. El volumen inicial es 18 %. Los perfiles anteriores heredan el ajuste de sonidos de aviso hasta que elijas un valor propio para la interfaz. Pausa, Presentación y el silencio temporal se aplican a ambos. El volumen multimedia se controla desde Sonido.

## Preferencias

Abre **Preferencias** desde **Ajustes** en la barra, Inicio o **Más opciones**. La vista recuerda la última categoría y **Volver** recupera la sección anterior. Los borradores siguen disponibles al cambiar de categoría. El guardado se confirma después de que ZEN lo aplica.

| Categoría | Ajustes y acciones |
| --- | --- |
| Apariencia | Tema, acento, fondo, opacidad, desenfoque interno y **Borde luminoso**. Puedes encender el borde, elegir una de cuatro paletas, desactivar el movimiento y ajustar la intensidad, la velocidad y el remate de los bordes acoplados. La previsualización temporal se suspende al salir de la categoría. El archivo de imagen se aplica al elegirlo. Usa un fondo predefinido o **Quitar de la vista** para dejar de mostrar la imagen y confirma los cambios con **Guardar apariencia**. |
| Isla y cápsula | Ubicación, candado, mantener expandida, restauración al inicio y acceso a distribución. Estos controles se aplican al momento. Pulsa **Guardar** para aplicar siempre encima, monitor del puntero, pantalla completa, clic fuera, contracción al perder el foco, barra de tareas y animaciones. |
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

El panel aprovecha el tamaño de la ventana. En tamaños estrechos se priorizan los iconos, los controles pueden distribuirse en dos filas dentro de la cabecera y los contenidos largos desplazan su propia zona. Comprobar foco, navegación por teclado, textos largos y movimiento reducido con los criterios de [Diseño](DESIGN_SYSTEM.md).
