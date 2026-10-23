# ZEN como compañero de Codex — 22/10/2026

## Alcance autorizado

La petición posterior a la migración a Coucou elimina Chat, Proyectos, contexto y el resto de superficies que dependían de una petición propia. La nueva entrada de producción es `companion-main.ts`; el renderer y preload también son específicos del compañero. No se inicializan el agente, chat, voz, capturas, lectores de documentos, SQLite ni ejecución propia. Los archivos y configuraciones anteriores permanecen como histórico inactivo. No se envían prompts ni contexto a Codex y no se consulta el historial de conversaciones.

Se conserva Mochi de Coucou (`8244493`) en una cápsula con mirada, estados, vestuario y sonidos. Actividad, Permisos, Avisos y Preferencias se abren en ventanas independientes. El acceso a Codex abre la aplicación o la sesión observada. Las preferencias permiten cambiar el atajo, movimiento, sonido y notificaciones, o pausar la recepción. ZEN no detiene ni reinicia trabajo ajeno: las tareas se controlan en Codex.

## Eventos y permisos

Se adaptó el mecanismo de hooks de Coucou al protocolo oficial de Codex: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, Stop, SubagentStart, SubagentStop, Interrupt y SessionEnd. Un auxiliar fijo .NET recibe la entrada de Codex y transmite por un pipe local autenticado solo la identidad de sesión/turno, carpeta, herramienta y propuesta de acción. Descarta prompts, transcripciones, respuestas finales y salida de herramientas. No ejecuta comandos ni código recibido.

La actividad muestra comandos y parches con diferencias coloreadas y copia explícita. Un permiso completo, vigente y asociado a un turno permite «Permitir esta vez», «Rechazar» o «Revisar en Codex». Solo la ventana de revisión puede responder. La decisión es de un uso y responde a la conexión concreta; un turno nuevo, cierre, desconexión, pausa o caducidad la invalida. Una propuesta truncada o sin identidad suficiente permanece bajo la aprobación de Codex. No se conceden permisos permanentes ni se modifica la propuesta.

Los eventos terminales observados generan avisos. La inactividad no significa tarea completada: tras dos minutos sin eventos de ejecución se muestra «Revisa Codex». La actividad se mantiene solo en memoria, con límites de sesiones/pasos/avisos. Las notificaciones de Windows no incluyen código; el sonido respeta Preferencias. Ocultar ZEN no cancela Codex.

## Instalación y confianza

El auxiliar se instala en `%APPDATA%/ZEN/codex-companion`; se combina `%CODEX_HOME%/hooks.json` o, por defecto, `%USERPROFILE%/.codex/hooks.json`, preservando los hooks ajenos y guardando respaldo fuera del repositorio. La instalación no escribe confianza ni altera modelos, permisos o credenciales de Codex. La comprobación de cuenta usa únicamente `account/read`; `hooks/list` verificó diez definiciones reconocidas sin errores, inicialmente **untrusted**, y una cuenta ChatGPT disponible.

Codex exige revisar y confiar en los hooks nuevos. El mecanismo documentado es `/hooks` en **Codex CLI**, ejecutado con el mismo usuario y CODEX_HOME. No se afirma que ese comando exista en la interfaz del escritorio. Hasta aprobar esa revisión no hay actividad real de Codex en ZEN. Los eventos futuros comienzan al cargar los hooks en Codex; no se reconstruyen tareas anteriores ni se inventa el estado de sesiones ya abiertas.

Referencia oficial consultada: https://learn.chatgpt.com/docs/hooks . Referencia de implementación: `.reference/coucou/windows/src-tauri/src/agents.rs` y sus relays. La adaptación local conserva los avisos de licencia MIT y la licencia separada de los recursos Mochi; no implica autorización para publicar esos recursos.

## Validación y entrega

- Suite de 414 pruebas pasada; las nueve pruebas nuevas del compañero se repitieron después del ajuste de caducidad.
- Build TypeScript/Electron y paquete Windows pasan.
- Prueba nativa aislada con Electron, auxiliar .NET y pipe real, usando **eventos sintéticos**: recepción, actividad, revisión íntegra, rechazo exacto, un uso, ventanas restringidas, revocación, pausa/movimiento reducido y retorno a Codex con ZEN cerrado. No es una ejecución real de Codex ni una prueba física.
- Cuenta local y definiciones de hooks comprobadas con Codex real, sin solicitudes al modelo.
- Pendientes: confianza explícita del usuario en Codex, eventos de trabajo real después de activarla, clic/foco/DPI físicos y entrega de notificaciones de Windows.

Evidencias: `companion-native.json`, `companion-integration-install.json`, `portable-shell.json` y `single-executable.json`, en `docs/evidence`. La entrega final y su hash se registran en `companion-desktop-deployment.json`. El único archivo destinado a la raíz del escritorio es `ZEN.exe`; compilaciones y respaldos permanecen en `release`.
