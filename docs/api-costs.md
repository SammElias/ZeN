# Pago por uso y ahorro

ZeN usa la API con pago por consumo. El máximo mensual local por defecto es 100 EUR; el objetivo diario orientativo es 1 EUR. No son cuotas ni consumos obligatorios. ChatGPT Pro y la cuenta de API tienen facturación separada.

## Cambios

- Se mantiene `gpt-6.1-sol`. Las sesiones aplican instrucciones concisas, razonamiento bajo, formato público `{result, clarifications_requested}`, servicio estándar y subagentes desactivados. El agente remoto y el handoff GPT-Live no se modifican.
- Una tarea activa por defecto y hasta cuatro herramientas. Las órdenes reconocidas localmente evitan llamadas de modelo. La búsqueda mantiene contexto pequeño y solo se solicita cuando hace falta.
- Perfil/texto observado: selección local de hasta 4.000 caracteres por defecto, editable. Las omisiones se indican. La petición humana actual se conserva completa. Capturas elegidas: JPEG a 78%, lado mayor de hasta 1.280 píxeles; no se capturan ventanas automáticamente.
- Las continuaciones económicas mantienen hasta cuatro turnos, o 20.000 tokens de entrada acumulados. Después se crea otra sesión con contexto público seleccionado de la petición/respuesta previa. Se avisa del cambio; si faltan datos debe pedirlos. Para trabajo extenso conviene aportar el fragmento de código necesario en la petición actual.
- Respuestas breves normalmente hasta 180 palabras; código y documentos permiten contenido más amplio. El monitor cancela si observa más de 8.000 caracteres generados (48.000 para código/documentos). Es un límite observado, no un límite de tokens impuesto por la API Agents. No incluye un tope duro del razonamiento interno.
- Prefijo estable para aprovechar la caché automática cuando el proveedor la admita. No hay precalentamiento de pago ni garantía de acierto de caché.
- Voz `gpt-realtime-2.1-mini`, transcripción `gpt-4o-mini-transcribe`. La transcripción autenticada se entrega al coordinador directamente: se elimina la generación que antes solo pedía delegar. Como máximo una lectura breve del resultado por turno, fuera del historial Realtime, hasta 400 tokens de salida; el código y las respuestas largas quedan en Actividad. Modo texto/reunión evita esa generación de audio. Escucha explícita; cierre tras 90 segundos inactivos o cinco minutos de sesión.
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

`scripts/economy-smoke.mjs` comprueba sesiones y configuración de voz reales con la clave existente y escribe `docs/evidence/economy-live.json`. El intento de este cambio terminó por timeout de conexión sin iniciar tareas de pago; no acredita funcionamiento real de la API ni ahorro porcentual. No se repiten automáticamente peticiones de usuario que hayan podido ejecutarse.
