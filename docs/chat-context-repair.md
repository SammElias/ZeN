# Respuestas duplicadas y bloqueo de compactación · 09/10/2026

La captura mostró una respuesta duplicada y un fallo de compactación en una conversación corta. Inspección local de SQLite, sin enviar mensajes ni imágenes a la API: el mensaje guardado tenía 933 caracteres, su evento final 512, y el prefijo sobrante coincidía con el resultado transmitido. El contexto anterior conservaba dos imágenes; al añadir otra, la estimación fija de 8.192 tokens por imagen ya superaba el umbral de 24.000. No se conservó la salida de aquella compactación fallida, por lo que no se puede acreditar su tamaño real.

## Corrección

- Una respuesta confirmada por el proveedor sustituye el texto parcial, también si pide aclaraciones. Su mensaje se guarda completo; la tarea puede seguir esperando al usuario. Los errores conservan el texto recibido y no se duplican si llega el mismo evento terminal.
- La estimación local solo activa la comprobación mediante `responses.inputTokens.count`. El modelo, las instrucciones y las herramientas vigentes se conservan. No se genera contenido para contar; no se afirma que este endpoint tenga una tarifa concreta. No se cuenta en cada envío pequeño.
- Solo un recuento superior al umbral inicia la compactación. Se conserva íntegra su ventana canónica, incluidos imágenes y contenido cifrado, y se registra su recibo antes de comprobar el resultado.
- Un resultado demasiado grande, o cuyo recuento falla, queda guardado con una marca persistente. El siguiente intento comprueba el tamaño y evita repetir la compactación. No se aumenta el límite configurado, se recorta el historial ni se reejecutan herramientas.
- El empaquetado publica su informe mediante un archivo temporal y cambio de nombre; corrige el bloqueo transitorio observado al sobrescribir la evidencia en Windows.

Referencias consultadas: [ventana canónica de compactación](https://developers.openai.com/api/docs/guides/compaction) y [recuento de tokens de entrada](https://developers.openai.com/api/docs/guides/token-counting).

## Validación

Build y 380 pruebas en 41 archivos pasan. Regresiones con proveedor simulado: respuesta con aclaración tras streaming, eventos de error repetidos, tres capturas con tamaño medido menor que el estimado, bloque cifrado grande, conservación y recibo de compactación, bloqueo persistente tras reiniciar SQLite y fallo del contador sin generación. No se ha enviado una petición real para comprobar el nuevo contador; servicio/modelo real pendiente del siguiente envío explícito del usuario.

Entrega y reparación del registro visible: `docs/evidence/chat-context-deployment.json` y `docs/evidence/chat-history-repair.json`. El historial de errores se conserva; ningún envío fallido se reintenta automáticamente. Configuración del agente y GPT-Live intacta.

Verificación posterior del mismo día: el contador y una generación sintética del proveedor real ya pasan con el transporte de Electron. Véase `docs/chat-images-and-connection.md`; no se reenvió la petición fallida del usuario.
