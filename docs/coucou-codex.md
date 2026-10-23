# ZEN con base Coucou y Codex

Petición del 22/10/2026: actualizar Coucou, sustituir el personaje anterior y llevar toda conversación/ejecución a Codex, retirando el chat por API.

Referencia actualizada a `8244493` (`Louis-CFM/coucou`). Se incorporan sus módulos originales de Canvas (Mochi, vestuario, animaciones, sonidos), geometría y máquina de estados. El host Electron y los adaptadores locales conservan las ventanas independientes de ZEN, captura WGC, adjuntos revisables, historial SQLite, miniaturas, proyectos, atajos y Detener. No se arranca el backend Tauri ni se habilitan automáticamente los proveedores, telemetría, actualizaciones, conexiones o hooks de Coucou.

## Codex

`codex app-server --stdio`, ejecutable instalado, entorno sin claves API, sesión administrada por Codex. Antes de enviar se exige `account.type=chatgpt`; no hay fallback API. El identificador del hilo se guarda por conversación en SQLite. Solo se reciben estados observados, mensajes y revisiones del turno correspondiente. Las solicitudes desconocidas se rechazan. Detener solicita `turn/interrupt`; una desconexión no reenvía el trabajo. Se mantiene `gpt-6.1-sol`, razonamiento bajo, subagentes deshabilitados. Política inicial `untrusted` y sandbox `read-only`: los efectos que Codex no pueda realizar en su aislamiento requieren revisión concreta.

GPT-Live deja de iniciarse. La alternativa visible es dictar al campo mediante Windows+H, revisar y enviar a Codex; se mantiene lectura local de respuestas. No se presenta como conversación de voz continua ni como dictado sin conexión.

Documentación oficial consultada: https://learn.chatgpt.com/docs/app-server . Protocolo contrastado con `generate-ts` del Codex instalado (0.163.0-alpha.11.1).

## Procedencia y recursos

Código fuente MIT de Louis Raillé, copias en `src/coucou/licenses`. El personaje, expresiones, sonidos y marcas tienen una licencia separada (`LICENSE-ASSETS.md`); no son recursos MIT. Esta adaptación es local para este equipo. No se autoriza su publicación, distribución ni uso comercial: para ello se necesita permiso escrito del autor o sustituir esos recursos por otros propios. No se ha publicado esta adaptación. El kit anterior se conserva como material histórico, fuera de la interfaz activa.

## Validación

- Build de producción y auxiliar nativo correctos. 405 pruebas en 45 archivos pasan; 14 cubren autenticación, continuidad, imagen, streaming/final, permisos inmutables por turno, preguntas, cancelación y desconexión de Codex.
- Recorrido Electron con IPC/SQLite reales y clics simulados correcto: Mochi, vestuario, estados observados, mirada, movimiento reducido, cápsula sin autoridad, ventanas independientes, borrador, imágenes, anchuras 380/640/960, revisión segura de preguntas, Preferencias sin clave y bloqueo de GPT-Live. Evidencia: `docs/evidence/coucou-native.json`.
- Un turno sintético real con el app-server instalado y sesión ChatGPT devolvió exactamente `CODEX_ZEN_OK`; stream e hilo persistente comprobados. No se usó clave API ni se reenviaron mensajes del usuario. El hilo de prueba se archivó. Evidencia: `docs/evidence/codex-runtime-native.json`.
- La prueba física mediante Computer Use fue detenida con Escape. No acredita clics, arrastre, topmost, dictado, varios monitores ni composición de capturas. Las limitaciones anteriores siguen vigentes. Tampoco se han ejecutado cambios reales de archivos ni herramientas con efectos mediante Codex; esos permisos se validaron con transporte simulado.
- Configuraciones históricas de agente/Live conservadas byte a byte; la ruta activa es Codex. No se reinstalan proveedores ni se reactiva la API antigua. Las solicitudes de protocolo desconocidas o que no permiten revisar el efecto completo se rechazan; la entrada a terminal existente (`writeStdin`) debe continuarse desde Codex.

La entrega portable se registra en `docs/evidence/single-executable.json` y su copia al único `Desktop/ZEN.exe` en `docs/evidence/coucou-desktop-deployment.json`. Los recursos licenciados se incluyen en `licenses/coucou` dentro del paquete. No se ha hecho commit, push ni publicación.
