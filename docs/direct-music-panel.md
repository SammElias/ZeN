# Música directa en ZEN — 24/10/2026

El usuario pide navegación propia con canción, carátula y controles, sin tener que preparar una petición en Codex. «Tu espacio» prioriza Spotify, Gmail y Conexiones; Codex conserva un acceso separado y el seguimiento del chat fijado. Spotify abre ahora un reproductor local, sin formulario ni traspaso al chat. Gmail conserva su integración revisada anterior; no se afirma que sea un lector de correo nativo.

## Conexión utilizada y API necesaria

El reproductor utiliza la API multimedia local de Windows, GlobalSystemMediaTransportControlsSessionManager. No requiere Spotify Web API, OAuth, contraseña, claves de OpenAI ni solicitudes al modelo. Es control remoto del reproductor existente, no un nuevo motor de audio.

El usuario elige explícitamente Spotify o una sesión de navegador entre las que Windows publica. Antes de seleccionar se leen únicamente las identidades de las fuentes admitidas, no títulos de ventanas, URLs, páginas ni el contenido multimedia de fuentes ajenas. Al elegir se muestran título, artista, álbum y carátula que comparte esa sesión. Una sesión de Chrome/Edge/Firefox se identifica como navegador: Windows no acredita que sea Spotify ni una pestaña concreta. La interfaz avisa de ese alcance. No se cambia el foco ni se inyectan teclas.

Play, pausa, anterior, siguiente, aleatorio y repetición se solicitan por los métodos oficiales de la sesión seleccionada. Las capacidades observadas determinan qué botones están habilitados. No hay cambios optimistas: aceptar un comando es una solicitud al reproductor y la UI vuelve a leer su estado. El progreso es el tiempo informado por la sesión; no se inventan porcentajes. El volumen queda en Windows/Spotify.

Búsqueda, biblioteca, playlists y control de dispositivos remotos requieren Spotify Web API con OAuth y una aplicación registrada (Client ID). Para una aplicación de escritorio, Spotify recomienda Authorization Code con PKCE sin secreto incrustado. Los controles de reproducción de Web API requieren Premium. No se implementa ni se promete una conexión inexistente, no se extraen credenciales del conector de Codex y no se invoca ese conector desde un chat duplicado.

Fuentes oficiales: [sesiones multimedia de Windows](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession), [capacidades de los controles](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionplaybackcontrols), [WinRT desde escritorio .NET](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/winrt-apis-desktop-apps), [OAuth PKCE de Spotify](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [reproducción Web API y Premium](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).

## Autoridad y privacidad

Un auxiliar fijo Zen.Media, sin shell, expone únicamente fuentes admitidas, selección, lectura y seis acciones enumeradas. Los tokens de sesión son aleatorios y viven en RAM; el renderer no puede escoger un programa, una URL o un comando. Cambiar las sesiones de Windows revoca la selección, sin retarget automático. Main valida origen/frame del IPC, ventana de integraciones visible, pestaña Spotify, sesión concreta y política antes y después de cada consulta. La cápsula y otros paneles no pueden usar estos IPC.

Las peticiones nativas se serializan con una cola acotada. Cada comando de reproducción tiene un identificador de un uso, se comprueban sus capacidades y nunca se reintenta tras un error o timeout. Cerrar, minimizar, cambiar de pestaña, pausar o activar Presentación retira la selección; los resultados tardíos no se devuelven como datos válidos. Cerrar el auxiliar no detiene la música. Solo el panel de música recibe sus metadatos, por llamadas privadas, sin añadirlos al broadcast de actividad de Codex.

La actualización se realiza cada dos segundos únicamente mientras el panel está visible con una sesión seleccionada. Datos y carátulas quedan en RAM, sin historial, logs, almacenamiento, envío a Codex, Figma ni voz. Las imágenes se acotan por bytes y dimensiones, se reducen a 256 px y se recodifican a PNG antes de IPC; no se cargan URLs remotas en el renderer. Presentación retira inmediatamente carátula, título y controles.

## Validación

Build y 487 pruebas en 54 archivos pasan, con cuatro workers. Se comprueban selección explícita, aislamiento del destino, comandos enumerados, deduplicación, capacidades, serialización, cierre, resultados tardíos privados y ausencia de reintentos.

El auxiliar real compila con WinRT y detecta Spotify y Chrome en este equipo. Una lectura de Spotify ha confirmado título, artista, carátula y capacidades sin guardar su contenido ni ejecutar ninguna acción real de reproducción. Evidencia local: docs/evidence/windows-media-read.json. Esta lectura no demuestra que play, pausa, siguiente, aleatorio o repetición se hayan ejecutado físicamente.

El recorrido Electron aislado usa una sesión multimedia sintética identificada como fixture. Valida el reproductor directo, selección, control solicitado, capacidades deshabilitadas, origen de IPC, Presentación y tamaños 380/600. Se conserva la suite de actividad, permisos, icono orbital e integración Gmail. Se revisa la captura de la UI sintética. No se prueba físicamente el navegador ni se elude la restricción anterior de Computer Use.

Distribución: solo Desktop/ZEN.exe, respaldos y compilaciones dentro de release. Configuraciones históricas, chat fijado, hooks y confianza conservados. Sin commit ni push en esta petición. Entrega y límites en docs/evidence/direct-music-deployment.json.
