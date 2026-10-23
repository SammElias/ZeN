# Imágenes del chat y conexión · 09/10/2026

## Imágenes

Cada referencia visual enviada queda asociada al mensaje del usuario en SQLite, junto con una miniatura local. Aparece sobre el texto y se puede abrir en un visor con cierre por botón, Escape o fondo. El historial transporta solo sus metadatos; los píxeles se solicitan por IPC al entrar en pantalla y al abrir el visor. No se añaden miniaturas al contexto del modelo ni se vuelve a enviar la imagen por visualizarla.

La asociación se guarda antes de la petición al proveedor y permanece aunque falle la respuesta o se reinicie ZEN. La lectura comprueba conversación, mensaje e imagen; la eliminación de la conversación borra también estas copias. Se conserva la política vigente de una referencia visual por petición y los lectores/autorizaciones existentes para archivos arrastrados.

El historial anterior solo recupera imágenes cuando todavía existe una ventana del proveedor sin compactar y coincide la secuencia completa de mensajes del usuario. No se adivinan asociaciones por fechas ni por textos repetidos. Imágenes no conservadas o sin asociación demostrable requieren adjuntarse de nuevo.

## Conexión

El fallo más reciente tenía `APIConnectionTimeoutError` con causa `UND_ERR_CONNECT_TIMEOUT`: el transporte Node agotaba la conexión en unos 10,6 segundos, antes de recibir respuesta HTTP. Una consulta de modelo y un recuento sintético reprodujeron el fallo sin generar respuestas. La misma petición de recuento por `Electron session.fetch` obtuvo HTTP 200 en 2,7 segundos.

El cliente REST compartido usa ahora la red de Electron mediante una sesión privada no persistente, omitiendo cookies. Mantiene clave, modelo, herramientas, configuración, cancelación, tiempo de espera y `maxRetries: 0`. No cambia el transporte WebSocket de Live. No se reenvían solicitudes fallidas ni se usa un modelo alternativo.

## Verificación

- Build de producción y 385 pruebas en 42 archivos pasan. Regresiones de persistencia, fallo/reinicio, aislamiento, borrado, recuperación histórica y ausencia de reintentos del transporte.
- Electron/SQLite/IPC reales: miniatura, visor, cierre/foco, bloqueo de lectura cruzada y diseño a 320, 640 y 960 DIP. Entrada DOM simulada, sin afirmar prueba física del ratón.
- La primera prueba del EXE extraído falló porque NSIS cambia la carpeta de trabajo y el recorrido buscaba allí el icono de prueba. El lanzador de pruebas restablece la carpeta de los fixtures y conserva los diagnósticos hasta terminar el recorrido. Es un ajuste del arnés, sin cambios en el arranque normal de ZEN.
- El cliente nuevo y el proveedor real completaron un recuento y una generación sintética con el icono público de ZEN; resultado confirmado en unos diez segundos. Herramientas deshabilitadas, sin mensajes ni capturas personales. Una generación: 446 tokens de entrada y 18 de salida. No se modificó ni revalidó la credencial cifrada del perfil en esta prueba aislada.

Evidencias: `docs/evidence/conversations-native.json`, `chat-transport-probe.json`, `chat-electron-network.json` y `chat-desktop-api.json`. Entrega final: `chat-images-deployment.json`. Las validaciones anteriores del proyecto mantienen sus límites; esta corrección no garantiza disponibilidad futura del servicio ni acredita voz/control físico.

## Entrega

Único `C:/Users/Gamming/Desktop/ZEN.exe` reemplazado y reabierto, hash SHA-256 `88D7B21A5D069858172169FAC1E4215AD875A8EC4EF65A0AC011E78C29018DA5`. La prueba del paquete final termina con código 0. Respaldo dentro de `release/desktop-backups`; ninguna carpeta nueva en el escritorio. El arranque con el perfil real recuperó dos imágenes históricas verificables. No se reejecutaron mensajes fallidos. Configuración del agente y Live comprobada mediante hashes sin cambios.
