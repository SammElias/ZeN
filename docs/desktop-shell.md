# Cápsula y ventanas independientes — 16/10/2026

Actualización posterior: la petición de mantener el personaje únicamente en la cápsula sustituye las referencias al escenario lateral, vista previa de figura y mascota flotante de este documento. Estado vigente en `docs/compact-capsule.md`.

Petición: usar Coucou como referencia visual, mantener las funciones de ZEN y hacer de la cápsula la entrada permanente, abriendo el resto en ventanas independientes.

## Diseño y comportamiento

- Referencia local actualizada en `.reference/coucou`, commit `ff82566` del 16/10/2026. Se revisaron `docs/media/chat.png`, `docs/media/hub-dictation.png` y la captura compacta de Windows. Se adoptan la jerarquía visual, los fondos grafito y los controles discretos. No se importan Mochi ni sus recursos; se conserva el personaje, las imágenes y los sonidos locales de ZEN.
- Cápsula de 637×60 DIP con estado observado, personaje, Chat, voz, Preferencias y Detener cuando corresponde. Continúa anclada al borde y permite arrastrar contexto para revisarlo. Abrir una ventana no la transforma en el chat.
- Inicio y Chat comparten una ventana de trabajo independiente y redimensionable, con barra lateral. Actividad, Contexto, Proyectos, Voz, Permisos y Apariencia abren ventanas nativas propias. Preferencias conserva su ventana aislada. En anchuras pequeñas se simplifica la navegación y se oculta la figura lateral.
- Cerrar la ventana de trabajo conserva el compositor, los adjuntos y la sesión. Detener conserva su significado explícito. No se crean otros clientes de voz o ejecutores de tareas al abrir paneles.
- Se conserva la presentación opcional de mascota flotante, su menú de acciones, tamaño, anclaje propio, seguimiento del cursor, movimiento reducido y estado. Las ilustraciones existentes se mantienen.
- Apariencia incluye una vista previa local del personaje en su propia ventana, incluso con Chat cerrado. Los visores y la revisión de transcripciones muestran la ventana de trabajo cuando necesitan abrir un diálogo.

## Aislamiento y continuidad

`DesktopShell` administra las ventanas. El renderer original sigue siendo el único propietario de tareas, borradores, conversaciones y audio. La cápsula recibe únicamente metadatos de presentación y envía acciones enumeradas. No puede invocar `run`, guardar claves ni aprobar propuestas por su cuenta.

Los paneles usan portales React en ventanas locales `about:blank` con nombres permitidos; no montan otro `App`. Se bloquean navegación externa, ventanas arbitrarias y llamadas IPC directas desde esos paneles. Sus controles conservan los callbacks del propietario local. Sandbox, aislamiento de contexto y ausencia de Node siguen activos.

Se mantienen SQLite, miniaturas/visor de imágenes, confirmaciones por botón/voz/chat, biblioteca, carpetas a Codex, capturas, guías, exportación, cancelación y políticas existentes. La nueva presentación no cambia el agente guardado, Live, los modelos ni los límites del backend.

Hash SHA256 conservado de `config/live-session.json`: `D6350101A001788A934F06D28FF0FBDC57255D5F8966BFA71AFAFD82AC134B60`.

Hash SHA256 conservado de `config/saved-agent.json`: `FD844BFA7F2726EA684D6179995D6E94DEBF131DF6893CA8B012D76F2D1C42C7`.

## Comprobaciones y límites

- Build nativo y build de producción pasan. Vitest: **387 pruebas, 43 archivos**. Se restringió el descubrimiento a `tests/` para no ejecutar las pruebas de Coucou descargado como referencia; se incluyen `.ts` y `.tsx`.
- La regresión `scripts/interactions-native.mjs` también pasa: adjuntos aislados por proyecto, guías locales, controles de mascota, contexto fijado/deduplicado y rechazo de referencias inválidas. Ese recorrido conserva la ruta histórica de presentación para comprobar los contratos existentes; no sustituye al recorrido del nuevo shell.
- Recorrido propio `scripts/desktop-shell-smoke.mjs`: Electron, SQLite e IPC reales con entradas DOM y respuestas sintéticas, sin API. Verifica cápsula/ventana simultáneas, denegación de autoridad, apertura y cierre de paneles con el propietario oculto, borrador/contexto conservados, imagen en historial, compositor a 380/640/960 DIP, pantalla completa, Apariencia, mascota alternativa, pensamiento y retransmisión de Detener. Evidencia: `docs/evidence/desktop-shell-native.json`; capturas en `docs/ui-preview/desktop-shell/`.
- El paquete compilado se valida de nuevo con `node scripts/package-win.mjs --shell`; registro en `docs/evidence/portable-shell.json`. La extracción del archivo único se verifica con `scripts/single-file-smoke.mjs --shell` (véase evidencia de entrega).
- **Validación física incompleta:** la herramienta Windows rechazó el clic de Chat porque el punto estaba sobre Chrome. Se repitió con selección/foco renovados. En una comprobación del proceso de desarrollo, `setAlwaysOnTop(true)` seguía observándose como `isAlwaysOnTop() === false`. Tampoco resolvió el problema probar una superficie opaca o retirar el recorte; esas variantes se descartaron. No se acredita visibilidad por encima de otras aplicaciones ni clic físico. No se modifica Windows para eludirlo.
- No se hicieron nuevas pruebas de voz/modelo real, efectos en Power Platform, varios monitores o escalados físicos. Las pruebas internas y las capturas del renderer no acreditan esos casos.

Entregado el 16/10/2026 en el único `Desktop/ZEN.exe`, con respaldo y paquetes dentro de `release`. Extracción y arranque del archivo único verificados, sin API; la copia del escritorio coincide por SHA256 con el EXE probado. Estado final, hash y límites en `docs/evidence/desktop-shell-deployment.json`.
