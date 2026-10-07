# Home, Chat y Navegador — 07/10/2026

Petición del usuario: navegación superior y acceso a Google/ChatGPT desde ZEN con sesión persistente. Sin API de ZEN para mensajes escritos en la web.

## Uso y diseño

- **Home:** robot, acceso al chat y al navegador. La apertura habitual conserva Chat para mantener el flujo anterior.
- **Chat:** último mensaje, borrador, adjuntos y controles anteriores. Cambiar de sección conserva el borrador. Créditos e importes siguen retirados.
- **Navegador:** vista integrada hasta 1040 DIP, adaptada al monitor, dirección HTTPS, Atrás/Adelante, Recargar/Detener, accesos Google/ChatGPT y Abrir fuera. El chat mantiene 640 DIP y las cápsulas 320×72 / 72×320. El navegador se oculta al recoger o minimizar; no destruye la sesión.
- Perfil `persist:zen-user-browser-v1` en el directorio de datos de la aplicación, fuera del repositorio y del paquete. Cookies persistentes y almacenamiento local sobreviven al cierre; los proveedores pueden caducar o revocar sesiones. No importa cookies de Chrome/Edge ni guarda contraseñas en la configuración de ZEN.
- Entrar en Navegador desconecta GPT-Live de ZEN y desactiva su activación automática/atajo de voz mientras esa sección está seleccionada. Una tarea API ya iniciada continúa; navegar no cancela trabajo anterior ni cambia cómo se factura Chat.
- ChatGPT usa la cuenta y los modelos que su web ofrezca al usuario; no se promete acceso a SOL ni se selecciona otro modelo automáticamente. ZEN no lee, envía ni automatiza mensajes de esa web.

## Inicio de sesión y límites

Google no permite OAuth en agentes integrados controlados por aplicaciones. Los destinos `accounts.google.com` se detienen con explicación y salida al navegador habitual. Ese acceso externo **no inicia sesión dentro de ZEN**. No se oculta Electron ni se transfieren cookies/tokens para eludirlo. En ChatGPT el usuario puede usar los métodos de acceso que su cuenta permita; su autenticación real sigue pendiente.

La web pública de ChatGPT y Google cargó en Chromium integrado en una sesión aislada sin cuenta. No se introdujeron credenciales, no se enviaron mensajes y no se llamó a modelos/API. La carga pública no acredita acceso autenticado ni disponibilidad de un modelo concreto.

Micrófono web: solo audio para `https://chatgpt.com`, con diálogo nativo específico. Otros permisos se deniegan. Al ocultar la página después de conceder audio se recarga para cortar la captura y revocar ese permiso; los accesos emergentes se cierran. Voz web física pendiente. Las descargas remiten al navegador habitual; la selección manual de archivos mediante el sitio funciona como navegación web normal.

## Aislamiento

`WebContentsView` separado sin preload ni `window.zen`, Node desactivado, sandbox/contextIsolation/webSecurity activos. Sesión diferente de los visores del agente. No API para exportar cookies, ejecutar scripts, leer páginas ni extraer conversaciones. IPC nuevo validado exclusivamente desde el frame local de ZEN; no disponible en Preferencias. Se rechazan esquemas locales, credenciales en URL y protocolos externos. Ventanas emergentes limitadas y con el mismo aislamiento. Certificados y restricciones del proveedor no se eluden.

## Verificación

- `tests/browser.test.ts`: límites de URL/IPC y geometría en tres bordes.
- `docs/evidence/browser-native.json`: Electron real, páginas HTTPS sintéticas; cookies/almacenamiento retenidos entre dos procesos, aislamiento, historial, ventanas emergentes, esquemas bloqueados y ocultación.
- `docs/evidence/navigation-ui.json`: Home/Chat/Navegador, borrador conservado, cápsula y pantalla pequeña; ninguna llamada API.
- `docs/evidence/browser-public-web.json`: carga pública real de Google y ChatGPT. Captura de ChatGPT inspeccionada en `test-results/browser-public-chatgpt.png` (archivo local ignorado).
- Prueba Electron/paquete: `integratedBrowserVerified` comprueba navegación desde el renderer local, IPC, vista nativa visible con tamaño útil, renderer web sin privilegios y ocultación al volver a Chat. Datos de sitio sintéticos en esta prueba.
- Agente guardado y configuración GPT-Live conservados byte a byte. No acredita objetivo global ni inicio de sesión/voz reales.

Fuentes: [políticas OAuth de Google](https://developers.google.com/identity/protocols/oauth2/policies), [sesiones Electron](https://www.electronjs.org/docs/latest/api/session), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [suscripción y API separadas](https://learn.chatgpt.com/docs/pricing).
