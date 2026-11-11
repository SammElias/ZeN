# Requisitos de producto

## Producto, problema y público

ZEN es un asistente de escritorio para Windows que muestra qué está haciendo Codex y permite volver a su chat, enviarle una petición o consultar su respuesta. Va dirigido a quien usa Codex en paralelo con otras aplicaciones y quiere seguir trabajando sin alternar ventanas para cada aviso. Sin ZEN, ese usuario revisa Codex manualmente y gestiona la reproducción desde el sistema o la aplicación de origen.

## Objetivos e historias de usuario

- Como usuario de Codex, quiero distinguir actividad, permiso pendiente y turno terminado en una cápsula siempre accesible.
- Quiero enviar una petición al chat que ya he fijado y comprobar si quedó en cola. Si todavía no he fijado uno, quiero preparar el borrador y decidir el envío en Codex.
- Quiero consultar la última respuesta final del chat fijado con el formato de sus listas, tablas y código.
- Quiero ver lo que reproduce Windows mientras sigo viendo el estado de Codex y elegir otra fuente si lo necesito.
- Quiero ocultar detalles sensibles al presentar y conservar mis preferencias al reiniciar.

## Alcance y criterios de aceptación

| Función | Entrada y resultado | Criterio y casos límite |
| --- | --- | --- |
| Cápsula y panel | Mostrar, mover, desplegar, navegar | Una ventana. Cambiar de sección conserva el panel; repetir la sección activa recoge la cápsula. El estado de Codex y Sonido coexisten. |
| Petición de Home | Texto y destino validado → cola o borrador | El mensaje de éxito corresponde al recibo del chat; sin destino se prepara un borrador. Una respuesta incierta no activa reenvíos. |
| Codex | Eventos, chat fijado y vista elegida → Actividad o Resumen | Actividad muestra señales observadas. Resumen muestra la última respuesta final disponible solo en su propia vista. Permisos requiere una decisión explícita. |
| Analizar | Archivo elegido, página o texto → revisión y envío | El usuario revisa el contenido y el chat antes de enviarlo. Una revisión vencida o un archivo cambiado requieren repetir la selección o revisión. |
| Sonido | Sesión multimedia publicada por Windows → título, fuente y controles disponibles | El seguimiento normal es automático. Si no hay sesión, se muestra un estado vacío; los controles solo actúan sobre la fuente seleccionada. |
| Apariencia y privacidad | Opciones elegidas y modo → superficie guardada o detalles ocultos | El fondo se recorta dentro de la cápsula. Pausa y Presentación retiran información según la política antes de entregarla al renderer. |

## Límites y prioridades

Lo imprescindible es la lectura de estado, la petición al chat fijado, la recuperación de la respuesta y Sonido. Preferencias, avisos y análisis seleccionado completan el flujo. Correo y agenda se solicitan en Codex, con los conectores que allí estén disponibles. ZEN no ofrece chat ni modelos propios, conexión directa con Gmail/Calendar, captura de audio, ni automatización autónoma del navegador.

## Éxito y definición de terminado

Verificar el envío al destino exacto, recuperación tras reinicio, actualización de Sonido sin clics, y cero exposición de detalles en las superficies prohibidas. Son criterios de aceptación; no hay metas de telemetría de producto. Para cerrar un cambio: comprobar sus flujos, probar errores y privacidad, compilar si afecta al producto y actualizar los documentos afectados.

Se presupone Windows con Codex instalado y una sesión multimedia publicada cuando hay metadatos. Queda por decidir si el mapa de arquitectura tendrá una vista dentro de ZEN; el HTML de este blueprint se abre por separado.
