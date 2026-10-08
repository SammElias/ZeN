# Guion 05 — chats, contexto y continuidad

Implementación del 07/10/2026. El usuario autorizó el guion **excepto todo lo relativo al consumo**. No hay nuevas cifras, tarifas, créditos, avisos ni paneles de gasto. Se reutilizan las protecciones de presupuesto que ya tenía el backend.

## Uso

En **Chat → Conversaciones** se pueden buscar títulos y contenido, abrir chats, crear uno nuevo, fijar, renombrar, archivar y recuperar. La lista y el historial tienen desplazamiento interno; el compositor permanece accesible. Cada chat conserva su borrador, adjuntos pendientes, posición de lectura y proyecto. Cambiar de chat durante una respuesta mantiene la ejecución y su salida en el origen. Las solicitudes de un mismo chat se atienden en orden, incluida la preparación de adjuntos; otras conversaciones usan la concurrencia limitada existente.

**Dónde lo dejamos** presenta un extracto local versionado: petición original, último resultado disponible, registros pendientes y enlaces a mensajes de origen. No inventa decisiones ni resultados y no hace inferencias al abrirse. Los detalles completos siguen disponibles en el historial y en la búsqueda exacta del chat; **Usar este fragmento** permite adjuntar el original a una petición nueva.

**Continuar en un chat nuevo** y **Usar contexto de otro chat** presentan origen, proyecto, versión, destino, texto editable y selección de adjuntos. Se copia una instantánea; no hay sincronización posterior ni permisos heredados. Los adjuntos seleccionados quedan disponibles localmente y se envían solo al adjuntarlos explícitamente. Retirar una referencia elimina su incorporación en futuras peticiones, conservando respuestas y mensajes históricos.

La derivación a Codex del escritorio figura como **Pendiente de resultado externo**. No se presume envío ni resultado de Codex. Las transcripciones Live se conservan como fragmentos literales locales, sin inferir turnos terminados ni permisos. No se incorporan automáticamente al contexto SOL: se puede seleccionar un fragmento expresamente. Se conserva el protocolo Live existente.

## Persistencia y protocolo

- `ConversationStore`: SQLite local en el directorio de datos de ZEN, WAL, claves foráneas, transacciones e IDs persistentes. Chats, mensajes ordenados, ejecuciones, contexto del proveedor, llamadas/resultados, referencias, artefactos generados, transferencias, borradores y eliminaciones pendientes.
- Migración repetible de `tasks.json`, copia `tasks.json.before-conversations.bak`, previews antiguas marcadas como **historial parcial**. No reconstruye mensajes inexistentes. El usuario puede leer y gestionar chats sin conexión.
- El chat integrado usa Responses `gpt-6.1-sol`, razonamiento `low` y servicio `default`, reutilizando instrucciones económicas, herramientas y autorización de la petición humana actual. El agente remoto guardado no se modifica; otras rutas existentes permanecen independientes.
- Se eligió **contexto local gestionado mediante arrays de Responses**. Permite sustituir exactamente una ventana compactada y retirar referencias futuras sin depender de un catálogo remoto. No se activa una combinación no verificada entre Conversations y compactación; no se mezclan `conversation` ni `previous_response_id` con este recorrido. Referencias: [estado de conversación](https://developers.openai.com/api/docs/guides/conversation-state) y [compactación](https://developers.openai.com/api/docs/guides/compaction).
- Ventana configurable en Preferencias: 24.000 tokens aproximados por defecto, entre 4.000 y 180.000. Estimación local conservadora basada en bytes e imágenes, independiente de facturación. Queda margen respecto a la ventana del modelo para instrucciones, herramientas y salida. La compactación conserva **toda** la ventana devuelta, incluido el elemento cifrado opaco; sustituye el contexto anterior, no el historial visible. Si falla, se mantiene el estado previo y no se envía el contexto que supera el umbral. No se muestra razonamiento interno.
- IDs remotos y resultados estructurados quedan registrados; cada llamada local se registra antes del efecto. No se reejecutan herramientas inciertas. Al reiniciar, las ejecuciones abiertas quedan **Estado por comprobar**. Comprobar resultado pendiente consulta únicamente IDs conocidos; una respuesta con herramientas no acredita que sus efectos se ejecutaran. Sin reenvío automático después de timeout, desconexión o reinicio.
- Las referencias a archivos conservan identidad y fecha/tamaño; un archivo ausente o modificado requiere volver a adjuntarlo. Las capturas restauradas son históricas. Los resultados generados permanecen locales y se pueden guardar después de reiniciar. Ningún archivo se vuelve a leer o enviar por abrir un chat.
- Eliminar requiere código concreto de un uso, por voz o chat, con descripción del alcance. Cancela sus tareas, elimina sus datos exclusivos y encola el borrado de Responses propios. Los originales del usuario y las copias de otros chats permanecen. Los fallos remotos se muestran como limpieza pendiente y pueden reintentarse. Las marcas de eliminación impiden reconstrucción por respuestas tardías. No se crean Conversations remotas, por lo que no quedan ítems de ese servicio por limpiar.

## Verificación

- Pruebas automatizadas de reinicio, aislamiento, migración repetida, búsqueda literal, archivo/recuperación, adjuntos ausentes, transferencias y versiones, herramientas sin replay, eliminación y limpieza pendiente, compactación completa y fallo seguro, artefactos, fragmentos Live y conciliación explícita.
- `scripts/interactions-native.mjs`: SQLite y puente IPC reales en Electron/Windows con perfil temporal sin clave. Prueba borradores A/B, historial paginado de 76 mensajes, cola local/deduplicación, eliminación confirmada y tamaños 320×480, 640×560 y 960×640. Evidencia: `docs/evidence/conversations-native.json`; capturas en `docs/ui-preview/conversations/`.
- `scripts/conversations-live.mjs`: prueba explícita de SOL real con texto sintético, compactación real, cierre/reapertura del almacenamiento y recuperación del dato en el siguiente turno. Limpieza de Responses completada. Evidencia: `docs/evidence/conversations-api.json`. No envió archivos personales ni ejecutó herramientas.
- Las pruebas DOM no acreditan interacción física, voz/micrófono físico ni operaciones externas de Power Platform. No hay sincronización entre dispositivos ni acceso al historial global de ChatGPT/Codex. Los pendientes anteriores del producto siguen documentados en `objective-verification.md`.

Configuraciones conservadas byte a byte: Live `D6350101A001788A934F06D28FF0FBDC57255D5F8966BFA71AFAFD82AC134B60`; agente `FD844BFA7F2726EA684D6179995D6E94DEBF131DF6893CA8B012D76F2D1C42C7`.

## Entrega

342 pruebas automáticas aprobadas. EXE único actualizado y abierto en `C:\Users\Gamming\Desktop\ZEN.exe` (114.731.230 bytes; SHA-256 `B3BF792E47E57587FD13620F20B2E0CB1DD89812872EA4415A14B1E2243923F1`). Se verificó que el bundle de la instancia real coincide con el compilado, que se creó SQLite y que la interfaz muestra Conversaciones, Nuevo chat y el historial migrado. Respaldo de la versión anterior y datos previos dentro de `release/desktop-backups`, sin carpetas nuevas en la raíz del escritorio. Evidencia de entrega: `docs/evidence/portable-conversations.json`.
