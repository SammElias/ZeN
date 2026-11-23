# Fuentes y regeneración

Los cuatro JSON son fuentes editables. Archify genera HTML autónomo con selección, navegación y exportación. Los SVG usan la opción «SVG oscuro» del visor.

## Evidencia y alcance

| Estado | Evidencia |
| --- | --- |
| IMPLEMENTADO | Ventana y autorización delegada en Main, cola y almacenamiento de Officina, verificación de destino y lectura correlacionada. Las referencias de línea apuntan a ZeN en `86ebba0220775cf3249d28083db67b4ab57b5279`. |
| PROBADO | El smoke de Officina usa un puente simulado y un perfil temporal. Las comprobaciones de estos diagramas se ejecutan por separado. |
| PLANIFICADO | QA independiente de los diagramas y la comprobación del recorrido con Codex real. |

Las referencias documentan el compañero activo en la revisión indicada, con un corte centrado en Officina. Para consultar el estado posterior del compositor, los turnos y el observador, consulta la [arquitectura de ZeN](../../ARCHITECTURE.md).

## Regenerar desde la raíz de ZeN

1. Usa el fork [SammElias/Archify--HTML-Arquitecture](https://github.com/SammElias/Archify--HTML-Arquitecture) en el commit `01d1fe6c0a22be646b91605b686b8fd872f0262e`. Procede de [tt-a1i/archify](https://github.com/tt-a1i/archify).
2. Con Python, Node, Chrome y Playwright de ZeN disponibles, ejecuta:

   ```powershell
   $env:ARCHIFY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
   python docs/diagrams/sources/regenerar.py C:/ruta/al/checkout-de-archify
   ```

3. El script fija el tema inicial oscuro y encuadra el lienzo en pantallas estrechas mediante una copia temporal de la plantilla. Ejecuta `finalize` por vista con `--quality showcase --repo-root .`. Después, Playwright abre los HTML locales sin red, prueba el arranque oscuro y descarga los SVG oscuros. Recibos y capturas quedan en `release/archify-diagrams/`.

El índice enlaza los SVG del repositorio. La regeneración produce los visores interactivos para consulta local. Los SVG se exportan sin incrustar fuentes. Consulta [Apache 2.0](archify-LICENSE), [MIT histórica](archify-LICENSE-MIT), [NOTICE](archify-NOTICE) y [avisos de terceros](archify-THIRD_PARTY_NOTICES.md).

A 390 px, la barra distribuye los controles en varias filas para conservar el acceso a todos los botones. La validación de Playwright comprueba sus límites visibles y activa el zoom con teclado a 390 y 1440 px.
