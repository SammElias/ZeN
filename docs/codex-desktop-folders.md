# Análisis de carpetas en Codex del escritorio

Petición del 01/10/2026: los análisis de carpeta se delegan a Codex del escritorio usando la suscripción del usuario, y las confirmaciones de ZEN deben admitir voz y chat. La comprobación inicial encontró que las carpetas se leían y añadían como contexto del agente guardado ZEN; Codex solo construía proyectos en un harness de API y las escrituras se confirmaban por botón.

## Flujo actual

1. Seleccionar «Carpeta del proyecto» desde el clip. No se lee ni sube su contenido en este paso.
2. Enviar qué se quiere analizar por chat, o revisar/confirmar la petición autenticada de voz. ZEN revalida la carpeta seleccionada antes de abrirla; deduplica la petición y serializa la apertura con otros efectos.
3. Abrir `codex://new?path=…&prompt=…` mediante el protocolo de Windows. Solo se pasan la ubicación y la petición humana, con una indicación breve de leer archivos pertinentes, excluir secretos/dependencias/generados y no ejecutar/modificar/instalar ni usar subagentes. No se transfieren contenidos, memoria personal ni imágenes al agente ZEN.
4. Codex muestra la carpeta y la petición en su compositor. **Hay que pulsar Enviar en Codex.** El enlace público no manda la petición automáticamente; ZEN informa «preparada» y queda esperando, nunca declara análisis terminado. [OpenAI Docs: enlaces de chats](https://learn.chatgpt.com/docs/reference/commands#chats).

Si falta la asociación del protocolo o la apertura falla, se informa el fallo sin usar el agente API como alternativa. Las peticiones de análisis de carpetas sin carpeta adjunta piden seleccionar una localmente. «Solo localmente» conserva la lectura local explícita de fragmentos, sin un análisis por modelo. Seleccionar otra carpeta, quitarla o renovar la captura invalida una petición de voz pendiente que dependía de ese contexto.

Los análisis no crean una sesión Agents API de ZEN y no mandan un resumen a otro modelo después. Con carpeta o confirmación pendiente, pulsar para hablar evita renovar/subir una captura incidental. La voz Live sigue siendo API de pago si se usa; el aviso breve de que la carpeta pertenece a Codex es contexto temporal y no modifica `config/live-session.json`. El agente guardado y su configuración remota permanecen intactos. El flujo previo de **crear proyectos nuevos** con el harness alojado sigue separado y factura por API; esta petición cambia el análisis de carpetas, no sus herramientas remotas.

Codex del escritorio usa la sesión iniciada en esa aplicación; ZEN no copia credenciales ni fuerza un método de autenticación. Usar la suscripción no elimina el consumo ni los límites de Codex. No se midió un ahorro comparativo ni se garantiza una cuota de facturación. La indicación de solo lectura en la petición no sustituye la configuración de permisos de la aplicación Codex; ZEN únicamente abre el compositor y no ejecuta código local.

## Confirmaciones por voz y chat

Las aprobaciones de archivo nuevo, exportación de proyecto y petición de voz revisada comparten una autoridad local. La propuesta/destino se muestra con un código de cuatro dígitos; se puede escribir **«confirmo 1234»**, decir **«confirmo uno dos tres cuatro»** o usar su botón existente. No hay que confirmar dos veces.

El código se vincula a la propuesta exacta, caduca a los cinco minutos y se consume antes de ejecutar. Cambiar destino/contenido, cancelar, Detener o reiniciar invalida el permiso. No se reutiliza el código en el proceso y un fallo no repite la operación. «Sí», frases negadas, citas, códigos parciales y texto adicional no conceden autorización ni se envían a otro modelo para interpretarlos.

En voz hay que esperar a ver la frase/código completos en la transcripción y **soltar pulsar para hablar o silenciar explícitamente el micrófono**. Ese gesto sella la versión autenticada de la transcripción; no se autoriza desde un delta ni por detectar una pausa. Escape, perder foco, cancelar el puntero, ocultar y desconectar no confirman. Si la transcripción todavía no llegó completa, se informa y no se reintenta ni ejecuta automáticamente.

La última petición revisada se conserva durante la frase separada de confirmación, y una petición nueva la sustituye. Los documentos y las respuestas del modelo no acceden a la autoridad de confirmación. Las confirmaciones de ZEN no controlan el botón Enviar ni los permisos internos de otra aplicación: ese paso sigue en Codex.

## Evidencia y límites

- Build y **254 pruebas en 29 archivos**: URL/petición exactas, apertura/cancelación/fallo sin alternativa API, selección/revocación de carpeta, códigos/palabras/negaciones/citas, caducidad, cambios de destino, un uso incluso tras fallo y sellado explícito de voz con transporte simulado.
- [Electron Windows](evidence/codex-desktop-electron.json): carpeta sintética por IPC real deriva al abridor simulado, estado de espera y sin contenido del archivo en el enlace. Confirmación por chat crea/verifica un archivo sintético mediante la cola Windows; otra petición con el mismo código se bloquea. Clave ausente en el smoke, ninguna llamada API.
- [Interfaz Edge](evidence/codex-desktop-ui.json): código e instrucciones visibles, confirmación de chat sin captura nueva y estado de espera en el panel Codex. Distribución y regresiones conservadas.
- Windows tiene `OpenAI.Codex` instalado y su manifiesto registra `codex`. La consulta de metadata de Electron no resolvió esa asociación Store, por eso no se usa como bloqueo previo; la apertura utiliza directamente el protocolo del sistema.
- [Portable](evidence/portable-interface.json) y [copia al escritorio](evidence/codex-desktop-install.json): arranque e IPC del ejecutable real, hashes verificados; sin claves incluidas.

Pendiente: apertura física con carpeta/petición en la aplicación Codex y envío con la sesión de suscripción, reconocimiento/acústica reales y recorrido de voz completo. Las pruebas de transporte y abridor simulado no sustituyen esos recorridos. No se ejecutó un análisis remoto para esta verificación ni se acreditó el objetivo general.
