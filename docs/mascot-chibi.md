# Mascota ZeN · integración del guion del 09/10/2026

## Alcance y auditoría previa

La petición explícita de aplicar `guion_codex_zen.md` sustituye el robot por el personaje humano del kit y autoriza un escenario lateral en Chat. Se conserva Inicio/Chat, las conversaciones de títulos compactos, borrado confirmado, borradores, adjuntos, permisos y Detener. No se ha hecho fetch, commit ni push en este encargo.

Stack real: Electron 44.5.1, React 19.3, TypeScript, Vite y SQLite. Antes del cambio se ejecutó `node scripts/chat06-ui.mjs`: historial, lectura y borradores pasaban. La cápsula mide 490×46 DIP; el panel habitual 640 DIP, con F11 y tamaños adaptables. Se mantienen `overlayBounds`, `capsuleShape`, el arrastre existente, persistencia por display/borde/proporción y recuperación mediante eventos de pantallas. No se incorpora Tauri ni Three.js: no hay un GLB, huesos o clips en el kit.

Mapa de contratos conservados:

| Zona | Archivos / contrato |
| --- | --- |
| Ventana y monitores | `src/main/index.ts`, `src/main/overlay.ts`, `src/shared/island.ts`; coordenadas DIP, área útil y región nativa existentes |
| Navegación y compositor | `src/renderer/App.tsx`, `Conversations.tsx`; contenido montado al plegar, un scroll de mensajes |
| Historial | `useConversations.ts`, `src/storage/conversations.ts`; SQLite, IDs de chat/mensaje/run, borradores por chat |
| Voz | `src/renderer/live-voice.ts`, `speech-activity.ts`; muestras reales de salida y finalización de sesión existente |
| Autoridad | IPC validado, permisos, códigos y cancelación previos; ninguna acción de la mascota concede permisos |

## Recursos e implementación

Corrección posterior del usuario («se ha perdido mucho detalle»): se retira el cuerpo geométrico aproximado. El renderer utiliza las ilustraciones originales completas, con sus proporciones, texturas, manos, zapatillas y logo. El escenario pasa de 136 a 176 DIP y el anclaje de 112×208 a 160×280 DIP. La identidad visual tiene prioridad sobre la amplitud de los gestos.

El manifiesto del kit clasifica imágenes estáticas, atlas y mockups. Los PNG originales se conservan sin retocar; los ocho recursos coinciden con los hashes y dimensiones del manifiesto (`docs/evidence/mascot-assets.json`). Los rectángulos del atlas se encuadran mediante `viewBox`, no generando caras nuevas.

| Recurso del kit | Uso real |
| --- | --- |
| `assets/zen-cabeza.png` | `public/mascot/head.png`, cabeza neutra y alternativa estática canónica, RGBA 1254×1254 |
| `assets/zen-expresiones.png` | `public/mascot/expressions.png`, atlas estático 2×2 RGBA 1254×1254; cinco tonos contando la cabeza neutra |
| `assets/zen-logo.png` | `public/mascot/logo.png`; exportación de formato a iconos Windows mediante `scripts/app-icons.mjs` |
| `assets/zen-cabeza-manos.png` | `public/mascot/head-hands.png`; manos ilustradas encuadradas en la cápsula |
| `assets/zen-cuerpo.png`, `references/zen-base-actual.png` | `public/mascot/body.png`; figura neutral completa original, 1024×1536 |
| `references/zen-estilos.png` | `public/mascot/outfits.png`; cuatro figuras completas originales encuadradas sin reescalar los archivos, 1254×1254 |
| `references/zen-marcha.png` | Una pose de referencia, no ciclo |
| `captures/*`, `preview.html` | Material de diseño; no se usa como evidencia de la aplicación |

`src/renderer/MascotArtwork.tsx` dibuja los PNG originales mediante regiones SVG; `mascot-artwork.ts` registra encuadres y pivotes por conjunto. Las imágenes de cuerpo, ropa y manos coinciden byte a byte entre el kit, `public` y el build: comprobación SHA256 en `mascot-ui.json`. No hay recoloreado, cuerpo vectorial ni sustitución del logo. La figura conserva la relación de aspecto y su cara propia. `Mascot.tsx` conserva la colocación y los controles.

Es una **presentación 2D con las texturas originales**. En reposo conserva las poses del kit. La cabeza sigue el cursor mediante una región solapada y giro limitado a 1,2° en cuerpo completo (4° en cápsula). El paseo separa temporalmente regiones de muslo y pierna con giros alternos pequeños y un desplazamiento de cuatro unidades del escenario; no es un ciclo 3D ni una marcha natural. Los brazos conservan la pose ilustrada para evitar reconstruir superficies ocultas. No hay rig facial, pupilas independientes, fonemas ni boca animada. Un fallo del cuerpo vuelve a la cabeza canónica neutra.

## Controlador y presentación

`src/shared/mascot.ts`: validación, enumeraciones, política de ropa y lease de reproducción. `useMascot.ts`: adaptador de los eventos reales ya disponibles, tono estable por mensaje, previsualización temporal, entrega y locomoción. `MascotHost`: colocación del único renderer en el anclaje visible; no depende del texto transmitido por tokens.

| Eje | Valores / origen |
| --- | --- |
| Presentación | `compact`, `hands`, `full`; cabeza en cápsula/cabecera, manos para actividad/permisos/adjuntos, cuerpo en el escenario |
| Actividad | `speaking` por reproducción real, después `listening` por micrófono, `error`, `executing`, `thinking`, `idle` |
| Locomoción | `still` / `walking`; movimiento 2D explícito de 2,4 s dentro del escenario, regiones de piernas alternas, parada local |
| Tono | `neutral`, `smug`, `confident`, `sad_empathic`, `playful_cocky` |
| Vestuario | `signature`, `light`, `all_black`, `cozy`, `layered`; automático o fijado globalmente |

La actividad ajena no anima la mascota del chat activo. El indicador de tareas conserva el trabajo concurrente aunque la mascota esté hablando. El texto terminado vuelve a reposo con un gesto breve; restaurar un mensaje no repite gestos, paseos ni voz. Cancelar todo invalida también la operación visual; Detener voz solo invalida la reproducción. Los callbacks antiguos de SpeechSynthesis y las muestras de sesiones Live cerradas se descartan. El IPC local de lectura incluye ahora propietario de chat/tarea para rechazar resultados de otro chat.

La cápsula sigue midiendo 490×46. El escenario ocupa 176 DIP dentro del panel, fuera de mensajes, scrollbar y compositor. Por debajo de 580 DIP o al abrir Conversaciones, vuelve a la cabeza de la cabecera. Solo existe un `.mascot-host`; el controlador se conserva entre anclajes. Los adornos usan `pointer-events:none`; no se promete paso de clics por píxel. Se reutiliza la región nativa redondeada y el modo mascota flotante existente.

## Tonos, persistencia y uso

Botón **Apariencia** en el escenario, o clic derecho / Shift+F10 sobre la cabeza. Los cinco botones son **Neutral, Creído, Seguro, Triste, Xulito**, con intensidad 0–1 y restablecimiento. La prueba es local y caduca al cerrar, plegar, cambiar de chat, ocultar o comenzar actividad. No escribe mensajes ni activa voz, herramientas o API. La ropa y la opción de caminata sí se guardan en Preferencias; el tono de prueba no.

La tabla aditiva `message_appearance` guarda metadata neutral para los nuevos mensajes asistentes. Se validan versión, enum, origen, intensidad finita y correspondencia chat/mensaje tanto al escribir como al leer. El dato queda congelado; mensajes previos o metadata corrupta/ajena vuelven a neutral. No se reescriben textos, borradores ni contexto del proveedor. No hay clasificador emocional: la generación ordinaria permanece neutral por prudencia; las cinco expresiones se pueden previsualizar. No se atribuye ánimo al usuario ni se ha solicitado un campo nuevo al agente.

Compatibilidad visual: cada conjunto conserva su cara ilustrada: Signature/Neutral, Blanco oversize/Creído, Total black/Seguro, Grafito/Triste y Urbano en capas/Xulito. La ropa fija prevalece; Apariencia identifica la cara disponible si no coincide con el tono solicitado. No se pega una cabeza incompatible sobre otra figura. El tono lógico de error permanece neutro, aunque una prenda fija conserve su ilustración original. La intensidad regula un gesto leve de cabeza, no inventa expresiones intermedias.

## Audio, movimiento y accesibilidad

Live utiliza RMS local del audio de salida, con suavizado y puerta de silencio, solo mientras suena. SpeechSynthesis local utiliza eventos start/pause/resume/end/error y gesto genérico: no expone muestras. Nada de esto envía audio a otro servicio. **Detener voz** es inmediato en el reproductor local; el trabajo puede seguir. **Detener todas las tareas** conserva el mecanismo de cancelación previo. Reunión/silencio también detiene lectura local.

La caminata es un recorrido corto de ida/vuelta dentro del escenario, no un paseo por todo el escritorio ni locomoción 3D. No cambia el puntero ni el tamaño de la ventana. Movimiento reducido sustituye animaciones por poses; ocultar la superficie pausa la decoración sin crear trabajo nuevo. No hay RAF de animación en reposo: transformaciones CSS y eventos de cursor acotados a 20 Hz; RMS visual se consulta a 20 Hz solo hablando. Las etiquetas no se anuncian por cuadro. Se conservan foco visible y controles de teclado.

## Verificación y métricas

Ejecutar desde el repositorio:

```text
npm run build
npm test -- --maxWorkers=2 tests/mascot.test.ts tests/conversations.test.ts tests/live-client.test.ts tests/pet.test.ts tests/overlay.test.ts
node scripts/mascot-ui.mjs
node scripts/chat06-ui.mjs
node scripts/package-win.mjs --interactions
npm run package:single -- release/ZEN-<paquete-verificado>
node scripts/single-file-smoke.mjs release/single-file/ZEN.exe --interactions
```

También puede abrirse `npm run preview:ui` y `/preview.html?conversations=1` para la vista de simulación; `npm start` abre la aplicación real con su perfil. Las simulaciones indican su alcance y no necesitan clave.

- 69 pruebas dirigidas de modelo local, metadata/SQLite, voz, mascota y geometría pasan; la regresión completa posterior pasa con 358 pruebas en 41 archivos. Build TypeScript y producción pasan.
- `docs/evidence/mascot-ui.json`: renderer real Edge, IPC/reproductor simulados; estados, cinco tonos, ropa fija, caminata articulada/parada, audio sin cancelar trabajo, callbacks tardíos, operación cancelada, chat ajeno, arrastre, drafts, teclado y anchuras 320–960 pasan.
- `docs/evidence/simple-chat-ui.json`: regresión de conversaciones, scroll, borrado, Markdown y borradores pasa.
- `docs/evidence/mascot-native.json`: Electron real, IPC de preferencias y capturas nativas de tonos/cuerpo/caminata/reducción de movimiento. Entrada DOM simulada; no API.
- Iconos de aplicación y bandeja comprobados en nueve tamaños y recurso del EXE con `scripts/icon-smoke.mjs`; se añadió fondo al logo de bandeja para superar el mínimo de superficie visible.
- Capturas revisadas en `docs/ui-preview/mascot/` y `docs/ui-preview/mascot-native/`. No proceden del directorio `captures` del kit.
- Dos empaquetados encontraron bloqueos transitorios de Windows al guardar evidencias existentes; sus reintentos pasaron. No se modificó producto para ocultar el fallo.

Equipo medido: Windows x64, Intel Core i7-13620H, Edge 154.0.4258.62. Muestreo de 100 intervalos RAF en renderer headless tras la corrección: sin mascota y en reposo p50/p95/p99 6,9 / 7,0 / 7,1 ms; movimiento 6,9 / 7,1 / 7,1 ms. El comparador oculta la mascota en la misma compilación. Detener voz: 3,2 ms hasta el siguiente cuadro con reproductor local simulado. No mide latencia de red, altavoz físico, consumo eléctrico ni GPU; no garantiza 144/60 fps en otros equipos.

## Límites y conservación

Pendientes: prueba física de micrófono/altavoz y teclado/arrastre, cambios reales de DPI y desconexión de monitores. Los tests de límites nativos usan las pantallas disponibles; no acreditan cambios físicos. Las caras y articulaciones 3D más fieles, ojos/boca independientes y un ciclo de marcha con contacto de pies más preciso requieren recursos adicionales; no se simulan con llamadas de IA. El conjunto de funciones Windows/API ajenas a este guion conserva sus límites anteriores.

Configuraciones byte a byte intactas:

- `live-session.json`: `D6350101A001788A934F06D28FF0FBDC57255D5F8966BFA71AFAFD82AC134B60`.
- `saved-agent.json`: `FD844BFA7F2726EA684D6179995D6E94DEBF131DF6893CA8B012D76F2D1C42C7`.

La entrega del ejecutable y su hash se registran en `docs/evidence/mascot-deployment.json`. Compilaciones y respaldos quedan en `release`; el escritorio recibe únicamente `ZEN.exe`.

Entrega de la corrección: Desktop/ZEN.exe SHA256 `8E4796BC403A72E2A22267D6264E13EE57E78F30D7D8CE03B6B18146134660BA`, 122.895.336 bytes. Extracción, arranque y recorrido Electron aislado pasan; el perfil personal se reabrió y sus PNG extraídos coinciden con los originales. Computer Use devolvió una captura vacía y sin árbol del renderer en esa instancia, por lo que su revisión visual no está acreditada. Las capturas de validación pertenecen al renderer y a Electron con el perfil aislado.

Fuentes técnicas aplicables: [interacciones de ventana Electron](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions), [AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode), [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) y [movimiento reducido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion). Se consultaron para el runtime existente; no se introdujo una segunda plataforma de ventanas.
