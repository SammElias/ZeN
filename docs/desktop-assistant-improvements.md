# Asistente de escritorio — 24/10/2026

Implementación de las ideas 1, 2, 3 y 6 elegidas por el usuario. Se mantiene la base de compañero: cápsula Z, chat y proyecto fijados y ejecución exclusivamente en Codex.

## Volver a la aplicación

La flecha de retorno curva de la cápsula y los paneles, y la opción de bandeja «Volver a mi aplicación», vuelven a la última ventana de trabajo observada antes de revisar Codex. El controlador nativo escucha eventos de primer plano y geometría; no lee títulos, contenido, direcciones web, imágenes, teclado ni cursor. Excluye ZEN, Codex y superficies del sistema. Conserva en RAM el identificador de ventana, proceso y fecha de inicio; no se persisten ni publican.

El retorno requiere un clic explícito. Un proceso auxiliar de una sola operación vuelve a verificar ventana, PID y fecha de inicio antes de restaurarla. No simula teclas, no eleva privilegios ni fuerza el foco con atajos internos de Windows. Una ventana cerrada o reutilizada se descarta. Si Windows rechaza el cambio, ZEN lo informa y permite recurrir a Alt+Tab. No hay retorno automático al terminar un turno.

## Resumen observado

La ficha final solo aparece tras `Stop`. Conserva número de acciones e intervalo solo si se recibió el inicio. En Actividad se añaden los archivos nuevos, modificados y eliminados detectados por comparación local de metadatos. Se muestran hasta treinta rutas y el número restante; «Abrir ubicación» selecciona el archivo en el explorador o abre su padre existente si ya no está.

Hay dos lecturas acotadas por turno recibido: inicio y final. Se listan archivos con un comando Git fijo de solo lectura, sin shell, filtros ni fsmonitor, y se comparan tamaño, fechas y modo mediante `lstat`. No se leen contenidos, no se suben archivos ni se vigila continuamente el proyecto. Máximo 2.000 entradas y 1 MiB de listado; una comparación incompleta o sin inicio se declara no disponible. Se rechazan rutas externas, absolutas, enlaces y junctions; el IPC solo acepta una ruta exacta del resumen vigente. Los resultados tardíos no pueden aparecer en otro turno y pausar invalida la comparación pendiente.

La UI identifica el alcance: los cambios pueden incluir ediciones externas y cambios de metadatos. No atribuye todo a Codex ni deduce que una prueba pasó porque observó un comando o un final de turno. Los comandos efectivamente recibidos permanecen en el recorrido de actividad, sin copiar respuestas del modelo.

El protocolo instalado no ofrece los elementos finales del turno sin reanudar o bifurcar la conversación. No se realiza ninguna de esas operaciones para obtener un resumen, ni se trata una copia independiente del app-server como telemetría en directo. Referencia consultada: [protocolo oficial del app-server](https://learn.chatgpt.com/docs/app-server).

## Presentación

El botón con pantalla activa y desactiva Presentación desde la cápsula o cualquier panel. La preferencia se guarda. El proceso principal elimina títulos, rutas, código, nombres de herramientas y aplicaciones y los detalles del resumen antes de enviarlos por IPC. Los errores enviados y los mensajes locales de la UI también se ocultan. Los snapshots tienen una revisión creciente para impedir que una respuesta antigua reponga datos visibles después de activar el modo.

Continúan estado, contador de avisos, recepción y permisos pendientes. Sonido y notificaciones de Windows quedan silenciados sin cambiar sus preferencias y no se reproducen al salir. No se permite aprobar o rechazar una acción oculta: el panel ofrece «Revisar en Codex», devolviendo la decisión pendiente antes de abrir el chat exacto. El main también rechaza decisiones de paneles antiguos. Presentación no oculta Codex, el explorador u otras aplicaciones que el usuario abra explícitamente ni borra el portapapeles existente.

## Foco y monitores

La cápsula se invoca sin pedir foco, por defecto en el monitor del puntero; la preferencia permite conservar el monitor anterior. Cada pantalla recuerda su borde y posición. Los paneles se abren en el mismo monitor y se limitan al área útil, también al desconectar pantallas o cambiar escala y orientación. La geometría usa DIP y la conversión física oficial de Electron, admitiendo orígenes negativos y escalas diferentes: [API screen](https://www.electronjs.org/docs/latest/api/screen).

El observador detecta una ventana que ocupa el monitor completo. Por defecto oculta la cápsula en ese monitor y la recupera sin foco al salir. Una invocación explícita permite mostrarla; Ocultar mantiene su prioridad y no se deshace al cerrar la aplicación de pantalla completa. Ningún evento de Codex abre o enfoca paneles. No se fuerza una superposición sobre juegos exclusivos.

## Validación y entrega

Build TypeScript/Vite y auxiliares .NET; 455 pruebas en 51 archivos, con cuatro workers. Recorrido Electron con hooks sintéticos en perfil aislado: redacción por IPC en todos los paneles, rechazo de permisos ocultos, devolución exacta a Codex, resumen, límites de ubicaciones, preferencias, observador nativo real y rechazo de una ventana inexistente. Pruebas de metadatos con Git real, junctions y cancelación; geometría de pantallas pequeñas, negativas y suspensión por pantalla completa mediante fixtures.

Las pruebas sintéticas no acreditan el gesto físico de retorno, los cambios físicos de DPI/monitores, la superposición en juegos exclusivos ni la entrega audible de sonido o notificaciones. No se inyectan eventos en el receptor de producción. No se reinstalan hooks, no se altera confianza, no se envía trabajo nuevo a Codex y los JSON históricos de agente/Live permanecen intactos.

Se compila y entrega únicamente `Desktop/ZEN.exe`, con respaldo dentro de `release/`. Las evidencias locales quedan en `docs/evidence/desktop-assistant-deployment.json`, `docs/evidence/companion-native.json` y `docs/evidence/single-executable.json`; no se publican capturas, telemetría, EXE ni perfiles. Esta petición no incluye un nuevo commit o push.
