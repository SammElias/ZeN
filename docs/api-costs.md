# Pago por uso y ahorro

ZeN usa la API con pago por consumo. El máximo mensual local por defecto es 100 EUR; el objetivo diario orientativo es 1 EUR. No son cuotas ni consumos obligatorios. ChatGPT Pro y la cuenta de API tienen facturación separada.

## Cambios

- Se mantiene `gpt-6.1-sol`. Las sesiones aplican instrucciones concisas, razonamiento bajo, formato público `{result, clarifications_requested}`, servicio estándar y subagentes desactivados. Las opciones económicas se aplican por sesión y el handoff GPT-Live se conserva. La ampliación posterior autorizada de herramientas remotas se documenta en [toolkit-status.md](toolkit-status.md).
- Una tarea activa por defecto y hasta cuatro herramientas. Las órdenes reconocidas localmente evitan llamadas de modelo. La búsqueda usa `context_size: low`, valor admitido por [Agents API](https://developers.openai.com/api/docs/guides/agents-api/tools/web-search), y solo se solicita cuando hace falta. Se corrigió el valor incompatible `small` el 01/10/2026 sin modificar el agente remoto.
- Perfil/texto observado: selección local de hasta 4.000 caracteres por defecto, editable. Las omisiones se indican. La petición humana actual se conserva completa. Capturas elegidas: JPEG a 78%, lado mayor de hasta 1.280 píxeles; no se capturan ventanas automáticamente.
- Las continuaciones económicas mantienen hasta cuatro turnos, o 20.000 tokens de entrada acumulados. Después se crea otra sesión con contexto público seleccionado de la petición/respuesta previa. Se avisa del cambio; si faltan datos debe pedirlos. Para trabajo extenso conviene aportar el fragmento de código necesario en la petición actual.
- Respuestas breves normalmente hasta 180 palabras; código y documentos permiten contenido más amplio. El monitor cancela si observa más de 8.000 caracteres generados (48.000 para código/documentos). Es un límite observado, no un límite de tokens impuesto por la API Agents. No incluye un tope duro del razonamiento interno.
- Prefijo estable para aprovechar la caché automática cuando el proveedor la admita. No hay precalentamiento de pago ni garantía de acierto de caché.
- Ruta de voz anterior (ya no activa): `gpt-realtime-2.1-mini`, transcripción `gpt-4o-mini-transcribe`. La transcripción autenticada se entrega al coordinador directamente: se elimina la generación que antes solo pedía delegar. Como máximo una lectura breve del resultado por turno, fuera del historial Realtime, hasta 400 tokens de salida; el código y las respuestas largas quedan en el panel de ZEN. Modo texto/reunión evita esa generación de audio. Escucha explícita; cierre tras 90 segundos inactivos o cinco minutos de sesión.
- Sonidos y animaciones propios se generan localmente y no usan tokens.

## Contador y límites prácticos

`spending.json`, en los datos de usuario de ZeN, se guarda aparte de los registros borrables. Incluye tokens de entrada, salida, caché y recibos deduplicados; nunca transcripciones ni claves. Calendario mensual de Madrid. Antes de iniciar se reservan 0,50 USD para una tarea breve/sesión de voz, o 2 USD para código/documentos. El recibo confirmado ajusta esa reserva al consumo estimado. Reinicios, cancelaciones y uso incompleto conservan la reserva; no se convierten en gasto cero inventado. Borrar el registro de ejecución no borra este contador.

Las nuevas llamadas de pago se bloquean cuando no cabe su reserva. El consumo en curso puede superar la reserva y el límite local antes de recibirse el uso. El contador solo cubre este ZeN y empieza con esta versión: no recupera facturación anterior, otros programas, otros equipos ni impuestos. La conversión inicial es **1 EUR por USD**, una estimación conservadora editable, sin actualización automática. No es una garantía de máximo de factura; el importe real se consulta en el proveedor.

Tarifas estándar USD comprobadas el 30/09/2026, por millón de tokens:

| Modelo | Entrada | Entrada en caché | Salida |
| --- | ---: | ---: | ---: |
| gpt-6.1-sol | 2,00 (se estima 2,50 por posible escritura de caché) | 0,10 | 10,00 |
| gpt-realtime-2.1-mini, texto | 0,60 | 0,06 | 2,40 |
| gpt-realtime-2.1-mini, audio | 10,00 | 0,30 | 20,00 |
| gpt-4o-mini-transcribe | 1,25 texto / 3,00 audio | — | 5,00 |

La búsqueda se estima aparte en 0,01 USD por llamada. Si faltan detalles de modalidad de voz, se usa la tarifa más alta aplicable. Los tokens de razonamiento ya incluidos en salida no se suman otra vez. Un modelo de voz sin tarifa conocida se bloquea antes de iniciar.

Fuentes: [precios oficiales](https://developers.openai.com/api/docs/pricing), [configuración por sesión](https://developers.openai.com/api/docs/guides/agents-api/configuration), [uso Agents](https://developers.openai.com/api/docs/guides/agents-api/observability), [caché](https://developers.openai.com/api/docs/guides/prompt-caching), [respuestas Realtime fuera del historial](https://developers.openai.com/api/docs/guides/realtime-conversations), [coste de voz](https://developers.openai.com/api/docs/guides/voice-latency-cost).

## Verificación

Pruebas unitarias: presupuesto compartido, deduplicación, caché/audio, cambio de mes, reservas después de reinicio, migración, continuaciones, transcripciones antiguas y lectura única. Prueba de interfaz: preferencias, visualización y guardado de presupuesto. Prueba del paquete: Electron y auxiliar Windows reales, sin llamadas de pago.

`scripts/economy-smoke.mjs` comprueba sesiones y configuración de voz reales con la clave existente y escribe [evidencia](evidence/economy-live.json). El 01/10/2026 completó dos tareas sintéticas de pago con continuación en la misma sesión: `gpt-6.1-sol`, razonamiento bajo, servicio estándar y subagentes desactivados. Verificó el agente remoto intacto y la aceptación de `gpt-realtime-2.1-mini` sin respuestas automáticas ni generación de audio. No prueba escucha/habla físicas ni ahorro porcentual.

El uso llegó como `null` en ambos turnos: dos reservas pendientes suman 1 EUR estimado. Los ceros de tokens/gasto confirmado significan ausencia de recibo, no consumo gratuito ni coste real cero. La reserva permanece hasta disponer de evidencia de uso. No se repiten automáticamente peticiones de usuario que hayan podido ejecutarse.

## Herramientas ampliadas · 01/10/2026

Las llamadas de zen_cloud reservan 0,50 USD, o 1 USD para imagen, además de la reserva de la tarea principal. El uso de tokens se registra cuando está disponible. Las tarifas adicionales de imágenes, contenedores y servicios MCP no se presentan como totalmente calculadas: se conserva la reserva incierta. Agents API devolvió uso null en las pruebas de web y archivos; no significa consumo gratuito. Un resultado local explícito de biblioteca evita llamadas de razonamiento y TTS; la transcripción de voz sigue siendo remota si está conectada. [Pruebas y límites](toolkit-status.md).

## GPT-Live activo · 01/10/2026

El JSON exacto nuevo sustituye las opciones mini para voz: gpt-live-1/echo y SOL 6.1/low para delegación. Precio Live publicado: **0,05 USD/minuto, por segundos**, backend y herramientas aparte. [Fuente oficial](https://developers.openai.com/api/docs/models/gpt-live-1). Las lecturas de usage.seconds son acumulativas: se registra solo su incremento y el recibo final. Tokens de SOL y búsquedas se contabilizan por separado, sin reutilizar tarifas de Realtime para Live. La reserva de voz sigue siendo 0,50 USD y cubre cinco minutos máximos; sesiones o backend en curso no garantizan un límite duro de factura.

Silencio/reunión bloquea reproducción local; conservar el JSON significa que no se eliminan las modalidades del servidor, y por tanto no garantiza evitar generación/coste de voz. Las delegaciones se observan cuando el proveedor ya las ha iniciado: el límite de búsquedas/coste observado puede cerrar la sesión, pero no es un presupuesto previo duro del proveedor. El cierre sin usage final conserva reservas. El TTS auxiliar de los fixtures reales se factura aparte y no se incluye en el contador de Live. [Estado y evidencia](live-status.md).

Análisis de carpetas: por petición posterior del 01/10/2026, ZEN prepara la carpeta/petición en Codex del escritorio; no manda los archivos a su agente API ni hace un segundo análisis. El usuario envía dentro de Codex con su cuenta y límites. Voz Live y creación previa por harness siguen usando API; no se midió ahorro comparativo. [Alcance](codex-desktop-folders.md).
