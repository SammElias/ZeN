# Iconos desplegables y cliente Gmail — 24/10/2026

## Abrir y recoger

Los cinco iconos Home, Spotify, Gmail, Codex y Avisos funcionan como interruptores de la cápsula. Si está recogida, un clic abre la sección elegida; si está desplegada, cualquier icono la recoge, también si es distinto del seleccionado. Se conservan todos los iconos y el anclaje. El proceso principal resuelve cada clic con su estado actual para que dos clics rápidos no dependan de una copia atrasada del renderer.

El cambio se limita a los iconos de cabecera. Las tarjetas de Home, botones internos de navegación, acceso a permisos y enlaces explícitos siguen abriendo su destino. Recoger no concede permisos ni cancela una autorización Gmail vigente: se conserva la separación entre suspender lecturas y cancelar OAuth.

## Causa del invalid_request

El cliente Desktop configurado exige client_secret en el canje. Una sonda aislada con un código deliberadamente inválido recibe invalid_request y la descripción exacta de secreto ausente sin ese parámetro. Con las credenciales del JSON Desktop ya descargado y coincidente recibe invalid_grant, que es el resultado esperado para ese código sintético. No se utiliza, recarga ni vuelve a canjear un código real del usuario y no se lee ningún buzón. La sonda devuelve únicamente estados y clasificaciones permitidas, nunca el secreto ni cuerpos remotos.

ZEN incorpora client_secret en el POST fijo de canje y en la renovación; nunca en la URL de autorización, lecturas Gmail, renderer, logs o recursos del paquete. PKCE, state, loopback, cifrado del token, scopes de solo lectura y cancelación siguen vigentes. El error exacto de secreto ausente ahora ofrece importar el JSON de escritorio en vez del mensaje genérico.

Configuración de Google permite seleccionar el JSON oficial mediante diálogo local. Main limita la lectura a 16 KB, acepta la estructura installed y descarta endpoints del documento; el código conserva sus destinos HTTPS fijos. El secreto se cifra con safeStorage del perfil real fuera del repositorio en gmail-client-secret.bin, vinculado al Client ID. Cambiar de cliente retira el secreto previo; una credencial de otro ID no se reutiliza aunque se reponga su archivo. Guardar el mismo ID conserva su secreto. Importar el mismo cliente no modifica tokens existentes ni reescribe el archivo público. Los errores de importación/cifrado tienen mensajes locales fijos.

Se importó el JSON existente que coincide exactamente con el Client ID configurado, sin crear clientes, cambiar APIs/scopes/facturación ni prestar credenciales de Codex. Una instancia nueva de CompanionGmail con safeStorage del perfil real confirma la lectura de la credencial cifrada. El JSON descargado original queda en su ubicación; no se copia al repositorio ni al EXE. Evidencia local: docs/evidence/gmail-oauth-parameters.json y gmail-desktop-credential-import.json.

## Validación y límites

Build y 534 pruebas en 59 archivos pasan. Veintiséis casos de Gmail/transporte incluyen canje/renovación con secreto, cifrado, ausencia en status/URL pública, bloqueo de JSON web/grande/inválido, vinculación al cliente, conservación de formato público y errores de cifrado. El recorrido Electron aislado pasa: los cinco iconos abren y recogen con clic sobre el mismo o distinto icono, los clics rápidos usan el estado de main, cabecera/anclaje permanecen estables y aparece la importación Desktop. Se mantienen las comprobaciones de OAuth al recoger/ocultar/navegar, privacidad y permisos de un uso.

La conexión final requiere que el usuario pulse Conectar con Google y complete un intento nuevo. No se afirma consentimiento completo ni lectura de Gmail real. No se han realizado entradas físicas en Chrome ni eludido su límite previo de Computer Use. No hay API de modelos, cambios de hooks/confianza, interrupción de Codex ni commit/push. La entrega mantiene únicamente Desktop/ZEN.exe, con respaldo dentro de release.

Referencia oficial: [OAuth para aplicaciones de escritorio de Google](https://developers.google.com/identity/protocols/oauth2/native-app).

Entrega terminada: SHA256 40c9a7a187909e60db8c23216454b47dd9fcb32e95eb30bc2a2802daf68b5b5e, idéntico al EXE extraído y probado. Desktop/ZEN.exe sustituido con respaldo dentro de release; arranque normal y bundle verificados, observador nativo único y archivos de cuenta/configuración conservados, incluida la nueva credencial cifrada. Evidencia local: docs/evidence/icon-toggle-gmail-deployment.json.
