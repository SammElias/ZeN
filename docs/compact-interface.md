# Guion 03 — Interfaz compacta y responsive

Implementado el 07/10/2026 tras confirmar «implementar y validar sin sustituir el EXE». Build local disponible en `dist`; no publicado, sin empaquetar ni cambiar `C:\Users\Gamming\Desktop\ZEN.exe`.

## Distribución y acceso

- **Cabecera:** Inicio, Chat y Tareas; iconos con etiquetas al disponer de ancho, nombres accesibles y ayuda al recibir foco. Ficha del proyecto real, tarjetas seleccionables con teclado, Escape/clic fuera y devolución del foco. Buscador a partir de seis proyectos; gestión dentro del selector. No se han añadido proyectos de ejemplo a los datos del usuario.
- **Centro:** una vista cada vez. Inicio tiene un saludo corto, tres acciones y, cuando cabe, una sugerencia. Las sugerencias siguen accesibles en Tareas con poca altura. Chat conserva su fuente actual de mensajes y stream. Actividad, contexto, proyectos, permisos y voz ocupan un panel central sin añadir otro bloque bajo la respuesta.
- **Compositor:** una instancia para todas las vistas, botón + para archivos, selección, portapapeles, recorte, captura, carpeta y Guíame. Micrófono propio y acceso a opciones de voz/reunión. Contexto resumido en una fila con revisión y retirada; múltiples adjuntos no amplían esa fila. El editor crece hasta 70 px y después desplaza su texto.
- **Tareas:** filas con título y estado observado, buscador, detalle y vuelta a la misma posición/filtro. Títulos corregibles localmente sin cambiar la petición original. Favoritos editables dentro de Tareas. Abrir y retomar no ejecutan la tarea.
- **Actividad:** botón con el número de eventos recibidos, recorrido observable en panel y vuelta al punto de lectura. El traspaso a Codex conserva su estado externo pendiente; no se infiere envío ni resultado. Detener y Revisar permiso siguen accesibles en compacto.
- **Mascota:** clic abre Chat; arrastre conserva su función. Clic derecho, Mayús+F10 o Acciones abren Hablar, Capturar, Adjuntar y Chat en arco. Se prueban orientaciones hacia el espacio disponible; si no cabe, aparece un panel de cuatro botones. Más opciones conserva pregunta rápida, guía, tareas, ajustes y ocultar. Escape, clic fuera y pérdida de foco cierran el menú sin detener una tarea. El micrófono activo conserva acceso para silenciar. Los huecos transparentes quedan fuera de la región nativa de entrada.

## Estado, tamaño y scroll

La superficie desplegada tiene una cabecera, una zona central flexible y el compositor inferior. Su altura nativa inicial es estable: no se calcula desde cada cambio del texto. La tarjeta principal admite redimensionado nativo; conserva su tamaño durante esa ejecución. La cápsula y la tarjeta rápida mantienen sus modos propios. Controles, campos y paneles del selector quedan fuera del gesto de arrastre de la cabecera.

Mínimo utilizable definido: **320 × 360 DIP** para la tarjeta expandida, cuando el área de trabajo lo permite. Se admite 320 × 480 como tamaño estrecho. La geometría limita la ventana al área disponible; equipos con menos espacio pueden quedar por debajo del mínimo y requieren comprobación física. Los menús y el contenido central tienen desplazamiento acotado; el campo de texto es la excepción de edición. Código y tablas pueden desplazar su formato localmente. No se escala toda la interfaz ni se reduce el texto para acomodar controles.

La posición de lectura de Chat se mantiene al abrir/cerrar Actividad; Tareas conserva filtro, selección y desplazamiento al volver del detalle. Los borradores y adjuntos se separan en RAM por proyecto y conversación retomada. No se promete recuperar borradores tras cerrar la aplicación: esa persistencia no existía antes. Las guías, proyectos, favoritos y alias de títulos sí usan sus almacenes locales. Las capturas temporales siguen sujetas a caducidad; cambiar de proyecto descarta la captura automática y requiere una referencia nueva.

Los permisos de archivos/carpetas en main se retienen por proyecto y solo se activan los de la selección actual, también para voz. Un identificador de otro proyecto se rechaza; los límites de lectura, caducidad, consentimiento y envío explícito siguen vigentes. No se modifica el backend del modelo, proveedores, autenticación, agente remoto ni configuración Live. Ninguna animación o cambio de vista llama a la API.

## Archivos principales

- `src/renderer/App.tsx`, `compact.css`, `NavigationTabs.tsx`, `HomePanel.tsx`: estructura, navegación, paneles y adaptación.
- `ProjectPicker.tsx`, `ProjectContextsPanel.tsx`, `WorkspacePanel.tsx`: proyectos, tareas, favoritos y restauración.
- `Composer.tsx`, `StreamingMessage.tsx`, `ActivityTimeline.tsx`, `useDropContext.tsx`: escritura, lectura, actividad y selección local.
- `FloatingPet.tsx`, `pet.css`, `src/shared/pet.ts`: cuatro acciones, geometría y regiones de entrada.
- `src/main/index.ts`, `overlay.ts`, `folder-context.ts`, `src/preload/index.ts`, `src/shared/contracts.ts`: tamaño de ventana y selección de contexto por proyecto mediante IPC validado.

## Validación

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run build` | TypeScript y bundle de producción correctos |
| `npm test -- --reporter=dot` | 322 pruebas, 38 archivos; incluye arcos/bordes/huecos y geometría DIP |
| `node scripts/compact-ui.mjs` | Inicio sin scroll; borrador compartido; scroll/filtro restaurados; proyecto y tarea separados; adjuntos recuperados; foco; favoritos; un único envío explícito; permisos/Detener; reunión y texto ampliado. Bridge simulado, sin API |
| `node scripts/interactions-ui.mjs` | Regresión de pregunta rápida/ampliación, adjuntos, deduplicación, recorte/anotación, explicación visual, guía, recuperación y movimiento reducido. Eventos simulados, sin API |
| `node scripts/pet-ui.mjs` | Menú por teclado, arrastre sin abrir, borrador, gestos, estado Codex, silencio y movimiento reducido. Eventos simulados |
| `node scripts/daily-workspace-ui.mjs` | Entrada anterior conservada; ejecuta las dos suites de interfaz anteriores |
| `node scripts/interactions-native.mjs` | Electron/IPC reales, perfiles temporales sin clave: tamaños nativos, compositor alcanzable, aislamiento de adjuntos entre proyectos, contexto congelado, guía/apariencia persistentes, Node ausente y salida del proceso comprobada |

Tamaños efectivos comprobados en renderer **y** ventana Electron: **360 × 400, 480 × 360, 640 × 480, 960 × 640 y 320 × 480**. Caso adicional renderer **320 × 360** con permiso pendiente, controles de ejecución y borrador multilínea. Texto ampliado a 20 px en controles en 360 × 400: sin desbordamiento horizontal global. El ensayo de cierre del proceso nativo también falla ante timeout; un JSON de checks anterior al cierre no basta para declararlo correcto.

Evidencias: `evidence/compact-ui.json`, `evidence/compact-native.json`, `evidence/compact-validation.json`, `evidence/interactions-ui.json`, `evidence/pet-ui.json`.

### Capturas de referencia de esta implementación

Son fixtures identificados, no conversaciones ni proyectos del usuario. Las capturas nativas provienen del framebuffer de Electron; no demuestran la exclusión de ventanas en la captura física.

| Vista | Normal | Compacta |
| --- | --- | --- |
| Inicio | [960 × 640](ui-preview/compact/home-960x640.png) | [360 × 400](ui-preview/compact/home-360x400.png) |
| Chat | [640 × 480](ui-preview/compact/chat-640x480.png) | [360 × 400](ui-preview/compact/chat-360x400.png) |
| Tareas | [640 × 480](ui-preview/compact/tasks-640x480.png) | [320 × 480](ui-preview/compact/tasks-320x480.png) |
| Selector | [640 × 480](ui-preview/compact/projects-640x480.png) | [320 × 480](ui-preview/compact/projects-320x480.png) |

[Actividad](ui-preview/compact/activity-640x480.png) · [Permisos a 320 × 360](ui-preview/compact/permissions-320x360.png) · [Texto ampliado](ui-preview/compact/enlarged-text.png) · [Abanico](ui-preview/pet/menu.png) · [Electron a 320 × 480](ui-preview/compact/native-320x480.png).

## Pendientes físicos

El entorno observado tiene dos pantallas a **100 %**. No se ha cambiado el escalado del usuario: **125 %, 150 % y 200 %** siguen pendientes de prueba nativa, al igual que mover/redimensionar físicamente entre monitores, comprobar clic a través de los huecos transparentes, foco con otras aplicaciones y voz física. Las pruebas matemáticas y los viewports no sustituyen esos ensayos. También siguen pendientes los límites históricos de captura con exclusiones y la respuesta del modelo real; este trabajo no llama a la API ni declara completo el objetivo general de ZEN.

## Prueba manual

1. Cierra la instancia anterior y ejecuta `npm start` desde el proyecto para abrir el build nuevo. El EXE del escritorio conserva la versión anterior por tu indicación.
2. Escribe en Inicio; pasa a Chat y Tareas. Abre Actividad y vuelve: comprueba el borrador y la posición de lectura.
3. Adjunta un archivo con +, cambia de proyecto desde la ficha y vuelve. Revisa que cada proyecto conserve su selección. Abre una tarea y Retomar conversación sin enviarla.
4. Reduce la ventana; revisa Enviar, voz, reunión, contexto y Detener. En la mascota usa clic derecho/Mayús+F10 y comprueba las cuatro acciones cerca de los bordes.
