# Home, Chat y Navegador — 07/10/2026

**Retirado por petición posterior del usuario.** La aplicación vigente conserva solo Home y Chat; navegador incrustado y vinculación nativa con ChatGPT retirados. Este documento describe la versión histórica. [Estado actual](home-chat-only.md).

Petición del usuario: navegación superior y acceso a Google/ChatGPT desde ZEN con sesión persistente. Sin API de ZEN para mensajes escritos en la web.

## Uso y diseño

Petición posterior: navegación con iconos SVG (casa, conversación y globo), nombre accesible y tooltip, sección activa resaltada. Visible solo en modo expandido.

Tema vigente por la siguiente petición del 07/10/2026: superficies blancas con relieve suave, módulos negros y morado intenso. El diseño y la nueva entrega están documentados en [tema blanco y morado](white-violet-theme.md); la navegación conserva sus iconos de 15 px sin etiquetas visibles.

### Navegación con contorno curvo · 07/10/2026

Referencia visual aportada por el usuario: barra oscura redondeada, insignia circular y contorno que envuelve la sección elegida. Adaptada a ZEN con su robot original y acento violeta. Por la última petición, Home, Chat y Navegador muestran únicamente iconos discretos de 15 px, sin etiquetas visibles; conservan nombre accesible y tooltip. Los botones de 44×44 px facilitan pulsarlos. La selección mueve el contorno en 320 ms, sin desplazar botones ni cambiar dimensiones por delta. Movimiento reducido desactiva la transición. Tab, Enter/Espacio y flechas/Home/End permiten navegar con teclado.

La barra de navegación ocupa 46 DIP de alto y la cabecera desplegada reserva 60 DIP, también en pantallas estrechas; la cápsula recogida y los bordes laterales mantienen sus dimensiones e interacciones. El robot conserva el acceso al último mensaje y el arrastre. Se mantienen borrador, página web, voz, contexto, recuperación de acceso Google y controles de tareas.

Build, [navegación en Edge](evidence/navigation-ui.json) e interfaz completa aprobados: ausencia de etiquetas visibles, pantalla estrecha, teclado, movimiento reducido, cambios de página, contexto conservado y streaming sin cambios de cabecera/altura. El ensayo negativo del antiguo bucle de altura adapta su breakpoint a la nueva cabecera: oscila 546/582 con el fallo inyectado y queda estable en 546 al retirarlo. Sin llamadas API nuevas. La prueba de cuenta real y dispositivos físicos continúa pendiente.

Entregado en `C:\Users\samme\Desktop\ZEN.exe`, con extracción/arranque e integraciones anteriores verificados. [Pruebas de navegación](evidence/navigation-curved-ui.json), [streaming/interfaz](evidence/navigation-curved-stream.json), [despliegue](evidence/navigation-curved-desktop.json) y [vista de la barra](evidence/navigation-curved-header.png). El ejecutable anterior queda respaldado en `release/desktop-backups/`; conserva perfil y ajustes. Cambio local aún sin commit/push.

- **Home:** robot, acceso al chat y al navegador. La apertura habitual conserva Chat para mantener el flujo anterior.
- **Chat:** último mensaje, borrador, adjuntos y controles anteriores. Cambiar de sección conserva el borrador. Créditos e importes siguen retirados.
- **Navegador:** abre `https://chatgpt.com/` al entrar por primera vez, sin cargarla al arrancar la cápsula. Al cambiar de sección conserva la página actual. Por petición posterior del usuario, ChatGPT es la página inicial predeterminada. Vista integrada hasta 1040 DIP, adaptada al monitor, dirección HTTPS, Atrás/Adelante, Recargar/Detener, accesos Google/ChatGPT y Abrir fuera. El chat mantiene 640 DIP y las cápsulas 320×72 / 72×320. El navegador se oculta al recoger o minimizar; no destruye la sesión.
- Perfil `persist:zen-user-browser-v1` en el directorio de datos de la aplicación, fuera del repositorio y del paquete. Cookies persistentes y almacenamiento local sobreviven al cierre; los proveedores pueden caducar o revocar sesiones. No importa cookies de Chrome/Edge ni guarda contraseñas en la configuración de ZEN.
- Entrar en Navegador desconecta GPT-Live de ZEN y desactiva su activación automática/atajo de voz mientras esa sección está seleccionada. Una tarea API ya iniciada continúa; navegar no cancela trabajo anterior ni cambia cómo se factura Chat.
- ChatGPT usa la cuenta y los modelos que su web ofrezca al usuario; no se promete acceso a SOL ni se selecciona otro modelo automáticamente. ZEN no lee, envía ni automatiza mensajes de esa web.

## Inicio de sesión y límites

El retorno a Google tras escribir un correo y el nuevo soporte de claves de acceso están documentados en [acceso y claves de acceso](browser-sign-in.md). Selector nativo y WebAuthn probados con autenticador virtual; Windows Hello y sesión real del usuario siguen pendientes.

Google no permite OAuth en agentes integrados controlados por aplicaciones. Los destinos `accounts.google.com` y la entrada Google de ChatGPT se detienen con una ficha local de recuperación. Ese acceso externo **no inicia sesión dentro de ZEN**. No se oculta Electron ni se transfieren cookies/tokens para eludirlo. En ChatGPT el usuario puede usar los métodos de acceso que su cuenta permita; su autenticación real sigue pendiente.

### Corrección de página blanca · 07/10/2026

La captura aportada mostraba `chatgpt.com/auth/login_with?connection=google-oauth2`: el aviso de ZEN aparecía, pero la vista nativa conservaba la página intermedia blanca. Se intercepta ahora esa entrada antes del salto a Google, tanto por navegación como por cambio de ruta de una SPA. La vista nativa se oculta y su documento se sustituye por `about:blank` para liberar la página y su audio; el perfil persistente no se borra.

La ficha ofrece **Volver a ChatGPT** y **Abrir navegador habitual**, indicando que las sesiones son independientes. Recuperar/Recargar vuelve a una dirección limpia sin callbacks de autenticación. Las notificaciones tardías de carga no reemplazan la ficha; recoger/desplegar conserva la recuperación. La etiqueta general es «Perfil local · sesión independiente», sin afirmar que ya existe una cuenta autenticada.

Probado: build, 312 tests, [interfaz](evidence/navigation-ui.json) y [Electron con sitios HTTPS sintéticos](evidence/browser-native.json). Se comprueban entrada Google, cambio de ruta SPA, vista oculta, retorno visible, persistencia de cookies entre dos procesos y ausencia de Node/bridge en la página. Cero llamadas API y sin credenciales personales introducidas. **No se acredita iniciar sesión con Google dentro de ZEN ni otro método con una cuenta real.** La restricción está documentada en la [política OAuth de Google](https://developers.google.com/identity/protocols/oauth2/policies).

La corrección está entregada en `C:\Users\samme\Desktop\ZEN.exe`: extracción y arranque del ejecutable único pasados; el hash del escritorio coincide con el ensayado. [Despliegue y hashes de la corrección](evidence/browser-recovery-desktop.json). Se conservó el EXE anterior dentro de `release/desktop-backups/`. Es una modificación local sobre `17f5d3a`, todavía sin commit ni push; no sustituye la verificación manual de una cuenta.

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
