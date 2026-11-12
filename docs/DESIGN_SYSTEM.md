# Sistema de diseño de ZEN

## 01 · Identidad y superficies ![](assets/violeta.svg)

La cápsula conserva el núcleo orbital y cuatro zonas, en orden de estado de Codex, navegación, Sonido y controles. El color y la animación acompañan una etiqueta de estado. Al desplegar, la cabecera permanece sobre el contenido de la sección. Apuntes conserva su organización de biblioteca, lista y lector con los colores del tema de ZEN.

## 02 · Tokens y escala ![](assets/rosa.svg)

| Elemento | Valor o regla actual |
| --- | --- |
| Texto y detalle base | `#F1F2F5` y `#91949E`. Usar los tokens efectivos de cristal en cada tema. |
| Acento y borde base | `#B4A0EC` y blanco al 7 %. El tema admite violeta, ámbar y menta. |
| Estado de Inicio | Trabajo `#67B4FF`, permiso `#EEB96A`, turno terminado `#85CFA9`, error `#FB858D`. |
| Tipografía | `system-ui` y Segoe UI. Botón base 12 px, texto 13 px, detalle 11 px y h2 17 px. |
| Controles | Glifo base 17 px, radio del botón 10 px y separación entre controles agrupados de 4 a 8 px según componente. |
| Cristal | Monocromo, oscuro y claro. Opacidad del 74 al 100 % con 90 % inicial. Desenfoque de 0 a 40 px. Fondos Aurora, Atardecer o imagen local. |

Usar `--glass-*` y el fondo del tema para respetar preferencias. La cabecera recogida tiene su propio contorno y evita el marco y la sombra nativa exterior. Las superficies de edición favorecen el contraste.

## 03 · Componentes ![](assets/azul.svg)

- **Botones.** Primario para la acción de la vista. Secundario para copiar, cambiar de pestaña o navegar. Los botones solo con icono conservan nombre accesible.
- **Campos y tarjetas.** Mantener etiquetas, foco y mensajes de error próximos. Las tarjetas muestran un estado principal y acceso a su detalle. Inicio agrupa petición, accesos rápidos, actividad y avisos.
- **Navegación.** Iconos de línea, indicador de sección activa y contador en Avisos. Codex conserva **Actividad** y **Resumen**. Los controles de anclaje permanecen a la derecha.
- **Confirmaciones.** Mostrar la acción concreta y una salida de cancelación. El análisis y los permisos se revisan en ZEN. Importar un respaldo usa diálogo nativo.

## 04 · Adaptación y accesibilidad ![](assets/turquesa.svg)

La referencia recogida es **820 × 68 DIP**. El ancho se ajusta al área de trabajo y el panel desplegado usa su alto completo. En anchos reducidos, las etiquetas secundarias se compactan y los controles derechos pueden ocupar dos filas dentro de la cabecera. El lector y el editor desplazan su propio contenido cuando lo necesitan.

Verificar foco visible, nombres de iconos, contraste con un fondo real, reducción de movimiento y textos que se truncan. Usar texto además del color para distinguir estados. Inicio contempla la preferencia de transparencia reducida.

Fuentes visuales: [CSS base](../src/renderer/companion-base.css), [Inicio](../src/renderer/CompanionHome.css), [Apuntes](../src/renderer/NotesWorkspace.css) y [apariencia](../src/shared/companion-appearance.ts).
