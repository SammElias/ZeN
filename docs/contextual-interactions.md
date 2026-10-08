# Guion 02 — Interacciones contextuales

Implementación local del 07/10/2026, sobre la mascota y las funciones existentes. Empaquetada posteriormente por petición explícita «Compila el exe» y entregada como único `C:\Users\Gamming\Desktop\ZEN.exe`. El objetivo general de ZEN y la validación física completa siguen abiertos.

## Uso

- **Pregunta rápida:** botón derecho o Mayús+F10 sobre la mascota. Tarjeta anclada de 380 DIP, adaptada al área de trabajo. El clic principal mantiene Chat. Ampliar conserva el mismo MessageStore, borrador, imagen y petición; no llama al modelo ni toma otra captura. Cerrar pliega y conserva el trabajo. Detener es una acción independiente cuya confirmación llega desde el motor.
- **Contexto:** bandeja común con archivos, texto editable, imágenes y recortes. Vista previa local, quitar y sustituir antes de enviar. La petición fija identificadores, imagen exacta y captura visible al enviarse. El backend retiene la selección aunque se retire del borrador; si el archivo del disco cambia, rechaza la lectura. Se deduplican archivos por identidad opaca y texto/imágenes por contenido. El último envío conserva una referencia visual en RAM y los nombres seleccionados.
- **Archivos:** soltar sobre la mascota/tarjeta abre acciones compatibles: Resumir, Explicar, Revisar código, Extraer datos o Preguntar. Esta última solo prepara el campo. Adjuntar archivos ofrece el selector nativo por teclado. Soltar, preparar y previsualizar no llama a la API. Se conserva el flujo separado de carpetas hacia Codex del escritorio.
- **Señalar en pantalla:** menú o atajo de región configurado. Primero recortar; después círculo, flecha o trazo, deshacer y vista exacta. Adjuntar recorte vuelve al borrador; el usuario envía. Escape restaura la presentación anterior sin enviar. Se usa el monitor donde está ZEN, con el mecanismo existente de exclusión. No hay selector adicional de monitores: mueve ZEN al monitor deseado.
- **Explicación visual:** marcas sobre la imagen congelada, nunca sobre controles actuales del escritorio. Solo se muestran bloques `zen-visual` válidos con el identificador de esa imagen y coordenadas normalizadas dentro de límites. Una respuesta sin marcas fiables conserva su explicación textual. No se inventan coordenadas ni se ejecutan clics.
- **Guíame:** objetivo y contexto seleccionados, una petición para preparar pasos. Anterior/Siguiente, pausa, reanudar, No lo encuentro y Salir. La guía se guarda por proyecto en los datos locales de usuario. Las referencias visuales de más de dos minutos bloquean avanzar hasta revisar una guía con contexto nuevo. Reformular prepara otra petición de guía para revisión. El final dice «Pasos completados por el usuario»; no acredita un resultado verificado.
- **Retomar:** una sugerencia al abrir voluntariamente, con título, fecha y estado existentes. Continuar recupera la tarea o el paso guardado sin ejecutar; el siguiente mensaje puede usar la conversación original. Descartar oculta solo esa sugerencia. Las referencias temporales antiguas requieren adjuntarse de nuevo. Preferencia para desactivar la tarjeta.
- **Apariencia:** tamaño y movimiento existentes, pajarita menta opcional y Restablecer apariencia. SVG local que respeta cara, manos y antena. No utiliza servicios de generación ni nuevas llamadas para gestos.

## Límites y autoridad

Hasta ocho adjuntos y una referencia visual. PNG/JPEG/WebP hasta 12 MB al preparar; PDF/DOCX/XLSX hasta 10 MB; extensiones de texto/código admitidas por `DropContext` hasta 1 MB; texto pegado hasta 64.000 caracteres. Lectura parcial acotada según la petición. El recorte preparado tiene como máximo 1920 píxeles de lado y 3 MB codificados; se envía sin recomprimirlo ni añadir una pantalla completa.

La instantánea impide mezclar la selección visible con cambios posteriores del borrador. Retirar un adjunto no retira datos ya enviados. Una preparación cancelada descarta resultados tardíos; no implica detener una lectura local ya iniciada en el sistema operativo.

Guíame restringe la petición a explicación: no entrega control de equipo, ejecución directa, creación de proyectos ni handlers de herramientas locales. Reintentar una guía mantiene esa restricción. No se cambian las herramientas, modelo, instrucciones ni formato del agente remoto guardado. Los permisos de otras tareas conservan su política y confirmaciones.

## Archivos principales

- `src/renderer/App.tsx`, `Composer.tsx`, `FloatingPet.tsx`: superficies y envío compartidos.
- `ContextTray.tsx`, `RegionPicker.tsx`, `VisualExplanation.tsx`: revisión y anotación visual.
- `GuideCard.tsx`, `useInteractions.ts`, `PetPreferences.tsx`: guía, recuperación y apariencia.
- `src/shared/interactions.ts`: contratos, límites y transiciones manuales.
- `src/main/drop-context.ts`, `index.ts`, `overlay.ts`, `src/preload/index.ts`: contexto fijado, geometría e IPC local validado.
- `src/agent/tasks.ts`, `orchestrator.ts`, `src/storage/personal.ts`: correlación de tareas, modo informativo y persistencia.

## Validación

- `npm run build`: TypeScript y producción pasan.
- `npm test -- --reporter=dot`: 321 pruebas, 38 archivos, pasan. Incluyen envío duplicado, selección fijada y revocación posterior, límites de marcas, pasos manuales/caducados y bloqueo de efectos de Guíame.
- `node scripts/interactions-ui.mjs`: recorridos completos con bridge y respuestas simulados; sin API. Capturas en `ui-preview/interactions/`. Prueba rápida/cerrar/ampliar, adjuntos locales y cambios después de enviar, recorte/anotación/cancelación, marcas válidas, guía manual y Retomar sin ejecutar.
- Regresiones `scripts/daily-workspace-ui.mjs` y `scripts/pet-ui.mjs`: pasan con simulación de eventos.
- `node scripts/interactions-native.mjs`: Windows/Electron real en perfil temporal aislado y API bloqueada. Comprueba ancho 380→640, IPC real y deduplicación, rechazo de referencia visual incompatible, persistencia de guía/apariencia y ausencia de Node en renderer. Eventos de ratón/menú inyectados en el DOM: no son gestos físicos. `native-quick.png` procede del framebuffer de Electron; no demuestra captura física del monitor.

Evidencias: `evidence/interactions-ui.json`, `evidence/interactions-native.json`, `evidence/interactions-validation.json`.

## Entrega del ejecutable

`npm run build:native` y `npm run build` pasan. `node scripts/package-win.mjs --interactions` verifica IPC y geometría en el paquete Windows. `npm run package:single -- release/ZEN-20261007181126775` genera el EXE único, y `node scripts/single-file-smoke.mjs release/single-file/ZEN.exe --interactions` comprueba su extracción, arranque y las mismas interacciones en un perfil temporal sin API. Estos modos específicos no sustituyen ni acreditan las comprobaciones generales o físicas pendientes.

El archivo probado se copió al escritorio el 07/10/2026 a las 20:15 (Europe/Madrid), con SHA-256 coincidente `6e69398e766845e9f1e15953fbb02321b29a5042dd1b5427209eca5c188e74a3`. Respaldo anterior dentro de `release/desktop-backups`; ninguna carpeta nueva en el escritorio. Configuración Live y agente guardado conservados byte a byte. Evidencias actuales: `evidence/portable-interactions.json`, `evidence/single-executable.json` y `evidence/single-executable-deployment.json`. `interactions-validation.json` conserva la fotografía anterior a esta entrega.

## Pendiente de prueba conjunta

Entrega real de archivos desde Explorador a la mascota, foco respecto a otras aplicaciones, arrastre de ventanas, transparencia/clic fuera del área visible, varios monitores y escalas, captura real con exclusiones y los atajos físicos. La validación previa de la mascota encontró captura negra/ventana ajena superpuesta; esta iteración no demuestra resueltos esos límites. Tampoco se ha llamado al modelo real para comprobar qué marcas o pasos devuelve, ni se ha probado voz física. Se preserva la alternativa textual ante respuestas sin coordenadas.

Para probar las mejoras, abre `C:\Users\Gamming\Desktop\ZEN.exe` tras cerrar cualquier instancia anterior de ZEN para liberar sus atajos. También se mantiene `npm start` para desarrollo.

Recorrido manual recomendado: Pregunta rápida → enviar → cerrar durante la respuesta → abrir y ampliar; adjuntar dos archivos y quitar uno antes de enviar; señalar/anotar una zona y cancelar, después adjuntarla; preparar una guía, pausar y retomar. Comprobar finalmente arrastre y captura en cada monitor/escala.
