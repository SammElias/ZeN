# Compañero de escritorio — 7 de octubre de 2026

Implementación del guion `guion(1).md`, confirmada por el usuario. Trabajo local, sin publicar, hacer push ni sustituir `Desktop/ZEN.exe`. Conserva las mejoras de uso diario que ya estaban sin confirmar en Git.

## Comportamiento implementado

- Preferencias → **Compañero de escritorio** → **Mostrar mascota al plegar**. Inicialmente desactivado para conservar la cápsula. Tamaño inicial de 96 DIP, ajustable entre 72 y 128 DIP.
- Una sola ventana para mascota, burbuja, menú y conversación. La mascota conserva su punto en el escritorio al abrir controles; el chat aparece cerca y vuelve a la posición guardada al plegarse. Ratón: clic abre Chat, arrastre de al menos 7 DIP solo mueve. Menú con botón derecho o Mayús+F10, flechas y Escape.
- Menú conectado a conversación, captura de región, control de voz existente, tareas, preferencias y ocultación. Abrir la conversación no inicia el micrófono. La bandeja y el atajo siguen recuperando ZEN. Ocultar no cancela tareas.
- Región nativa de ventana formada por la superficie circular visible del robot y los controles visibles. El rectángulo del lienzo no se añade a la región de entrada. **El paso físico de clics sigue pendiente de verificación**, como se detalla abajo.
- Posición proporcional y monitor guardados fuera del repositorio; geometría limitada al área útil. Recalculado ante cambios de pantalla. No modifica la posición guardada de la cápsula.
- Expresiones compartidas entre Inicio, Chat y mascota, desde tareas y voz reales. Permisos, errores y pausas tienen prioridad sobre gestos decorativos. Codex externo conserva «En Codex» y explica que está pendiente de enviar y que ZEN no recibe su avance.
- Celebración breve solo tras una transición observada de la tarea actual a completada. No se repite con eventos duplicados, tareas restauradas, cancelaciones ni errores. Resumen descartable que abre la conversación.
- Robot SVG original por capas, con manos y ojos existentes. Respiración de cinco segundos y escala de 1,008; parpadeo ocasional. Mirada limitada a 240 DIP, vuelta neutra suave. Cursor: hasta 20 lecturas por segundo cerca; una cada 400 ms lejos; desactivado al ocultar/minimizar o reducir movimiento. Sin capturas ni llamadas al modelo para animarlo.
- Ayuda tras 700 ms de hover o foco, con pausa entre reapariciones. Saludo diario persistente al abrir voluntariamente, desactivable. «Gracias» / «Muchas gracias ZEN», escritos como mensaje completo sin adjuntos ni tarea bloqueante, producen una sonrisa local sin API. Los archivos arrastrados usan el flujo local existente y orientan la mirada hacia la entrega; no se envían al soltarlos.
- Movimiento según Windows, reducido, normal o expresivo; elección explícita prevalece sobre la preferencia del sistema. Silencio suprime gestos y avisos decorativos. El indicador de micrófono real permanece visible. Nivel de entrada tomado de la sesión ya activada, nunca activa escucha por animación.
- Preferencias «Siempre visible» y atenuación sobre pantalla completa. Observador WinEvent reutilizado, sin nuevo proceso de sondeo de contenido; excluye el escritorio y compara el monitor. La atenuación por propiedad de ventana fue comprobada con estado inyectado; el gesto físico de pantalla completa está pendiente.

## Capturas y validación

La exclusión compartida protege la única ventana, incluidos mascota, menú y burbuja. Espera 40 ms antes de capturar y el auxiliar existente espera la composición de Windows. Las capturas concurrentes conservan la protección hasta terminar la última; cancelación y error restauran el estado previo. También se usa al capturar una ventana arrastrada.

**No se da por garantizada la exclusión visual real en este entorno.** La captura nativa del fondo sintético devolvió negro, en vez del color conocido del fondo. Las capturas de la habilidad de control de Windows también salieron negras, incluso para la ventana de fondo. El clic sobre su botón fue rechazado dos veces, tras activar y volver a observar, porque Windows detectaba una ventana `Chrome Legacy Window` encima. No se intentó actuar sobre esa otra ventana.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run build:native` | Correcto; auxiliar Windows compilado. |
| `npm run build` | Correcto; TypeScript, main/preload y renderer. |
| `npm test -- --reporter=dot` | 315 pruebas, 37 archivos, todas pasan. Incluye geometría, duplicados/cancelación, preferencias, mirada y limpieza de temporizadores. |
| `node scripts/pet-ui.mjs` | Pasa. Renderer con bridge/eventos simulados: hover, foco, menú, arrastre frente a clic, borrador, Codex pendiente, prioridad de error, celebración única, silencio, movimiento reducido y ninguna activación de voz al abrir. |
| `node scripts/daily-workspace-ui.mjs` | Pasa la regresión de proyectos, borradores, tareas, favoritos y recorte local. |
| `node scripts/pet-native.mjs` | Integración Electron pasa; conjunto completo devuelve fallo por captura no acreditada. IPC real, abrir/plegar, guardar posición, restaurar, cancelar/error y parar mirada. Arrastre por coordenadas inyectadas en el controlador, no gesto físico. |
| `npm run test:electron` | Sin verde global: dos ejecuciones terminaron con `shownOnTop:false` y las demás comprobaciones funcionales en verdadero; otra ejecución alcanzó el límite de 30 s. No se ha relajado la aserción. |

Evidencias: `docs/evidence/pet-ui.json`, `docs/evidence/pet-validation.json` y `docs/evidence/pet-native.json`. Las imágenes de `docs/ui-preview/pet/` son demostraciones del renderer con estados simulados; no prueban la composición física de Windows. `test-results/pet-native-renderer.png` es una captura interna de Electron, no una captura física del monitor.

Pendientes físicos: transparencia y clics a través del fondo; arrastre real; ausencia de robo de foco; exclusión del robot durante una captura; «Siempre visible» y pantalla completa; desconexión/reconexión de monitor y escalado; micrófono y reproducción reales; medición prolongada de consumo. La geometría negativa y el cambio de límites están probados como lógica, no como desconexión física. No se ha validado consumo sostenido de CPU con un perfilador.

## Archivos y cómo probarlo

Estado y geometría en `src/shared/pet.ts`; gestos en `src/renderer/usePetPresentation.ts`; contexto compartido en `CompanionContext.ts`; ventana/interacciones en `FloatingPet.tsx` y `src/main/index.ts`; presentación en `Companion.tsx` y `pet.css`; controles en `PetPreferences.tsx`. `native/Zen.Windows/WindowDrops.cs` conserva el observador de arrastre y añade señales de pantalla completa.

1. Cierra la versión de ZEN que tengas abierta desde **bandeja → Salir**.
2. En la carpeta del proyecto, ejecuta `npm start` (compilación local ya preparada).
3. Desde la bandeja abre Preferencias, activa **Mostrar mascota al plegar** y guarda. Pliega el chat.
4. Prueba clic, arrastre, menú, ocultación y recuperación. Para volver a la cápsula, desactiva la opción.

También puedes abrir el entorno aislado sin clave API con `node scripts/pet-native.mjs --keep-open`. Abre una mascota de prueba y una ventana de fondo sintético; no representa una validación física automática satisfactoria.

Agente guardado y JSON Live sin diferencias. SHA-256 del EXE del escritorio conservado: `9e416992824f5c676748436c3e12a38cb6b11d8f5d727a1c6aa8fdb0bb9c568f`. No se ha empaquetado una nueva distribución ni cambiado sus evidencias de despliegue en esta iteración.
