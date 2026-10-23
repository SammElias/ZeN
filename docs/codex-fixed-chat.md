# Chat y proyecto fijados en ZEN — 22/10/2026

El usuario confirma que trabaja siempre en el mismo chat y proyecto de Codex y autoriza aplicar las mejoras propuestas. El objetivo local se guarda en `companion-target.json`, dentro del perfil de ZEN, con el identificador exacto de este chat y su carpeta. No se incluye un identificador personal en el código distribuible. No se crea ni se reanuda ningún chat; tampoco se envían peticiones a Codex.

## Comportamiento

- La recepción filtra por identificador de chat **y carpeta exacta** de Windows (sin distinguir mayúsculas, barras ni separador final). Otro chat, una subcarpeta o una carpeta de nombre parecido no modifica las sesiones, las señales, los avisos ni los permisos de la cápsula. Las solicitudes ajenas vuelven a Codex sin decisión de ZEN. Si el archivo del objetivo existe pero es inválido, la recepción falla cerrada.
- Flecha, bandeja, `Ctrl+Alt+C` y botones sin identificador vuelven al chat fijado, incluso antes de su primer evento. Los avisos de Windows utilizan su identificador original exacto. Pulsarlos abre Codex; no concede un permiso ni ejecuta una tarea.
- La cápsula indica el chat fijado; Preferencias muestra también su carpeta. El diagnóstico separa cuenta, revisión de hooks y señales realmente recibidas. «Última señal» es la antigüedad local de un evento válido de ese chat, no una prueba de conexión continua ni una estimación de progreso.
- «Silenciar avisos 30 min» suspende sonidos y notificaciones sin detener la recepción ni devolver permisos pendientes. Los avisos se guardan para leerlos; al vencer o reactivar el silencio no se reproducen los acumulados. Las preferencias de sonidos y notificaciones se conservan. La caducidad sobrevive a reiniciar ZEN.
- `Stop` produce una ficha de turno terminado con número de inicios de acción observados y acceso a Codex. Solo calcula duración si recibió `UserPromptSubmit`; en los demás casos indica «Inicio no observado». No copia la respuesta, ni afirma éxito funcional de una tarea. Un `Stop` repetido no añade otro aviso ni otra línea terminal.

## Validación y límites

Build de producción, 437 pruebas en 49 archivos y recorrido nativo de Electron con auxiliar .NET/pipe reales y **eventos sintéticos en un perfil aislado**. Se comprueban filtrado de chat/carpeta, permisos ajenos devueltos sin respuesta, apertura antes del primer evento, navegación exacta desde avisos, silencio sin perder un permiso, ficha final, señal visible, aislamiento IPC y tamaños. Los recursos Coucou siguen limitados a adaptación local por su licencia separada.

Una ejecución inicial de la suite con 49 workers simultáneos tuvo dos timeouts de lectura local durante el build. La suite completa se repitió con un máximo de cuatro workers. No se ampliaron los tiempos de espera de las pruebas ni se cambiaron las funciones históricas.

La comprobación posterior **sí confirma recepción genuina de este chat en el EXE de producción**. Se leyó su propio `window.companion.status()` mediante una inspección temporal en loopback, sin modo de prueba, sin enviar eventos al receptor y sin llamadas de modelo. Devuelve el identificador exacto de este chat, su carpeta exacta, estado `working` y una última señal reciente. Cuenta ChatGPT y 10/10 hooks confiados y habilitados, obtenidos mediante la comprobación local existente. La confianza y las definiciones no se modificaron en esta mejora. La inspección se cerró y el EXE volvió a abrirse normalmente. La consulta independiente de estado descartada anteriormente sigue sin utilizarse como telemetría.

La lectura nativa de la ventana transparente sobre un juego mostró el contenido subyacente; no acredita renderizado físico de la cápsula ni foco. Sonido oído, notificaciones de Windows recibidas, DPI y gestos físicos siguen pendientes.

Evidencias: `docs/evidence/companion-native.json`, `docs/evidence/companion-fixed-chat-config.json`, `docs/evidence/companion-fixed-chat-live.json`, `docs/evidence/companion-fixed-chat-deployment.json` y `docs/evidence/single-executable.json`. Compilaciones y respaldos dentro de `release`; entrega únicamente en `Desktop/ZEN.exe`, SHA-256 `10E37D83577CD914985B090638ADD53AF1C51E7B1EBB051D557A93A7E8F0C12D`.
