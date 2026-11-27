# Fuentes y regeneración

Los cuatro JSON son fuentes editables. Archify genera HTML autónomo con selección, navegación y exportación. Los SVG usan la opción «SVG oscuro» del visor.

## Evidencia y alcance

| Estado | Evidencia |
| --- | --- |
| IMPLEMENTADO | Ventana Electron, autorización en Main, biblioteca HUB y cola de Officina. Las referencias apuntan a la rama `Work` en `e815aa3a319bd46ed87fa7681170c2ea6c990877`. |
| PROBADO | Arranque del portable de ZEN y cierre de las fichas de Officina en las cuatro posiciones al 100 % y al 150 %. El recorrido de Grafito usa un perfil sintético. |
| PLANIFICADO | Los diagramas se limitan a flujos presentes en el código. Los planes de producto se describen en la [hoja de ruta](../../ROADMAP.md). |
| NO VERIFICADO | Ejecución de esta secuencia con una cuenta real de Codex y tratamiento posterior de datos por servicios externos. |

El mapa general incluye el renderer, Preload, Main, los auxiliares de Windows, HUB, Officina y Codex. La secuencia, el ciclo de estados y el flujo de datos se centran en Officina. Para consultar las integraciones opcionales y la persistencia del perfil, abre la [arquitectura de ZeN](../../ARCHITECTURE.md).

## Regenerar desde la raíz de ZeN

1. Usa el fork [SammElias/Archify--HTML-Arquitecture](https://github.com/SammElias/Archify--HTML-Arquitecture) en el commit `01d1fe6c0a22be646b91605b686b8fd872f0262e`. Procede de [tt-a1i/archify](https://github.com/tt-a1i/archify).
2. Con Python, Node, Chrome y Playwright de ZeN disponibles, ejecuta:

   ```powershell
   $env:ARCHIFY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
   python docs/diagrams/sources/regenerar.py C:/ruta/al/checkout-de-archify
   ```

3. El script fija el tema inicial oscuro y encuadra el lienzo en pantallas estrechas mediante una copia temporal de la plantilla. Ejecuta `finalize` por vista con `--quality showcase --repo-root .`. Después, Playwright abre los HTML locales sin red, prueba el arranque oscuro y descarga los SVG oscuros. Recibos y capturas quedan en `release/archify-diagrams/`.

El [índice](../index.html) enlaza los cuatro visores y sus SVG. Ambos formatos abren sin servidor ni CDN. Los enlaces a código remiten a la revisión publicada y requieren conexión al abrirlos. Consulta [Apache 2.0](archify-LICENSE), [MIT histórica](archify-LICENSE-MIT), [NOTICE](archify-NOTICE), [avisos de terceros](archify-THIRD_PARTY_NOTICES.md) y la [licencia de JetBrains Mono](jetbrains-mono-OFL.txt).

A 390 px, la barra distribuye los controles en varias filas para conservar el acceso a todos los botones. La validación de Playwright comprueba sus límites visibles y activa el zoom con teclado a 390 y 1440 px.
