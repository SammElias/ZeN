# Acceso por correo y claves de acceso · 07/10/2026

**Actualización vigente:** el usuario añadió Windows Hello y volvió a probar; introducir el correo siguió llevando a la ficha de Google. No se ha demostrado acceso web autenticado. Autorizó después el [chat nativo con conexión oficial de ChatGPT](chatgpt-native.md), implementado como alternativa separada. Las notas de passkeys siguientes conservan el diagnóstico y las pruebas sintéticas anteriores; no son una instrucción para repetir la creación de la clave.

El usuario informa de que introducir su correo vuelve a la ficha de Google y confirma que su cuenta ofrece «Añadir clave de acceso» en ChatGPT. Esa confirmación acredita la opción disponible; no acredita que haya creado una clave ni iniciado sesión dentro de ZEN.

Confirmación posterior del usuario: clave creada en otro gestor o en el móvil. El proveedor/dispositivo y la autenticación dentro de ZEN siguen por verificar; no se presume que esté almacenada en Windows Hello.

El usuario concreta el gestor: **Google Password Manager**. ZEN no integra la sincronización del perfil Chrome. La vía a probar es un móvil que disponga de esa clave mediante el mismo gestor y cuenta, o una clave adicional en Windows Hello. No se ha verificado ni importado su clave ni una sesión personal.

La ficha es generada por ZEN al interceptar una ruta de acceso a Google. No es un error recibido de Google ni permite inferir una contraseña incorrecta. La descripción del usuario es compatible con un correo que redirige al proveedor asociado a su cuenta. Repetir el correo no selecciona otro método. Google restringe OAuth en agentes integrados bajo control del desarrollador; el acceso externo mantiene una sesión independiente.

## Implementado

- Ficha que explica el retorno a Google también después de introducir un correo. «Probar clave de acceso» abre el inicio de sesión oficial de ChatGPT dentro de ZEN; la página determina los métodos disponibles. «Guía de claves de acceso» abre la documentación oficial. Se mantienen retorno y acceso externo explícitos.
- Selector nativo para `select-webauthn-account`: cuenta elegida por el usuario, sitio HTTPS y relying party visibles; sin selección automática, almacenamiento de credenciales ni IPC para claves/cookies. Antes de añadir el selector, `navigator.credentials.get()` con credencial virtual devolvía `NotAllowedError`; Electron cancela esta petición cuando falta su manejador.
- Selección acotada a ocho cuentas y 60 segundos, al frame principal de una vista propia visible. Se cancela al ocultar, navegar, cambiar de contexto o cerrar; una elección tardía no reanuda el acceso. La cuenta se devuelve únicamente al callback nativo del mismo pedido.
- Agente guardado, JSON Live, permisos restantes y perfil independiente conservados. No se cambia el User-Agent, se transfieren sesiones de Chrome ni se ejecutan llamadas de modelo/API.

## Probado

Build e interfaz en Edge: explicación del retorno, guía, botón al inicio oficial, recuperación, pantalla estrecha, teclado y borrador conservado. Electron real con páginas HTTPS sintéticas: formulario de correo ficticio que redirige a Google, URL limpia y correo no retenido en la ficha, aislamiento y persistencia entre dos procesos.

WebAuthn real del navegador de ZEN con autenticador virtual y diálogo de elección simulado: registro y firma de credencial residente, cancelación explícita, petición invalidada al ocultar, elección tardía rechazada y frame/sitio ajenos rechazados. Ningún autenticador, cuenta o PIN personal se ha usado. Evidencias: `docs/evidence/browser-passkey-native.json` y `browser-passkey-navigation.json`.

Ejecutable actualizado en `C:\Users\samme\Desktop\ZEN.exe` después de verificar el paquete y su extracción/arranque. Hash y alcance en `docs/evidence/browser-passkey-desktop.json`; versión anterior respaldada dentro de `release/desktop-backups/`. La compilación conjunta incorpora el estado del proyecto compartido; no acredita todas las funciones ni las modificaciones concurrentes de interfaz como objetivo completo.

## Pendiente de prueba física

1. En Chrome, ChatGPT → Configuración → Seguridad → Añadir clave de acceso. Elegir Windows Hello/este dispositivo si está disponible, un gestor compatible o el móvil, y completar la creación. Esta acción la realiza el usuario; ZEN no crea ni exporta su clave. El usuario ya informa de haberla creado fuera de Windows Hello.
2. Reiniciar el nuevo ZEN.exe, entrar en Navegador y pulsar «Probar clave de acceso» en la ficha. Introducir el mismo correo y completar el método que ofrezca ChatGPT y la selección nativa cuando aparezca.
3. Para una clave en el móvil, probar «Usar otro dispositivo» y la lectura del QR cuando el proveedor lo ofrezca. Para un gestor, comprobar que esté disponible en el diálogo del sistema. Después verificar sesión autenticada y conservación tras reiniciar ZEN. Si vuelve a Google, la disponibilidad de «Añadir» no ha demostrado un método primario compatible en esa cuenta. No se acredita acceso real hasta completarlo.

Windows Hello real, privilegios físicos del sistema, cuenta ChatGPT y uso web autenticado siguen pendientes. El soporte virtual no garantiza esos resultados. No se ha validado un inicio de sesión de Google integrado.

Fuentes: [inicio de sesión OpenAI](https://help.openai.com/en/articles/7426629-why-cant-i-log-in-to-chatgpt), [claves de acceso de OpenAI](https://help.openai.com/en/articles/20001039-passkeys-to-secure-your-openai-account), [selector WebAuthn de Electron](https://www.electronjs.org/docs/latest/api/session#event-select-webauthn-account), [Windows Hello](https://learn.microsoft.com/en-us/windows/apps/develop/security/reference), [Google Password Manager](https://support.google.com/chrome/answer/13168025?co=GENIE.Platform%3DDesktop&hl=en), [restricción de Google OAuth](https://developers.google.com/identity/protocols/oauth2/policies).
