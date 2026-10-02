# Actividad visible de ZEN — 01/10/2026

El panel desplegado muestra una línea de pasos observados, inspirada en la primera referencia del usuario y adaptada a la paleta lavanda de ZEN. El paso actual tiene un borde suave y un icono animado; los anteriores quedan atenuados. La cápsula superior o lateral muestra únicamente el estado actual con una etiqueta breve. Se conservan el chat de 640 DIP, la cápsula 240×40/40×240, el último mensaje, el stream literal y las confirmaciones por voz/chat.

Los estados proceden de metadatos locales `TaskEvent.activity`: procesando, pensando, consultando web, abriendo web/Codex/aplicación, observando, ejecutando, escribiendo, estructurando y comprobando. Espera, error, cancelación y finalización tienen prioridad sobre metadatos antiguos. No se extraen pasos de narraciones del modelo, del texto de una página ni de razonamientos privados; tampoco se inventan porcentajes, etapas futuras o comprobaciones exitosas. «Anterior» significa una fase recorrida, sin afirmar éxito de un efecto.

El recorrido es efímero y acotado a 24 fases por tarea y 24 tareas. No almacena textos, capturas ni transcripciones. Deltas repetidos no crean fases, notificaciones del almacén ni cambios de altura. El panel crece solo al aparecer una fase distinta, hasta tres filas; el resto se consulta desplazando la lista, también por teclado. Mostrar actividad no realiza peticiones de API y no añade tokens. No se modifican modelo, agente guardado, herramientas remotas, autorizaciones o JSON de GPT-Live.

## Iconos

Se encontró la referencia solicitada como `C:\Users\Gamming\Downloads\descarga (15).jpg`, coincidente con la cuarta captura. Se usa como referencia visual de círculos, puntos y trazos: los glifos ZEN son originales, dibujados en SVG y renderizados localmente a GIF; no se recortan píxeles del catálogo. `scripts/activity-icons.mjs` permite regenerarlos con Playwright ya instalado, sin dependencias nuevas ni API.

`public/activity/` contiene 8 GIF de 48×48, con 24 fotogramas por ciclo de 1,92 segundos, sus SVG estáticos y las variantes de pausa/error/finalización. `iconos.gif` reúne los ocho movimientos. La colección completa ocupa aproximadamente 610 KB; cada GIF individual unos 38 KB. Solo se anima el paso activo. Preferencias → animaciones desactivadas, movimiento reducido del sistema, ocultación, cancelación y finalización usan SVG estático; al recoger ZEN el recorrido se desmonta.

## Verificación y límites

Compilación TypeScript/Vite y 276 pruebas unitarias pasan. Edge headless verifica pasos reales simulados, límites del recorrido, cambios de estado, GIF de 24 fotogramas distintos, alternativa estática, cápsula con texto sin recortar, laterales, confirmaciones, pantallas pequeñas y estabilidad del stream. Evidencia: `docs/evidence/activity-ui.json`; capturas referenciadas en ese archivo. No se hicieron llamadas pagadas a modelos para estas pruebas.

Las pruebas de la interfaz no acreditan el control físico del ordenador. El fallo anterior de SendInput y la comprobación general de ventana siempre encima siguen separados de esta mejora; véanse `computer-control.md` y `objective-verification.md`. El ejecutable actualizado se entrega como compilación de prueba mientras existan esas comprobaciones pendientes.

Electron empaquetado verifica la actividad y la carga de sus iconos desde disco, los tres bordes y la estabilidad del stream. La única comprobación falsa del último arranque general es `shownOnTop`; resultados en `docs/evidence/activity-native.json`. El smoke espera el viewport nativo y usa un identificador de tarea distinto en cada ejecución para evitar que tareas sintéticas ya terminadas se confundan con deltas tardíos.

Ejecutable de prueba: `C:\Users\Gamming\Desktop\ZEN Interfaz - prueba\ZEN.exe`. Copia de `release/ZEN-20261001190553614`, con hashes en `docs/evidence/activity-candidate.json`. Se conservan la carpeta y el acceso directo habituales, y la compilación anterior de control. El estado del paquete completo sigue siendo pendiente.

Entrega posterior, por corrección expresa del usuario: la distribución vigente es únicamente `C:\Users\Gamming\Desktop\ZEN.exe`; las rutas anteriores son históricas. [Ejecutable único y prueba de arranque](single-executable.md).
