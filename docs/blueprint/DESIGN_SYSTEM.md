# Sistema de diseño

## Dirección visual y marca

ZEN usa superficies de cristal oscuro o claro con degradado, contraste suficiente para leer de un vistazo y acento elegible. El núcleo orbital comunica estado junto a una etiqueta; el movimiento acompaña cambios reales. Mantener lenguaje directo: «Enviar a Codex», «Sin reproducción», «Volver al chat». Evitar explicaciones repetidas sobre la implementación.

## Color, tipo y espacio

| Elemento | Base actual |
| --- | --- |
| Texto y detalle, tema oscuro base | `#f1f2f5` y `#91949e` |
| Acento y borde base | `#b4a0ec` y `#ffffff12`; el acento efectivo puede ser violeta, ámbar o menta |
| Estados base | Trabajo `#67b4ff`, permiso `#eeb96a`, fin `#85cfa9`, error `#fb858d` |
| Tipografía | `system-ui`, Segoe UI; códigos en Cascadia Mono/Consolas. Base: botones 12 px, texto 13 px, detalle 11 px, h2 17 px. Home usa su escala de cabecera. |
| Radios y capas | Control base 10 px, pestaña agrupada 12 px. La cápsula usa su contorno redondeado y no lleva sombra exterior. |

Tomar separaciones de los componentes vecinos: controles agrupados con 4–8 px y más aire entre secciones. Reutilizar variables CSS de cristal (`--glass-*`) en vez de fijar un color oscuro que falle en tema claro. Opacidad 28–96 %, valor inicial 86 %; desenfoque 0–40 px. El fondo puede ser Aurora, Atardecer o una imagen local.

## Componentes y estados

- **Botón:** primario para enviar o abrir el destino; secundario para copiar, cambiar vista o navegar. Un permiso o efecto requiere nombre explícito. Mantener foco visible y desactivar mientras corresponde.
- **Entrada:** etiqueta visible, límites y error cercanos; el placeholder solo ilustra. No perder el borrador ante un fallo.
- **Tarjeta:** un estado principal, detalle breve y acceso a la vista que lo amplía. Las listas de datos largos se leen en el modo app.
- **Cápsula:** una fila con Codex, navegación, multimedia y controles. Al abrir una sección, su contenido aparece debajo de la misma cabecera. Mantener una sola campana y una sola ventana.
- **Estado:** distinguir carga, vacío, no disponible, permiso y error con texto o icono accesible; no usar solo color. El silencio de Codex no se presenta como progreso.
- **Icono:** SVG de línea de la familia ZEN; controles de icono con nombre accesible. El tamaño base del glifo es 17 px.

## Tamaños y accesibilidad

La cápsula tiene referencia de 820 × 68 DIP y se adapta al área de trabajo. El panel conserva el ancho y la cabecera y crece hacia abajo hasta 680 DIP cuando hay espacio. Probar estrecho, intermedio y ancho: el texto largo se ajusta o trunca sin cubrir controles y las tablas largas se desplazan dentro de su área. Comprobar teclado, foco, contraste en cada tema y preferencia de movimiento reducido; Home contempla transparencia reducida.

Fuentes: [base CSS](../../src/renderer/companion-base.css), [estilos del compañero](../../src/renderer/companion.css), [Home](../../src/renderer/CompanionHome.css), [opciones](../../src/shared/companion-appearance.ts).
