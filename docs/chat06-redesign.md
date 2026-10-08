# Guion 06: chat compacto

Implementado el 08/10/2026 tras la confirmación «Implementar el rediseño completo» para `guion_06_rediseno_chat_compacto.md`. El cambio conserva la cápsula, la navegación actual, el historial SQLite y sus comandos, herramientas, voz, aprobaciones y presupuesto. No cambia el proveedor, el agente guardado ni los JSON de configuración.

## Distribución y componentes

- `Conversations.tsx` reserva una cabecera compacta, una zona central de lectura y la escritura exterior. El historial sustituye temporalmente la lectura sin desmontarla. Las páginas antiguas ya cargadas se conservan en un caché de presentación de hasta seis chats, asociado a su ID; evita pintar la página de otro chat durante el cambio. No es un segundo almacén ni modifica SQLite. El título procede del chat guardado, con nombre completo en su menú; proyecto integrado cuando cabe y accesible en el detalle cuando no cabe. Historial, nuevo chat, renombrar, fijar, archivar, buscar, transferir y eliminar conservan sus operaciones existentes.
- `App.tsx` integra contexto, adjuntos y controles de escritura en un bloque. Retira la franja de proyecto y estados completados repetidos del Chat persistente. La actividad sigue disponible en el menú; una ejecución de otro chat se identifica como «Otra conversación» con la petición real, incluso en ancho reducido. Permisos, pausa y Detener siguen disponibles. Cerrar actividad conserva el trabajo.
- `chat-design.css` elimina la tarjeta exterior de las respuestas normales, usa burbujas violeta suave para el usuario y cuerpo de 15 px / 1,6. Menús secundarios temporales y bloques de código/tablas tienen desplazamiento propio. No se añaden animaciones por delta ni un almacén alternativo.
- `message-text.tsx` utiliza React Markdown y GFM para citas, listas, negritas, enlaces, código y tablas. Las transcripciones y deltas en curso siguen literales. No hay HTML arbitrario ni ejecución; los enlaces HTTP(S) pasan por la apertura ya existente. Las imágenes Markdown remotas requieren apertura explícita; las imágenes adjuntas conservan su vista previa local. Las licencias de las nuevas dependencias se incluyen en `public/licenses/markdown-dependencies.txt`.
- `MessageActions.tsx` comparte Copiar con icono, confirmación local breve y menú de Guardar/acciones existentes. El espacio se reserva también mientras llega una respuesta. Teclado y Escape conservan acceso y foco.
- `Composer.tsx` usa «Escribe a ZeN…», adjuntar a la izquierda y enviar a la derecha. Crece hasta aproximadamente cinco líneas y reduce ese máximo en ventanas bajas; mantiene pegado de imágenes y el teclado existente.
- `useConversations.ts` guarda inmediatamente el borrador y la posición antes de cambiar, usando el IPC existente. La lectura conserva un mensaje visible como ancla al cargar anteriores y sigue nuevos mensajes solo cerca del final. El stream compartido deja de volver al inicio al cambiar de fragmento. Las respuestas asíncronas de búsqueda/contexto se comprueban contra el chat actual. Una eliminación confirmada invalida el borrador activo antes de abrir otro chat, para no intentar guardar el chat borrado.

## Qué se investigó

En el layout anterior, `Conversations` estaba dentro del mismo scroll que sus mensajes, mientras `.chat-navigation` era sticky. La cabecera y sus filas podían ocupar la zona de lectura. Ahora cabecera, lectura y escritura reservan espacio real mediante Flex/Grid; se comprobó que sus rectángulos no se solapan. Esto acredita la corrección de esa distribución, no reproduce por sí solo cada causa de la captura histórica.

`Program Manager` procede del título de la ventana elegible detrás de ZEN que selecciona `ScreenContext`. Cuando el capturador devuelve un monitor, se guarda `scope: display`; ese título es metadato, no identifica por sí solo el contenido de los píxeles. La etiqueta compacta dice «Pantalla» y hora; el título detectado queda en el detalle. Ver abre la referencia exacta y Actualizar/Quitar mantienen el flujo existente. Una selección manual conserva prioridad. Los fragmentos de otros chats se inspeccionan al pulsar su etiqueta; Quitar afecta al contexto de próximas peticiones, sin borrar archivos ni mensajes.

## Comprobado

- `npm run build`: TypeScript y producción pasan.
- `npm test -- --maxWorkers=2`: 348 pruebas en 40 archivos, incluidas tres comprobaciones nuevas de Markdown y contenido no ejecutable.
- `node scripts/chat06-ui.mjs`: renderer real en Edge con IPC y conversaciones sintéticas identificadas como `[Prueba]`, sin API. Chat vacío, 80 mensajes y paginación, streaming sin scroll forzado, respuesta interrumpida con parcial, copia/acciones secundarias, historial/borradores/posición, cambio inmediato y regreso al mismo mensaje de una página antigua, actividad ajena/cierre/Detener y quitar contexto futuro. Anchos CSS 360/480/640/900, altura de 360 y texto ampliado. Eliminación confirmada sin guardar de nuevo el borrador retirado. Evidencia en `docs/evidence/chat06-ui.json` y capturas reales en `docs/ui-preview/chat06/`.
- Recorridos existentes de interfaz compacta, controles de captura y pantalla completa pasan. El paquete Windows pasa arranque Electron, IPC, geometría y SQLite con tareas/entrada DOM sintéticas. La evidencia nativa separa explícitamente simulación y Windows real: `conversations-native.json`, `interactions-native.json`, `fullscreen-merge-native.json`, `portable-interactions.json`.

Un intento posterior del paquete falló al escribir la captura de pruebas `native-960.png` (`UNKNOWN: unknown error, open`); no se declaró aprobado. Se conservó el fallo en `docs/evidence/chat06-package-attempt.json` y una compilación nueva superó el mismo recorrido completo.

El nuevo EXE único está compilado en `release/single-file/ZEN.exe` (SHA-256 `508e6c653dea53039e95948bbcd124a7cee1455ac969e57caf82d6989380b467`). Su extracción y arranque con Electron/IPC pasan. Reemplazar `C:\Users\samme\Desktop\ZEN.exe` está pendiente: Windows rechazó la copia porque la instancia anterior sigue usando el archivo. Se conserva el EXE anterior y sus respaldos en `release`; no se interrumpe esa instancia. Estado exacto en `docs/evidence/chat06-desktop.json`; los punteros de entrega del escritorio siguen acreditando su versión anterior hasta terminar el reemplazo.

## Límites pendientes

El caché de páginas es temporal: al reiniciar o superar seis chats se conserva el contrato anterior de borrador/scroll numérico y paginación del backend; no se ha añadido un marcador persistente por ID de mensaje para esas páginas antiguas.

Esta validación no llama al modelo ni prueba micrófono/voz físicos, gestos reales, foco entre aplicaciones, cambios de monitor/DPI o exclusiones de captura en todos los monitores. Se mantienen las limitaciones previas documentadas del smoke general y saludo por hover en `docs/merge-20261008.md`. No se declara completo el objetivo general de ZEN ni se atribuye a estas pruebas una validación nueva de la API.

Referencias del renderizador: [React Markdown](https://github.com/remarkjs/react-markdown) y [Remark GFM](https://github.com/remarkjs/remark-gfm).
