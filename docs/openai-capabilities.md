# Capacidades OpenAI · 30 de septiembre de 2026

## Documentación oficial consultada

- [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra): Responses, texto/imágenes, function calling y structured outputs; no audio directo. Esfuerzo de razonamiento compatible: medium, usado en esta entrega.
- [Realtime](https://developers.openai.com/api/docs/guides/realtime): guía con `gpt-realtime-2.1`, audio, interrupciones y herramientas.
- [WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc): `/v1/realtime/calls`, interfaz unificada con SDP y configuración desde el proceso de confianza; alternativa de credenciales efímeras por `/v1/realtime/client_secrets`.
- [Control del servidor](https://developers.openai.com/api/docs/guides/realtime-server-controls): sideband `wss://api.openai.com/v1/realtime?call_id=...` para herramientas y control fuera del cliente.
- [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use): el desarrollador proporciona el entorno. No activa control de Windows por sí mismo. No implementado en fase 1.
- [Voz sintética](https://developers.openai.com/api/docs/guides/text-to-speech): usado únicamente para crear la entrada de audio de la prueba automatizada.

## Versiones fijadas y entorno

Windows / PowerShell, Node 22.17.1, npm 10.9.2. SDK oficial `openai` 7.25.0, Electron 44.5.1, React 19.3.0, TypeScript 7.0.2, Vite 8.3.1, Vitest 5.0.3, ws 8.22.0, esbuild 0.28.2. Versiones elegidas de npm y fijadas en package-lock.json. Sin Agents SDK: WebRTC directo más sideband permite un propietario único y una superficie menor para esta herramienta.

## Configuración implementada

- Responses: `gpt-6-astra`, `reasoning.effort:medium`, `max_output_tokens:2048`, `store:false`, `include:[reasoning.encrypted_content]`, herramientas strict, `parallel_tool_calls:false`. SDK con `maxRetries:0`.
- Realtime: `gpt-realtime-2.1`, audio de salida `marin`, input transcription `gpt-4o-mini-transcribe`, idioma `es`. VAD con interrupción y sin respuestas automáticas. No header beta.
- Entrada sintética de prueba: `gpt-4o-mini-tts`, voz `coral`, WAV de «Abre el Bloc de notas». No es otro modelo de razonamiento ni un fallback.

## Probado con cuenta real

Con autorización explícita del usuario y una clave existente en el entorno, sin guardarla en el proyecto ni en los datos de ZEN:

1. Consulta de acceso para Astra, Realtime y transcripción: correcta.
2. Responses/Astra con function calling: completada, llamó `open_application` con `notepad`. Primer sondeo: 147 tokens de entrada, 19 de salida, 166 total, request ID en docs/evidence/api.json.
3. Creación de credencial efímera Realtime: correcta; su valor se descartó sin imprimirlo ni guardarlo.
4. Circuito real de texto con el mismo orquestador y ejecutor Windows: completado con evidencia de ventana.
5. Circuito Realtime/WebRTC + sideband + transcripción + Astra + ejecutor + salida de audio: completado con audio sintético, mensaje «Bloc de notas ya estaba abierto. He verificado su ventana.».

Evidencia saneada en docs/evidence/. Consultar un modelo o emitir una credencial no demuestra por sí solo conversación de voz; la prueba 5 sí ejercita la sesión real, sin probar hardware físico. Los importes no se calcularon; los metadatos distinguen voz, tokens y herramientas. La recuperación de uso final al desconectar sigue sin confirmarse.

## Pendiente

Micrófono y altavoz físicos, pulsación del atajo, pruebas de conexión degradada y calidad de interrupción acústica. Acceso de una cuenta o proyecto diferente debe comprobarse de nuevo. No inferir acceso API a partir de la suscripción de ChatGPT o de los modelos disponibles en Codex.
