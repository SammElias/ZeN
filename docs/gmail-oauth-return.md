# Retorno de Google a ZEN — 24/10/2026

El usuario muestra ERR_CONNECTION_REFUSED en 127.0.0.1 después de autorizar Gmail y autoriza revisar su sesión de Google Cloud. La revisión de la consola confirma Gmail API Enabled y el Client ID configurado de tipo Desktop. No se modifican APIs, clientes, scopes, facturación, claves ni permisos de Google Cloud, ni se muestran secretos. La documentación oficial sigue indicando navegador del sistema, PKCE y retorno loopback para aplicaciones de escritorio: https://developers.google.com/identity/protocols/oauth2/native-app.

Se confirma un defecto local compatible con la captura: main cancelaba OAuth al recoger/ocultar/cambiar de sección y el desmontaje de Gmail también solicitaba cancelación. Eso cerraba el receptor temporal que debía recibir a Google. La causa exacta de aquel intento no se recupera desde la captura: un intento caducado o recargado también puede apuntar a un puerto ya cerrado. El perfil no tenía credencial Gmail cifrada al comenzar la revisión.

## Corrección

La vida de la autorización iniciada explícitamente se separa de las lecturas del buzón. Recoger, ocultar o navegar cancela las lecturas y limpia los identificadores, pero conserva el receptor OAuth durante el intento de cinco minutos. El canje solo puede usar ese intento con PKCE/state y permanecer permitido por la política global. Presentación, pausa, Cancelar, desconectar, cambiar cliente o cerrar ZEN cancelan también OAuth; una respuesta tardía no guarda tokens. Ninguna lectura del buzón queda autorizada por el hecho de completar la conexión en segundo plano.

El receptor escucha exclusivamente en 127.0.0.1 y valida método, Host, ruta, caducidad y state antes de consumirlo una vez. Responde al favicon sin alterar el flujo. El navegador recibe el resultado solo después del canje/cifrado real; el retorno redirige a /oauth2/complete sin código ni state en la URL final. Un acuse temporal de 60 segundos admite recargas sin canjear de nuevo el código. La página de fallo no afirma conexión. Las credenciales siguen protegidas por safeStorage del perfil real; un nuevo acceso interactivo no hereda el refresh token de otra cuenta anterior.

Gmail explica que se puede recoger ZEN mientras se completa Google. El polling de estado se suspende con el documento oculto y se revisa al volver; los mensajes se retiran de la vista oculta y se consultan de nuevo solo al regresar a la sección autorizada. No hay nuevos scopes, APIs de modelos ni credenciales tomadas de Codex.

## Verificación

Build y 521 pruebas en 58 archivos pasan. Trece pruebas de Gmail usan callback HTTP loopback real y Google simulado: PKCE, state incorrecto, cifrado, GET acotados, permisos, callback tras ocultar sin lecturas de correo, recargas sin doble canje, fallo de canje, respuesta tardía tras cancelar y ausencia de refresh token prestado entre cuentas.

El recorrido Electron aislado conserva las comprobaciones anteriores y confirma que el estado de autorización sobrevive a recoger, cambiar de sección y ocultar/restaurar la cápsula. No se ha completado un nuevo consentimiento Google real ni leído correo real. El usuario debe iniciar un intento nuevo desde Conectar con Google; recargar la pestaña antigua no recupera su intento cerrado. La revisión del navegador fue de solo lectura y conserva la restricción previa de Computer Use sobre las entradas físicas de Chrome.

Entrega única Desktop/ZEN.exe con respaldo dentro de release y prueba de extracción/arranque. Evidencia local: docs/evidence/gmail-oauth-return-deployment.json.

Entrega terminada: SHA256 d8b7af29b9fa2f2146b73025c34b8fc1245b1220a622024b18ed258699bdc6a7. Copia y main del arranque normal coinciden con el paquete probado; observador activo único y archivos de cuenta conservados. El cliente público del perfil vuelve a coincidir con el Desktop revisado. La consola quedó en Gmail API mostrando Enabled; no se hicieron cambios externos ni commit/push.
