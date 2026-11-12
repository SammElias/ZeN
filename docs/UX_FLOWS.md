# Flujos de usuario

## 01 · Abrir y navegar ![](assets/violeta.svg)

- Abre ZEN desde la bandeja o con `Ctrl+Alt+Z`, si conservas el atajo inicial. La cápsula muestra Codex y Sonido al mismo tiempo.
- Selecciona **Inicio**, **Codex**, **Sonido** o **Apuntes**. Cambiar de sección conserva el panel desplegado. Pulsar de nuevo la activa lo recoge. **Avisos** está en la campana.
- Arrastra desde el agarre. Las flechas alinean la cápsula a izquierda, centro o derecha en la parte superior del monitor actual. El candado controla si permanece encima. La **X** oculta ZEN. **Salir** cierra el proceso desde la bandeja.
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

El respaldo de **Preferencias → Datos y configuración** traslada la biblioteca y la configuración portable. Al importar, ZEN muestra qué sustituirá y pide confirmación. El recorrido y la recuperación están en [Despliegue](DEPLOYMENT.md).

## 04 · Sonido, preferencias y estados ![](assets/turquesa.svg)

Sonido muestra el título y la fuente que publica Windows. Puedes seleccionar una sesión y usar sus controles disponibles. Cuando no hay una sesión, aparece **Sin reproducción**. En Preferencias, guarda el tema, el fondo y la densidad del cristal después de previsualizarlos. Pausa y Presentación limitan contenido y acciones sensibles según la vista.

| Estado | Comportamiento esperado |
| --- | --- |
| Cargando | La petición o lectura muestra progreso cuando existe y evita duplicar el envío. |
| Éxito | «En cola» acredita la entrega. «Turno terminado» corresponde a actividad observada. La importación informa del respaldo anterior. |
| Error | La vista muestra el fallo y una acción disponible. El borrador se conserva si no se pudo entregar. |
| Vacío | Una vista sin sesión, actividad, notas o respuesta muestra su estado y mantiene accesible la navegación. |

## 05 · Tamaño y accesibilidad ![](assets/rosa.svg)

El panel usa el alto disponible del monitor. En tamaños estrechos se priorizan los iconos etiquetados, los controles pueden distribuirse en dos filas dentro de la cabecera y los contenidos largos desplazan su propia zona. Comprobar foco, navegación por teclado, textos largos y movimiento reducido con los criterios de [Diseño](DESIGN_SYSTEM.md).
