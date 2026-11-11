# Contratos de integración

## IPC local

El renderer llama a `window.companion`. Preload traduce cada método a `companion:<comando>`; main comprueba el frame, el origen y el esquema. Las respuestas siguen `{ ok: true, value }` o `{ ok: false, error }`. `onStatus` se suscribe al estado filtrado y devuelve la función para retirar la suscripción. No existe un servidor REST de ZEN en el flujo activo.

| Operación | Entrada | Resultado / condición |
| --- | --- | --- |
| `status`, `onStatus` | Sin argumentos de negocio | Instantánea con revisión y visibilidad aplicada. |
| `navigate`, `codexTab` | Sección permitida, o `activity` / `summary` | Cambia la vista. Una vista ajena no recibe la última respuesta. |
| `openRequest` | Texto no vacío, máximo 8.000 caracteres | `queued`, `draft` o `clipboard`. Requiere Home visible sin Pausa/Presentación. El borrador indica si Codex se abrió. |
| `notesRecent` | Sin argumentos | Hasta cuatro apuntes con ID, título, carpeta, fecha de modificación y favorito. Solo en Inicio visible, sin Pausa ni Presentación. |
| `contextChoose`, `contextPrepare`, `contextHandoff` | Diálogo nativo; entrada validada; UUID de revisión | Prepara una revisión y la consume una vez, con chat y archivo revalidados. |
| `contextResult`, `contextSource` | Estado o referencia seleccionada | Resultado correlacionado y acceso acotado a fuente en Resumen. |
| `decide` | UUID y `allow`, `deny` o `pass` | Decide un permiso pendiente desde su propia vista. |
| `mediaNowPlaying` | Sin datos de selección | Devuelve metadatos de la sesión activa o `null`; no envía comandos. |
| `mediaSelect`, `mediaCommand` | UUID y comando validado, respectivamente | Selecciona o actúa sobre la sesión autorizada; puede fallar si dejó de estar disponible. |
| `appearanceSave` | Tema, acento, fondo, opacidad y desenfoque | Guarda preferencias desde su superficie autorizada. |

La lista completa se declara en [CompanionBridge](../../src/shared/codex-companion.ts) y se registra en [main](../../src/main/companion-main.ts). Probar cada método nuevo con el camino correcto y con entrada, origen y estado no válidos.

## Contratos externos

- **Codex CLI:** `queue --thread <uuid> --message=<texto>`. Se exige que el recibo identifique el mismo chat; el estado «en cola» no confirma ejecución ni respuesta.
- **Hooks de Codex:** línea JSON por pipe local con token y evento; la respuesta, cuando procede, vincula la decisión con el identificador del evento. No aceptar ni devolver decisiones de otros chats.
- **Auxiliar multimedia:** mensajes locales entre main y `Zen.Media`; métodos cerrados de observación, selección y acción sobre sesiones publicadas por Windows.
