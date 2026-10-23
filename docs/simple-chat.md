# Chat sencillo — 08/10/2026

Petición: mantener Conversaciones y Nuevo chat y retirar las opciones que recargaban la lectura.

La cabecera del chat muestra únicamente esos dos botones con texto. Se retiran de esta vista el título duplicado, el selector de proyecto, el menú de opciones, la ficha «Dónde lo dejamos», el aviso histórico y el catálogo de archivos antiguos. Los datos y APIs de continuidad se conservan; este cambio no elimina conversaciones, archivos ni contexto. Inicio sigue ofreciendo la selección de proyecto.

Los mensajes conservan Markdown, lectura estable y respuestas parciales identificadas. Copiar aparece al pasar el cursor o enfocar la respuesta; los archivos generados mantienen su descarga. La navegación principal conserva solo Inicio y Chat; Tareas se retira de cabecera, cápsula, mascota y bandeja. La lista de Conversaciones ofrece scroll continuo sin búsqueda, filtros ni botones de paginación. Carga páginas locales de 40 filas al aproximarse al final y ordena por última actividad, de más reciente a más antigua; las fijadas no se adelantan. Incluye las archivadas del proyecto para conservar acceso a sus mensajes. Los cambios de proyecto o cierre invalidan respuestas pendientes y los avisos Live refrescan la lista sin enviar contenido a la API. Cada fila muestra solo el título en una línea: sin extractos, estado ni fecha. Los títulos largos se acortan visualmente con puntos suspensivos y se conservan completos al pasar el cursor y para lectores de pantalla; la conversación seleccionada queda resaltada. Los borradores y el desplazamiento sobreviven al cambio de chat. El acceso al final pasa a una flecha discreta dentro de la zona de lectura.

Los adjuntos, captura y voz permanecen junto al campo de escritura. Los permisos y Detener aparecen cuando corresponden. Eliminar paneles informativos no autoriza acciones ni cambia el agente, el JSON Live, el modelo, el backend de gasto o la persistencia SQLite.

Clic derecho (o Shift+F10) sobre un título ofrece Eliminar conversación. El diálogo revisa el título real y conserva la autoridad existente: código de un uso, versión revisada, confirmación por botón/voz/chat. Cancelar/Esc revoca el código; abrir otra revisión invalida la anterior. Se elimina el historial local y se solicita la limpieza remota existente; los originales se conservan. El chat activo se sustituye por otro o por uno vacío al borrar el último.

Corrección posterior: el robot se conserva en la cápsula y en la cabecera expandida, donde sustituye la marca ZEN y mantiene el acceso a Inicio y el seguimiento del cursor. El contenido del chat, Inicio y la tarjeta rápida siguen sin personaje; el modo mascota alternativo se conserva. Los demás cambios permanecen intactos.

## Verificación

- Build TypeScript/Vite y build nativo aprobados; 351 pruebas unitarias, 40 archivos.
- `scripts/chat06-ui.mjs`, actualizado a la petición actual: Edge con datos de conversación e IPC simulados. Dos controles en cabecera, ausencia de paneles incluso con metadatos antiguos, lista de 85 conversaciones con carga por scroll y orden cronológico, borradores y anclaje, Markdown, stream, copia, Detener, actividad de otra conversación y tamaños 360×400, 480×360, 640×560 y 900×640. Evidencia: `evidence/simple-chat-ui.json`; capturas en `ui-preview/simple-chat/`.
- Paquete Electron en Windows con perfil aislado sin clave: IPC contextual, historial/borradores SQLite, geometría adaptable, cápsula y pantalla completa aprobados. Evidencias `conversations-native.json` y `portable-interactions.json`.
- Recorrido `head-capsule-ui.mjs` aprobado: navegación Inicio/Chat por clic/teclado, cabeza y ojos, manos temporales, permisos, movimiento reducido y borrador/lectura al plegar. Simulación en Edge; no acredita DPI físico.
- Borrado verificado solo con datos sintéticos: clic derecho, teclado, cancelar/revocar, código ligado a chat/versión, borrar otra conversación manteniendo borrador y borrar la activa/última. No se borran chats reales durante esta validación.
- Sin llamadas API de validación. Voz física, gestos/DPI y los pendientes generales siguen sin acreditarse por estas pruebas.

Comprobación del ajuste de la lista: compilación aprobada y recorrido de continuidad con filas de una línea a 360/640 DIP; capturas `ui-preview/simple-chat/compact-history-360.png` y `compact-history-640.png`. El arranque físico del EXE anterior quedó pendiente tras ventana vacía e interrupción del control por el usuario; las pruebas aisladas no acreditan ese arranque.

La entrega del EXE se identifica por hash en `evidence/simple-chat-desktop.json`. Los informes anteriores de otros equipos o versiones conservan su alcance histórico.

## Cabecera expandida — 09/10/2026

La petición posterior retira el acceso de marca/cabeza «ZEN» de la cabecera al desplegar a media pantalla; Inicio y Chat pasan a ser los primeros controles. También se aplica al redimensionar y al entrar en pantalla completa. La cápsula mantiene su personaje y acceso a Inicio/Apariencia. El escenario lateral y la bienvenida permanecen en sus respectivas vistas. En listas o anchuras donde el escenario no cabe, no aparece una cabeza de sustitución en la cabecera.

Build de producción, recorrido `mascot-ui.mjs` y arranque Electron del paquete aprobados sin API. Se comprobó visualmente la cabecera, los tamaños 320–960 DIP, la cápsula, el borrador al desplegar/recoger, el menú de apariencia desde la cápsula y la animación de pensamiento. Las pruebas usan eventos locales simulados. Captura: `ui-preview/mascot/chat.png`. Entrega y hash del EXE: `evidence/expanded-header-deployment.json`.
