> Referencia histórica. La petición del 01/10/2026 adelanta la integración y aporta otro JSON exacto, activo en [config/live-session.json](../../config/live-session.json). No ejecutar este saludo ni estas instrucciones anteriores junto a la nueva configuración. [Estado](../live-status.md).

# ZEN — Integrar GPT-Live después de las tareas anteriores

## Momento de ejecución y prioridad

Ejecuta este guion cuando hayas terminado las tareas de ZEN que ya recibiste. No interrumpas ni descartes el trabajo actual. Al llegar a esta integración, inspecciona el resultado existente, conserva sus funcionalidades y adapta la capa de voz.

Este guion actualiza exclusivamente la integración de voz y su delegación. El objetivo funcional de ZEN y el diseño de ZEN Capsule siguen vigentes. Para esta ruta de voz, la configuración siguiente sustituye las instrucciones anteriores de usar client delegation hacia el agente guardado. No cambies ni borres el agente guardado: si sigue usándose desde texto u otras funciones, conserva esa ruta y documenta su independencia.

## Handoff proporcionado por el usuario

Implement this agent in my app. Preserve the JSON below exactly; omitted fields use server defaults.

Keep API keys server-side. From your server, create the Live session by POSTing JSON {session,transport:{type:"webrtc",sdp}} to /v1/live/sessions using normal project-scoped API authentication. Read transport.sdp and opaque session.id. Use WebRTC remote audio and the oai-events data channel. Wait for session.started; do not send startup configuration again. Display exact delta text from session.input_transcript.delta and session.output_transcript.delta, grouped using start_ms/end_ms (not turns). After session.close, retain audio/transport until session.closed; report timeout/disconnect as incomplete finalization.

After session.started, send session.commentary.append with a unique event_id, delegation_id: null, and this plain-string content: "Greet the caller now: Zen\nThen pause and listen.". The 500-token limit applies to the complete content. Its acknowledgment confirms acceptance, not speech; the greeting can be paraphrased or interrupted.

### Configuración vinculante — conservar exactamente

```json
{
  "model": "gpt-live-1",
  "instructions": "Habla siempre en español de España, con pronunciación natural, tono tranquilo y respuestas breves.",
  "audio": {
    "output": {
      "voice": "echo"
    }
  },
  "delegation": {
    "type": "responses",
    "responses": {
      "parallel_tool_calls": false,
      "model": "gpt-6.1-sol",
      "reasoning": {
        "effort": "low"
      },
      "tools": [
        {
          "type": "web_search"
        }
      ]
    }
  }
}
```

Guarda este objeto como configuración única de la ruta Live. No añadas campos, prompts, herramientas, formatos, esfuerzo diferente ni otro modelo. Los campos omitidos usan valores por defecto del servidor. Envuelve el objeto en el cuerpo de creación de sesión descrito arriba, sin modificarlo.

## Qué conecta esta configuración

La voz usa GPT-Live y delega a Responses con `gpt-6.1-sol`. No referencia el agente `agent_98652f2661104ff282e5e5c9ca817ef1325ffa8195414c009f` ni importa automáticamente sus instrucciones o sus tres subagentes. No anuncies esas características como disponibles en la ruta Live.

La única herramienta declarada aquí es búsqueda web. Las funcionalidades locales construidas anteriormente no se convierten automáticamente en herramientas del backend delegado. Conserva su implementación y estudia una integración compatible; no extraigas supuestas órdenes del texto de la respuesta para ejecutarlas. Si conectar una acción Windows por voz exige modificar el JSON, registra la ampliación exacta como pendiente de autorización y completa el resto de la integración. No cambies silenciosamente a client delegation ni a otro agente.

## Trabajo de integración

1. Revisa las instrucciones del repositorio, la arquitectura actual, las dependencias y la documentación oficial vigente de GPT-Live. Respeta el handoff; informa si la API real difiere, sin improvisar eventos ni sustituir modelos.
2. Usa el backend o proceso de confianza existente para autenticar y crear sesiones. La clave persistente nunca llega al renderer, al canal de eventos, a logs ni a archivos versionados. En una aplicación Electron personal, el proceso principal puede servir como intermediario de confianza; no lo presentes como protección de una clave compartida en una aplicación distribuida.
3. Crea la oferta SDP desde el cliente, envíala al intermediario, realiza el POST autenticado y aplica el SDP de respuesta. Trata `session.id` como opaco y conserva su relación con la sesión local.
4. Conecta micrófono, audio remoto y canal `oai-events`. Espera `session.started` antes del saludo. Envía el saludo una sola vez por sesión, con ID único; no lo dupliques al repetir un evento ni al reconectar el canal.
5. Diferencia sesión creando/conectando, iniciada, cerrando, cerrada, fallida y finalización incompleta. Gestiona permisos de micrófono, dispositivos, errores API, desconexiones y tiempos de espera.
6. Muestra las transcripciones conservando literalmente los deltas y agrupándolos por intervalos temporales. No normalices, traduzcas ni reconstruyas turnos a partir de pausas. Evita duplicados usando la identidad que proporcione el protocolo; no descartes fragmentos iguales legítimos solo por coincidir el texto.
7. Integra los estados con ZEN Capsule. Mantén interfaz fluida, selección/copia de resultados y acceso escrito. El JSON se utiliza para configuración, no se lee en voz alta.
8. Usa los mecanismos de interrupción y control de reproducción realmente documentados. Si el usuario pide silencio, corta el audio local inmediatamente y evita nuevos fragmentos audibles; conserva respuesta escrita y tareas que no pidió cancelar. No interpretes silenciar como finalizar una sesión o cancelar investigación. Verifica cómo recuperar el resultado completo: no inventes las palabras aún no recibidas.
9. En modo reunión o texto, controla reproducción desde la aplicación y comprueba el modo antes de reproducir cada respuesta. El saludo inicial también debe respetar silencio: si no puede evitarse de forma compatible con el handoff, no abras automáticamente una sesión con saludo audible en ese modo y documenta el comportamiento. No agregues instrucciones al JSON para resolverlo.
10. Al cerrar normalmente, envía `session.close` y conserva audio/transporte hasta `session.closed`. Solo entonces libera recursos y presenta cierre completo. Timeout o desconexión antes de ese evento implica finalización incompleta. Para botón de emergencia, prioriza detener micrófono y reproducción de inmediato; si obliga a cortar transporte antes de la confirmación, registra igualmente finalización incompleta.
11. Mantén captura de audio ligada al consentimiento y a los indicadores de la interfaz. Una sesión Live no es por sí sola un detector de «Oye Zen». Conserva el sistema de invocación existente sin atribuirle funciones nuevas no probadas.
12. Evita crear un segundo propietario de tareas que duplique acciones entre la voz, el chat y el agente guardado. Documenta dónde reside el contexto y cómo se relacionan sesiones distintas; no asumas memoria compartida entre APIs.

## Validación y entregables

- Configuración reproducida exactamente y clave fuera del frontend.
- Creación de sesión real, SDP aplicado, `session.started` recibido y saludo enviado una sola vez.
- Conversación en español con voz echo, entrada/salida transcritas por intervalos y audio funcional.
- Pregunta que requiera búsqueda: verifica delegación real y resultado, no solo conversación de saludo.
- Interrupción durante reproducción y cambio a escrito sin cancelar involuntariamente tareas.
- Modo reunión sin audio ni robo de foco; micrófono apagable.
- Cierre normal confirmado con `session.closed`; prueba de desconexión/timeout marcada incompleta.
- Manejo de sesión duplicada, dispositivo ocupado, falta de red y error de autenticación sin reintentos ilimitados.
- No regresiones en funcionalidades Windows y UI previamente terminadas.

Ejecuta build, tipos y pruebas significativas de estados, transcripciones, saludo único y cierre. Las pruebas reales de API deben estar identificadas y usar credenciales por un mecanismo seguro. Si no hay Windows, micrófono o acceso al modelo, prueba la lógica independiente y marca integración real como pendiente. No declares voz probada usando mocks.

Entrega código integrado, configuración, instrucciones de uso y un informe breve que distinga implementado, probado y bloqueado. Incluye cualquier diferencia entre la ruta Live/Responses y el agente guardado, y cualquier ampliación necesaria para controlar Windows desde la voz. No publiques ni modifiques el agente remoto por iniciativa propia.

## Orden final para Codex

Cuando termines las tareas anteriores, aplica este guion. Integra GPT-Live con el handoff y JSON exactos, preservando ZEN Capsule y el trabajo existente. Continúa autónomamente con todo lo implementable y verifica resultados reales. No cambies la configuración para desbloquear capacidades; documenta el cambio concreto requerido y completa lo independiente del bloqueo.
