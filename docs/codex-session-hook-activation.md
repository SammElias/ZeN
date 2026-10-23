# La sesión abierta no aparece en ZEN — 22/10/2026

**Actualización posterior, 20:07 de Madrid:** recepción genuina de este mismo chat/carpeta confirmada en el EXE de producción, sin inyectar eventos. Su propio estado devuelve `working`, identificador y carpeta exactos, última señal reciente, cuenta ChatGPT y 10/10 hooks confiados/habilitados. Evidencia: `docs/evidence/companion-fixed-chat-live.json`; alcance actual en `docs/codex-fixed-chat.md`. No se cambió confianza ni se reinició Codex en esta comprobación. Las conclusiones de recepción pendiente de abajo describen el diagnóstico anterior; sonido/notificaciones físicos siguen sin acreditarse.

## Hallazgos

La aplicación de escritorio identifica esta conversación como Codex local y activa. El receptor real de ZEN está abierto, no está pausado y responde por su pipe autenticado. La comprobación se hizo enviando un diagnóstico **inválido como actividad**, que el esquema rechaza: no se añadieron sesiones, estados ni acciones sintéticas a la interfaz del usuario.

Los diez hooks figuraban confiados y habilitados en una comprobación de configuración. Eso **no acredita que un chat ya abierto los haya cargado ni que esté enviando eventos**. El proceso propietario de esta sesión arrancó a las 17:16, antes de instalar la integración. Tras instrumentar el auxiliar, las herramientas de esta conversación no generaron invocaciones del relay. La recarga de la sesión sigue pendiente; debe reabrirse Codex después de terminar este turno, conservando la conversación. No se ha reiniciado Codex ni interrumpido su tarea automáticamente.

Se reprodujo un fallo de lanzamiento que las pruebas directas del binario no cubrían: una ruta entre comillas enviada a `cmd /c` con el escape habitual de argumentos puede terminar con «comando no reconocido» antes de invocar el auxiliar. La misma ruta simple sin comillas funciona con ambos modos de escape comprobados. La generación del comando se adapta a Coucou: las rutas simples se pasan sin comillas y las demás conservan su protección. La instalación retira solo la definición antigua exacta del mismo auxiliar, preserva hooks ajenos y guarda respaldo. La definición corregida cambia su hash y necesita la revisión normal de Codex; no se escribe confianza automáticamente.

Una consulta desde un app-server independiente devuelve el mismo identificador con estado de runtime `notLoaded` y una copia del último turno marcada `interrupted`, mientras la aplicación confirma que sigue en ejecución. Se descartó esa lectura como fuente de actividad en directo; no se utiliza para declarar pausas, fallos o finalizaciones del chat activo. No se hizo `thread/resume`, `turn/start`, reenvío, fork ni ejecución de modelo.

Se corrigió además un defecto del relay: `tool_input` puede ser un valor JSON que no sea objeto. El acceso directo a `tool_input.command` podía lanzar una excepción y descartar un evento entero. Ahora se comprueba el tipo y se conserva el evento sin enviar la entrada cruda. El recorrido aislado verifica el caso de una herramienta de control visual con entrada de texto y confirma que ese texto privado no se copia a ZEN.

## Diagnóstico acotado

El auxiliar instalado guarda un único `relay-status.json` junto a su binario, reemplazado de forma atómica. Contiene fecha, nombre del evento permitido, forma del JSON y resultado técnico del envío. No guarda entradas, comandos, capturas, transcripciones, salidas, claves ni mensajes remotos. Su escritura no bloquea decisiones ni altera permisos. Un diagnóstico inválido manual verifica que el registro funciona, sin introducir actividad falsa en ZEN.

La interfaz distingue «Esperando eventos de Codex» de tener la configuración revisada. Preferencias indica que los chats abiertos durante la instalación deben recargar Codex si todavía no han enviado eventos. Esto evita presentar una instalación correcta como prueba de seguimiento real.

## Validación y pendientes

Build y 425 pruebas pasan. El paquete nativo de Electron y el auxiliar .NET pasan con eventos sintéticos, incluido el nuevo caso de entrada no objeto, permisos de un uso y retorno a Codex al cerrar ZEN. Se añade una prueba de la línea exacta instalada mediante `cmd /c` con diagnóstico inválido como actividad: salida vacía de decisión, código cero y ninguna sesión ficticia en el hub. El auxiliar instalado en el perfil se ha actualizado. La instalación de la definición corregida queda registrada por separado y conserva la revisión de confianza de Codex.

La evidencia de diagnóstico está en `docs/evidence/companion-no-events-diagnosis.json`; el recorrido en `companion-native.json`. La recepción de eventos reales de esta conversación queda **pendiente de reabrir Codex y comprobar el primer evento real**. No afirmar que el seguimiento de esta sesión funciona por el hecho de que pasen pruebas sintéticas o `hooks/list`.
