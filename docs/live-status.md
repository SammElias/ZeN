# GPT-Live en ZEN · 01/10/2026

La petición nueva adelanta esta integración respecto al orden anterior. **GPT-Live es ahora la ruta de voz activa del proyecto**, con **gpt-live-1 / echo** para conversación y **gpt-6.1-sol** para tareas delegadas por Responses. No se declara completado el objetivo general. No se ha generado ningún nuevo ejecutable; los portables anteriores conservan su versión anterior de voz.

## Implementado

- [config/live-session.json](../config/live-session.json) conserva exactamente el último JSON recibido: instrucciones «Te llamas ZeN…», echo, SOL 6.1 con razonamiento low, llamadas secuenciales y web_search. Ningún campo omitido se añade al objeto. El handoff histórico de `docs/handoffs/gpt-live.md` y su JSON se conserva como referencia anterior, sin ejecutarlo ni mezclar su saludo adicional con esta configuración.
- Electron main actúa como servidor de confianza: POST JSON `{session, transport:{type:"webrtc",sdp}}` a `/v1/live/sessions`, autenticación normal de proyecto, clave protegida fuera del renderer. Usa `transport.sdp` y el `session.id` opaco; el IPC valida que ese ID corresponde a la sesión activa, sin exigir un prefijo concreto.
- Audio remoto por WebRTC y canal `oai-events`. El micrófono permanece deshabilitado durante negociación y hasta `session.started`. La configuración no se reenvía después: no hay `session.start` ni `session.update` de arranque ni saludo añadido automáticamente.
- Transcripciones exactas de `session.input_transcript.delta` y `session.output_transcript.delta`: conserva espacios, repeticiones y marcas `start_ms/end_ms`. Agrupación independiente por hablante y separación por huecos en la línea temporal. Un hueco no se interpreta como petición completa. La cápsula muestra solo la intervención más reciente; la cronología evita que fragmentos tardíos anteriores sustituyan texto nuevo. Los textos hablados se presentan literalmente, sin interpretación Markdown.
- SOL delegado se refleja en tareas/stream/fuentes, con deduplicación y gasto separado. No se convierte la narrativa del backend en efectos Windows. La voz puede seguir hablando mientras SOL trabaja; la interrupción de conversación no equivale a cancelar una tarea.
- Micrófono, pulsar para hablar, silenciar respuesta, reunión y Detener se conservan. Reunión silencia reproducción inmediatamente y mantiene texto. Como el JSON no cambia las modalidades del servidor, **silenciar localmente no garantiza evitar generación ni coste remoto de voz**.
- `session.close` espera `session.closed`, manteniendo peer, canal y audio remoto durante la finalización. Timeout de siete segundos o pérdida de conexión se registra como cierre incompleto; no se inventa confirmación. La salida normal de la aplicación espera esa finalización; Detener silencia inmediatamente y cancela nuevas operaciones locales, sin deshacer efectos existentes.
- Coste Live acumulado por segundos: se registra el incremento de cada lectura de `usage.seconds`, sin sumar otra vez los totales. Tokens y búsquedas de SOL se contabilizan aparte. Uso final ausente conserva reservas. Cinco minutos máximos de sesión y cierre por inactividad a los noventa segundos, conservando tareas locales en curso.

## Herramientas existentes y privacidad

Actualización posterior: [captura automática al invocar ZEN](screen-context.md), conectada al backend SOL con entrada de imagen, sin añadir herramientas ni cambiar el JSON. La biblioteca sigue local; una referencia visual puede incluir contenido que estuviera visible al llamar a ZEN.

El JSON exacto solo ofrece **web_search** al backend de Live. No se añaden automáticamente `zen_desktop`, archivos, imagen ni otras funciones a esa sesión. Se conserva independiente el agente guardado ZeN y su puente existente de herramientas, políticas, contexto y perfil.

Para emplear esas herramientas desde voz: habla, silencia el micrófono o suelta push-to-talk y pulsa **Revisar petición para las herramientas de ZEN**. Revisa el texto exacto y elige **Ejecutar esta petición**. El identificador corresponde a una transcripción autenticada, inmutable y de un uso; si llega otro fragmento, la revisión anterior queda invalidada. El coordinador existente ejecuta la petición y devuelve un resumen factual a Live cuando corresponde. Crear un archivo/carpeta conserva además la aprobación concreta de creación.

Esta revisión de transcripción es necesaria porque el protocolo Live no proporciona un evento de petición completada y el handoff no incluye funciones locales. No se ejecutan efectos por una pausa de audio ni por una afirmación del modelo. Las operaciones del clip continúan disponibles.

La biblioteca permanece local bajo los dos escritorios autorizados. Una lectura explícita «Lee localmente … sin API» devuelve el contenido únicamente al panel, sin reenviarlo a Live ni TTS. La petición hablada sí se transcribe remotamente. Interpretar un documento con SOL utiliza los fragmentos pertinentes y la política anterior. Nunca se monta el escritorio en contenedores del proveedor ni se importa memoria ajena automáticamente.

## Pruebas y límites

- Unitarias: **198 pruebas en 21 archivos**, incluyendo configuración exacta, micrófono bloqueado hasta `session.started`, transporte retenido durante cierre, texto literal y deduplicado, intervalos superpuestos, revisión caducada/de un uso, no ejecución desde eventos del modelo, resultado local no enviado a Live y segundos acumulativos sin doble gasto. Se conserva cobertura de la ruta Realtime anterior como regresión histórica; esa ruta ya no está conectada a producción.
- Build y [Edge](evidence/live-ui.json): revisión de transcripción, bloqueo de revisión caducada y cápsula sin chat/configuración. [Electron/Windows](evidence/live-electron.json): arranque, voz seleccionada Live, aislamiento, sesiones opacas ajenas bloqueadas, biblioteca local, DPAPI ficticio y anclaje. No crea un .exe distribuible.
- [API real + WebRTC en Edge](evidence/live-webrtc.json): audio sintético, sesión aceptada con JSON exacto, transcripciones de ambos hablantes, audio remoto recibido, señal de salida detectada, delegación SOL/web y cierre confirmado. La evidencia identifica por separado si se observó también la lectura del resultado final. No acredita micrófono/altavoz físicos ni comodidad o latencia garantizada.
- Pendiente: prueba física de conversación/interrupción y equipos de audio; reunión Teams; revalidar los fallos de foco del objetivo general. La ruta automática Live no tiene todas las herramientas propias de ZEN: requiere ampliar un handoff futuro o usar la revisión descrita. Los límites locales se observan después de iniciarse la delegación alojada y no constituyen un presupuesto duro del proveedor.

El proveedor publica **0,05 USD por minuto, facturado por segundos**, con backend y herramientas aparte. Las pruebas de voz sintética utilizan también TTS auxiliar para fabricar el audio; ese fixture no es la voz de producción ni está incluido en el contador de Live. [Precio y modalidad del modelo](https://developers.openai.com/api/docs/models/gpt-live-1).

## Probar el proyecto sin empaquetar

```powershell
npm run build
npm start
```

Cierra una instancia antigua desde la bandeja antes de arrancar el proyecto. Usa el consentimiento y la clave ya configurados; el permiso físico de Windows puede requerir intervención del usuario. Activa el micrófono para conversar; SOL se encargará de las consultas que Live delegue. Preferencias muestra los modelos de voz/delegación como configuración fija del handoff.

Pruebas reproducibles: `npm test`, `npm run build`, `npm run test:ui`, `npm run test:electron`; API real autorizada con clave de entorno: `node scripts/live-webrtc-smoke.mjs`. Esta última consume saldo y usa únicamente voz sintética y consultas públicas. No generar portables hasta que el usuario lo solicite.

Protocolo: [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [sesiones y transcripciones](https://developers.openai.com/api/docs/guides/live-conversations), [delegación](https://developers.openai.com/api/docs/guides/live-delegation) y [control desde servidor](https://developers.openai.com/api/docs/guides/voice-server-controls).
