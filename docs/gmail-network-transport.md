# Transporte de Gmail — 24/10/2026

El callback local de OAuth ya devuelve una página de ZEN, pero el usuario muestra «fetch failed» al canjear la autorización. La captura acredita el fallo de red genérico; no permite recuperar su causa anterior. La consola Google Cloud revisada en la entrega previa mostraba Gmail API habilitada y un cliente Desktop coincidente. No se modifica esa configuración.

## Cambio

La instancia de producción de CompanionGmail recibe el transporte de una sesión Chromium privada y no persistente (`zen-gmail-api`, caché deshabilitada), creada después de app.ready. Se conservan PKCE, state y el receptor loopback. El adaptador solo permite POST al endpoint fijo de tokens y GET a las rutas acotadas de mensajes/INBOX de Gmail. Impone credenciales omitidas, ausencia de caché/referente y rechazo de redirecciones; no comparte cookies de navegador ni permite protocolos locales, y no modifica certificados o proxy. No hay fallback a Node ni reintentos del canje.

Los errores de red muestran una explicación y un código permitido para DNS, TLS, proxy, conexión, timeout o cancelación. Los errores HTTP solo extraen una enumeración OAuth conocida y el estado numérico, nunca error_description ni cuerpos remotos. Una respuesta desconocida produce un mensaje fijo. Los fallos de OAuth y lectura escriben fecha, fase, clase, código permitido, estado HTTP y, para errores de red, la explicación fija local en gmail-network-diagnostic.json del perfil local, fuera del repositorio. No se registran URL, correo, cabeceras, códigos de autorización, verifier ni tokens. Los errores posteriores de guardado tampoco exponen mensajes arbitrarios del cifrado.

## Validación y límites

Build y 529 pruebas en 59 archivos pasan; 21 casos cubren Gmail y transporte: límites de destinos/métodos, opciones privadas, propagación de cancelación, ausencia de reintentos, errores Node/Chromium y sanitización de causas/cuerpos. El recorrido Electron aislado pasa, conservando autorización al recoger/navegar/ocultar, permisos y la cápsula única.

Una sonda aislada de Electron usa el mismo adaptador de producción contra Google, sin credenciales ni código de autorización. Google devuelve HTTP 400 al POST incompleto de tokens y HTTP 401 al GET no autenticado de mensajes. No se lee ningún buzón. La sesión sigue en memoria y sin cookies. Node también responde en esta sonda: no se afirma que el fallo anterior fuera permanente ni se reproduce su causa histórica. Evidencia local: docs/evidence/gmail-network-probe.json.

No se completa consentimiento Google real ni se lee correo con la cuenta del usuario. Tras actualizar el EXE debe iniciarse una conexión nueva desde Gmail; no se reutiliza el callback/código anterior. Se conserva el límite físico previo de Computer Use, sin entradas de Chrome por otra vía. No se cambian hooks/confianza, configuraciones históricas ni se detiene Codex. No hay llamadas al modelo ni commit/push.

Fuentes oficiales: [ses.fetch y sesiones en memoria](https://www.electronjs.org/docs/latest/api/session), [OAuth de aplicaciones de escritorio Google](https://developers.google.com/identity/protocols/oauth2/native-app).

## Entrega

Único Desktop/ZEN.exe sustituido, SHA256 81db141a122b6d8b2e5b0e7cd0e3072d98e3af1b7cf3a9102cf00aabddf5ce2b, idéntico al portable probado. Respaldo anterior dentro de release/desktop-backups. La comprobación inicial a los ocho segundos no acreditó el bundle; no se atribuye a un fallo de código. Un nuevo arranque normal con stderr vacío y una comprobación independiente mediante CIM confirman los procesos con main.cjs idéntico al probado y un único observador nativo activo. Configuración/cuentas preservadas, sin detener Codex. Evidencia local: docs/evidence/gmail-network-deployment.json.
