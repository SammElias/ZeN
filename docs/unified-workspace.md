# Una sola ventana y posición persistente — 24/10/2026

El usuario pide que las integraciones reutilicen la propia ventana de la cápsula, con Home, Spotify, Gmail y Codex, y que se abran donde se dejaron. La ampliación sustituye las ventanas independientes de trabajo de las entregas anteriores. Solo Avisos conserva una ventana separada; la revisión completa de permisos está en Codex → Permisos dentro de ZEN.

## Ventana común

El mismo BrowserWindow se despliega desde la cápsula. La navegación por iconos cambia el contenido, sin crear ventanas, reiniciar el seguimiento ni cambiar la geometría. Home ofrece accesos a música, correo, trabajo y preferencias. Spotify conserva el reproductor nativo de Windows. Codex muestra las acciones observadas del chat fijado, sus resúmenes y permisos; la conversación/ejecución continúa en Codex del escritorio.

Ajuste posterior del usuario: mantener la cápsula y, al pulsar Integraciones (cuatro cuadrados), extenderla a la derecha con cuatro iconos compactos de Home, Spotify, Gmail y Codex. La altura continúa en 60 DIP; la extensión es de hasta 196 DIP, limitada al área útil y desplazada a la izquierda cuando falta espacio. No modifica el anclaje guardado. Elegir un icono abre su interfaz en la misma ventana; Recoger restaura la cápsula. La navegación desplegada también usa iconos con nombre accesible y tooltip. Abrir la tira no consulta Gmail ni Spotify ni concede permisos.

Al recoger, se guarda el rectángulo normal de la ventana de trabajo y se restaura el anclaje de la cápsula. Al desplegar de nuevo se recuperan posición, tamaño y estado de maximización. El área de trabajo y el identificador de monitor permiten ajustar el rectángulo si cambia su origen, resolución o disponibilidad. Las coordenadas son DIP, admiten monitores con origen negativo y quedan acotadas al área útil disponible. Avisos tiene una posición independiente.

La geometría se guarda localmente en companion-window-state.json, dentro del perfil real de ZEN y fuera del repositorio. Se captura desde main, sin rutas ni coordenadas arbitrarias del renderer. Movimiento y redimensionado se agrupan antes de escribir; recoger, cerrar y salir guardan el estado pendiente. La invocación en el monitor del puntero sigue aplicándose a la cápsula; una ventana desplegada conserva su ubicación.

El workspace no se vuelve a enfocar ni redimensionar al recibir actividad. La navegación es explícita. El arrastre se limita a la cabecera, evitando que los campos, enlaces y el contenido arrastren la ventana. Los estados, trazas, silencio, retorno a la aplicación, atajos y avisos se conservan.

## Gmail propio

El usuario proporciona un Client ID de Google de tipo Desktop. Se configura en gmail-client.json fuera del repositorio; su valor no se incorpora al código ni al paquete. La pantalla de Gmail permite iniciar sesión en el navegador del sistema, listar Recibidos, buscar, paginar de 20 en 20 y leer la versión de texto de los mensajes. El acceso solicitado es únicamente gmail.readonly. No hay endpoints de envío, borrado, marcado ni modificación.

OAuth utiliza PKCE S256, nonce aleatorio, callback HTTP ligado exclusivamente a 127.0.0.1 con puerto efímero, ruta y Host verificados, comparación de state y código de un uso. El servidor caduca a los cinco minutos; cambiar de sección, recoger, ocultar, pausar, Presentación o salir cancelan la autorización pendiente y las consultas. Los resultados tardíos se rechazan. Las URLs y endpoints se construyen en main con destinos fijos, sin claves ni tokens en IPC o logs.

Los tokens se cifran mediante safeStorage de Electron dentro del perfil real y se guardan en gmail-oauth.bin. No se extraen ni reutilizan tokens de Codex. El Client ID es un identificador público; la contraseña de Google se introduce únicamente en Google. Desconectar este PC elimina las credenciales locales propias. Las configuraciones históricas de agente/Live permanecen intactas.

Los mensajes solo se consultan en la sección Gmail y con la política activa. Listado y lectura usan GET, con respuestas acotadas, paralelismo de cuatro y un conjunto limitado de identificadores previamente listados. Los cuerpos se muestran como texto escapado, sin ejecutar HTML, descargar imágenes remotas ni seguir instrucciones del correo. Contenido y búsquedas no se envían al modelo, a voz, a Figma ni al broadcast de actividad; quedan en RAM. La autorización real y la disponibilidad de Gmail API en el proyecto del usuario se comprueban al conectar con Google, no se presuponen por disponer de un Client ID.

Documentación oficial: [OAuth para escritorio y PKCE](https://developers.google.com/identity/protocols/oauth2/native-app), [scopes de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [listado de mensajes](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list).

## Permisos y aislamiento

La cápsula recogida, Home, Spotify, Gmail y Avisos no pueden decidir permisos. Solo el origen local de la ventana común con la ruta principal Codex → Permisos activa puede responder una propuesta completa y vigente. Sus detalles pendientes se retiran del snapshot y de los pasos asociados fuera de esa ruta; Presentación también los elimina. Hub conserva la validación de chat/turno, caducidad y un uso. Pulsar un estado abre la revisión, nunca decide.

Spotify y Gmail validan sección, ventana, visibilidad y política en main. Avisos no puede leer correo ni controlar música. Al cambiar de sección se retiran los auxiliares y peticiones privadas correspondientes. No se añaden chat por API, automatización de navegador ni reanudaciones concurrentes del chat fijado.

## Validación y entrega

Build y 503 pruebas en 56 archivos pasan. Las nuevas pruebas cubren persistencia entre instancias, pantallas retiradas/negativas/pequeñas, extensión lateral sin alterar el anclaje, datos corruptos, OAuth con PKCE y callback real de loopback frente a HTTP Google simulado, state incorrecto, cifrado aislado, lecturas GET, páginas ajenas, cancelación y ausencia de reintentos.

El recorrido Windows usa el proceso Electron real con un perfil, hooks, música y buzón sintéticos. Confirma extensión de la cápsula a la derecha sin aumentar altura, rechazo de lecturas privadas desde la tira, selección en la misma ventana y recuperación del anclaje. También confirma una sola ventana de trabajo, geometría conservada al navegar/recoger/reabrir, Avisos separado con posición propia, Spotify, Gmail, lectura, permisos completos, rechazo fuera de sección, ocultación en Presentación y anchuras 380/640. Las capturas revisadas contienen únicamente datos sintéticos.

La conexión real de Gmail queda pendiente del consentimiento humano en Google; no se ha leído correo real ni completado OAuth con la cuenta del usuario durante las pruebas. No se acredita control físico de navegador, DPI/monitores ni notificaciones/sonido: continúa vigente la restricción anterior de Computer Use. No se reinstalan hooks, no se escribe confianza ni se detiene Codex.

Se entrega solo Desktop/ZEN.exe, tras comprobar extracción/arranque, con copia idéntica al portable probado y respaldo dentro de release. No se hace commit/push. Evidencia local de despliegue: docs/evidence/unified-workspace-deployment.json.

Entrega terminada: SHA256 4c177f321da47a27225f52a3da588fe8169975b620c8c0ccee5d074f1cea0d9d. El arranque normal usa el mismo main comprobado y mantiene un único observador nativo. La configuración pública de Gmail y el identificador/carpeta fijados siguen en el perfil original.
