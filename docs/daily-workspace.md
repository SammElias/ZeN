# Uso diario: atajos, tareas y proyectos — 07/10/2026

Implementación local sobre `main` dbda6f7, con Home/Chat y diseño blanco/violeta.

## Uso

1. **Recortar pantalla:** `Ctrl+Alt+R` invoca ZEN con una captura estática para marcar una región. También hay un botón en Chat y una entrada en la bandeja. Preferencias permite cambiar los tres atajos: invocar, recortar y obtener texto seleccionado. Si una combinación está ocupada o duplicada, se conservan las anteriores. El recorte cierra la voz, no envía la pantalla completa a Live y descarta la captura automática; únicamente se adjunta la zona seleccionada al enviar. Escape cancela la selección.
2. **Tareas y favoritos:** estados derivados de eventos reales, actualizados mientras la bandeja está abierta. El borrador actual aparece como «Preparada · sin enviar». Codex del escritorio aparece como «Esperando envío en Codex»; ZEN no observa si se pulsa Enviar ni su ejecución. Retomar prepara el texto editable y obtiene contexto nuevo al enviar, sin repetir efectos automáticamente.
3. **Revisión y Detener:** las revisiones concretas siguen usando códigos por voz/chat. Detener está en la cabecera durante tareas/revisiones y también en la bandeja de tareas. Detener invalida propuestas, capturas y nuevas acciones; no revierte efectos existentes.
4. **Deshacer acotado:** archivos nuevos de texto creados por el circuito de aprobación de ZEN. Durante 30 minutos y en la misma ejecución, «Deshacer creación…» muestra la ruta y solicita un código específico. Se comprueban identidad, ruta, fecha y hash antes de moverlo a la papelera de Windows; si cambió, se conserva. Operación de un uso, serializada. No es deshacer general de Windows, carpetas, proyectos exportados o cambios de aplicaciones externas. La ficha no ofrece deshacer después de reiniciar.
5. **Rutinas:** ejemplos editables «Explica este error», «Revisa JS de Dynamics» y «Respuesta en inglés», además de los favoritos existentes. Elegir o guardar una rutina no realiza llamadas; prepara el chat.
6. **Proyectos:** selector General/ZEN/Trabajo/Estudio, con creación y edición local. Hasta 12 proyectos, 8 fragmentos por proyecto y 12.000 caracteres por fragmento. El selector de archivos usa el lector local acotado existente, sin ejecutar macros ni código. Los documentos nuevos empiezan desmarcados. Hay vista previa editable, fecha de importación y selección explícita de referencias. Los datos se guardan fuera del repositorio en `project-contexts.json` del perfil de ZEN.

Los proyectos usan únicamente sus preferencias y referencias elegidas al enviar a SOL. General conserva el perfil general existente. El contexto se selecciona localmente y queda limitado por el presupuesto de caracteres configurado. No amplía raíces ni indexa carpetas. Cambiar de proyecto cierra voz, elimina referencias temporales y separa el último mensaje, tareas y borrador en memoria; retomar una tarea de otro proyecto se rechaza en main. No se cambia de proyecto durante una tarea/revisión pendiente. La voz con proyecto activo prepara la petición para revisión explícita antes de delegarla a las herramientas de SOL.

La cápsula sigue siendo 320×72 DIP arriba y 72×320 a los lados; solo aparece el estado y sus controles esenciales.

## Validación

- 309 pruebas unitarias en 36 archivos: aprobadas. Incluyen persistencia/migración, límites y aislamiento del contexto, atajos con rollback, estados, recuperación y deshacer de archivos editados/cancelados/caducados.
- TypeScript y compilación React: aprobados.
- `scripts/daily-workspace-ui.mjs`: renderer con puente simulado; recorte local hasta enviar, favoritos, cambios de estado sin reabrir la bandeja, borradores separados/restaurados y cápsula. Capturas en `docs/ui-preview/daily-workspace/`; registro en `docs/evidence/daily-workspace-ui.json`.
- Paquete Electron real: nuevo indicador `dailyWorkspaceVerified` comprueba IPC, importación local de un archivo real, persistencia, rechazo de proyecto inexistente, envío con proyecto antiguo, reanudación cruzada y colisión de atajos. Usa datos sintéticos; no llama a la API.
- Ambos JSON `config/saved-agent.json` y `config/live-session.json` conservados byte a byte. La compilación y las pruebas no usan la API.

La prueba de ratón del recorte usa Playwright sobre la interfaz de prueba. El atajo físico en otra aplicación, dictado humano y papelera real no están acreditados por estas pruebas; las pruebas de deshacer usan archivos reales temporales con un adaptador simulado para la papelera. El empaquetado no acredita el objetivo general pendiente ni flujos Power Platform reales.
