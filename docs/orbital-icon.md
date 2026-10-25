# Núcleo orbital de ZEN

Diseño solicitado el 24/10/2026 en Figma para sustituir el monograma Z. Archivo editable: [ZEN · Núcleo orbital](https://www.figma.com/design/AErBIlpaqrvOMM8XNfdCxn?node-id=2-342).

La lámina de revisión muestra diez variantes: Disponible, Procesando, Ejecutando, Necesita permiso, Turno terminado, Error observado, Interrumpido, Por comprobar, En pausa y Desconectado. Los símbolos complementan el color. La familia incluye una marca simplificada de 16 px, comparación de tamaños 16/24/32/48/64, un componente estático de 256 px para el ejecutable y una vista ilustrativa de la cápsula.

El núcleo blanco, dos órbitas abiertas y un satélite conservan los colores grafito/violeta de la app. La traza integrada tiene cuatro variantes Count=0..3 para representar hasta tres eventos observados; no son fases ni porcentaje. Se conserva la revisión explícita de permisos y la actividad completa de Codex. Los componentes reutilizan variables semánticas enlazadas a primitivas y con sintaxis CSS. No hay recursos de Coucou ni contenido privado del proyecto en Figma.

Se han comprobado las diez variantes, el centrado, los tamaños y las variables, y revisado la captura final de la lámina. Los maestros están fuera de la lámina de revisión. El estado local de la tarea y las imágenes de revisión quedan en release/orbital-design, ignorado por Git.

Se han guardado fotogramas clave en Figma: respiración del núcleo al procesar, giro orbital al ejecutar y aparición breve al terminar. Permiso y error permanecen estables. La reproducción física no está validada. Hay una discrepancia pendiente: el giro manual guardado es de -360 grados, pero get_motion_context devuelve 225 grados; también difiere la opacidad final del pulso. El componente de variantes comparte un ciclo repetido, mientras que el destello final debe ser de una sola vez al integrarse.

Figma alcanzó el límite de llamadas MCP del plan Starter durante el ajuste de esa discrepancia; la última modificación fue rechazada y no se cambió el archivo. No se sustituyen los datos por una animación inventada ni se elude el límite. El diseño estático queda disponible para revisión y la integración en la app pendiente de resolver el movimiento. No se han modificado código, iconos, hooks, configuración ni EXE de ZEN en esta petición.

## Implementación autorizada después de revisar el diseño

El usuario confirma «me gusta implementalo». Se reutilizan las respuestas de diseño de alta fidelidad ya obtenidas y sus SVG originales descargados; no hacen falta nuevas llamadas a Figma ni se elude su límite. Los catorce SVG de `public/icons/orbital` permanecen sin redibujar. Las capas conservan sus dimensiones nativas y se escalan mediante el contenedor del icono. `app.svg` se utiliza sin cambios como origen de los nueve tamaños PNG/ICO de Windows, tanto para el ejecutable como para la bandeja y las ventanas.

El movimiento local conserva la intención y los fotogramas que se guardaron al crear el diseño: vuelta completa en 3,2 segundos, núcleo con opacidad 1 → 0,65 → 1 en 2,4 segundos y destello único de 0,7 segundos al recibir el final de un turno. Es una corrección explícita de la exportación recortada de Figma, cuya lámina no se ha modificado. No se incorpora una dependencia de animación. No hay GIF, consultas al modelo ni peticiones de red decorativas.

El icono lee el estado existente del chat fijado y su traza acotada. Nunca toma trabajo de otra conversación ni confunde un diagnóstico auxiliar fallido con la ejecución observada. Los permisos tienen prioridad, su símbolo permanece estático y pulsar el icono solo conserva el menú actual; la revisión de permisos sigue en su panel. Las tres marcas representan eventos recibidos, no progreso, y se ocultan en Presentación. Los estados desconocido, interrumpido, desconectado y pausa tienen símbolos propios. El icono no muestra contenido de las herramientas.

La animación se detiene con la preferencia de movimiento reducido o al ocultar la ventana. El destello no se reproduce al cargar un estado terminado, restaurar la ventana, repetir Stop ni recibir otro final tardío del mismo turno. La deduplicación del destello es solo de presentación y no modifica sesiones, avisos o autoridad.

Build y 477 pruebas en 53 archivos pasan. El recorrido Electron aislado verifica los SVG locales, el pulso, un ciclo completo de giro, la traza, permiso estático, destello de una vez, restauración, final repetido/tardío y Presentación, conservando las pruebas anteriores de integraciones. Los nueve tamaños de icono de Windows cargan y el icono leído por el shell coincide con el recurso esperado. Las capturas del recorrido se han revisado visualmente. Son eventos sintéticos de prueba, sin operaciones reales de correo/música ni entradas físicas del navegador; continúa vigente el límite físico anterior de Computer Use.

La entrega local sustituye únicamente Desktop/ZEN.exe tras verificar el portable extraído, con respaldo dentro de release. No se reinstalan hooks ni se cambian confianza, chat fijado, configuraciones históricas, credenciales o conectores. No se hace commit ni push en esta petición. Evidencias de entrega y límites en docs/evidence/orbital-deployment.json; manifiesto local de los recursos en release/orbital-design/asset-manifest.json.
