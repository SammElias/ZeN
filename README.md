# ZEN · compañero de Codex para Windows

ZEN muestra en una cápsula la actividad que recibe de Codex: acciones recientes, permisos, errores y final de turno. Todo el trabajo y las conversaciones continúan en Codex, con tu cuenta de ChatGPT. ZEN no envía prompts ni utiliza una API de modelos.

La interfaz usa un núcleo orbital, sin personaje. El personaje, las ilustraciones y los sonidos de Coucou no se distribuyen. Los iconos ZEN y los tonos locales son originales; se conservan los avisos de licencia del código MIT adaptado de Coucou.

La cápsula se despliega hacia abajo en una única ventana con Home, Spotify, Gmail, Codex y Avisos. Pulsar otra sección navega; repetir el icono activo recoge la cápsula. La cabecera mantiene visibles a la vez el estado de Codex y el contenido multimedia que esté reproduciendo Windows.

## Uso

- `Ctrl+Alt+Z`: mostrar la cápsula.
- `Ctrl+Alt+C`, flecha o bandeja: volver al chat de Codex observado o fijado.
- Opciones: ver las tres acciones recientes, actividad, permisos y avisos.
- Silenciar 30 minutos: suspender sonidos y notificaciones sin perder recepción ni permisos.
- Preferencias: comprobar cuenta, hooks y última señal recibida. Instalación o confianza de hooks no acredita por sí sola recepción real.
- Permisos: revisar la acción completa y permitir una vez, rechazar o devolver la decisión a Codex. La cápsula nunca aprueba por pulsar un estado.
- Home: canción actual, correos sin leer, estado de Codex y avisos pendientes. El correo se consulta al abrir Home, cada minuto mientras esté visible o con Actualizar correo.
- Spotify: reproductor de las sesiones multimedia de Windows, también publicadas por navegadores. Los controles requieren seleccionar una fuente y que esta los admita; este acceso local no usa Spotify Web API.
- Gmail: conexión OAuth propia de Google Desktop, buzón agrupado por conversación y lectura del hilo completo dentro de los límites indicados. La credencial se configura localmente; no se distribuye con el proyecto.
- Codex: última respuesta final observada del chat fijado y acceso para abrirlo en Codex.
- Presentación: ocultar detalles privados y silenciar avisos; pausar ZEN también suspende sus lecturas.

Puedes fijar un chat y una carpeta exacta mediante `companion-target.json` en el perfil de ZEN (`%APPDATA%\ZEN`). Su formato es `{ "session": "identificador-del-chat", "cwd": "C:\\ruta\\al\\proyecto", "title": "Mi chat" }`. La configuración personal queda fuera del repositorio. Las sesiones ajenas se descartan sin decidir sus permisos.

La extensión oficial de ChatGPT solo proporciona acceso al navegador a Codex. ZEN no instala otra extensión ni controla el navegador por su cuenta.

## Compilar

Requiere Windows, Node.js 22.12 o superior, .NET SDK 10 para compilar el auxiliar y Codex instalado. El auxiliar distribuido requiere .NET Runtime 10.

```powershell
npm ci
npm run build:native
npm run build
npx vitest run --maxWorkers=4
npm start
```

Para crear el ejecutable portable:

```powershell
npm run package:win
npm run package:single -- release/ZEN-<identificador-del-paquete>
```

La compilación deja los paquetes y respaldos en `release/`, ignorado por Git. La entrega local es un único `ZEN.exe` en el escritorio; no se sube un ejecutable ni se crea un GitHub Release automáticamente.

## Estado y privacidad

La entrada activa es `src/main/companion-main.ts`, con preload aislado e IPC validado. No ejecuta el chat, agente, voz, capturas ni proyectos de las versiones históricas. Se conservan sus fuentes y configuraciones como histórico inactivo; [README anterior](docs/legacy-api-readme.md).

Los hooks se instalan preservando definiciones ajenas y sin escribir confianza. Si ZEN se cierra, el permiso caduca o se pierde la conexión, la decisión vuelve a Codex. No se reintenta trabajo ni se inventa progreso desde el silencio.

Las credenciales de Gmail se cifran con la protección de Windows fuera del repositorio. Home solo obtiene el recuento de no leídos; los asuntos y cuerpos se consultan desde Gmail visible. La música usa metadata local publicada por Windows. Presentación, pausa y ocultación revocan las lecturas correspondientes y descartan resultados tardíos. Ninguna de estas integraciones envía datos a una API de modelos.

No se publican claves, perfiles, identificadores de chats personales, capturas ni telemetría local. Los informes y recorridos nativos se guardan localmente en `docs/evidence/` y `docs/ui-preview/`; algunos informes antiguos ya versionados se mantienen como históricos.

Consulta [Home](docs/home-status.md), [cápsula e integraciones](docs/capsule-downward-extension.md), [contenido de escritorio](docs/desktop-content-improvements.md), [publicación y recursos](docs/github-publication.md) y [chat fijado](docs/codex-fixed-chat.md). Las pruebas físicas de sonido, notificaciones, foco, DPI y juegos a pantalla completa tienen límites documentados; una prueba sintética no los valida.
