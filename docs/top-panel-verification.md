# ZEN: panel superior navegable

Historial de la revisión anterior. La interfaz vigente es la [isla compacta v1](island-v1.md), que reduce dimensiones y separa preferencias de la ejecución por petición posterior del usuario.

Petición del usuario: interfaz más amigable, como un panel navegante anclado al borde superior. Esta revisión sustituye el anclaje inferior de ZEN_UI_SPEC.md; conserva las integraciones existentes.

## Implementado

- Anclaje al borde superior del área útil del monitor. Centrado horizontal y crecimiento hacia abajo; sin arrastre. Respeta el espacio reservado para la barra de tareas de Windows.
- Barra recogida de 68 DIP y panel desplegable. Navegación persistente: Conversación, Tareas, Herramientas y Ajustes.
- Bienvenida y accesos rápidos que rellenan el texto sin ejecutar órdenes. Herramientas locales separadas de los ajustes y tareas con prioridad/cancelación/continuación.
- Estilo oscuro con acentos suaves, más espacio, textos claros y diseño adaptable. Cabecera y entrada permanecen a mano mientras el contenido se desplaza.
- Recoger conserva tareas, resultados y voz. El estado del micrófono permanece visible en la cabecera. Esc/cierre oculta y desconecta voz sin cancelar investigación; inicio en bandeja y atajo se mantienen.
- Sin cambios al agente guardado, sus herramientas, las llamadas API ni el guion GPT-Live pendiente.

## Probado

114 pruebas unitarias; tipos y compilación. Geometría superior en coordenadas negativas, escalados simulados y pantalla pequeña.

Edge headless: cuatro secciones, recoger/desplegar, sugerencias sin ejecución, Enter/Shift+Enter, Esc sin Stop, historial, perfil/importación/exportación, reducción de movimiento, pantalla pequeña y ausencia de errores. [Informe](evidence/top-panel-ui.json), [bienvenida](ui-preview/idle.png), [barra](ui-preview/topbar.png), [ajustes](ui-preview/settings.png).

Electron real: y=0 en el área útil de prueba, barra 720×68 DIP, tarjeta 760×260 DIP, mismo borde al expandir y movable=false. DPAPI ficticio, IPC, bandeja, abrir página/archivo/Notepad, aprobación real y modo reunión siguen pasando. [Informe](evidence/top-panel-electron.json). El atajo del proceso de prueba estaba ocupado por otra instancia; no se atribuye a este recorrido una validación física del atajo.

Paquete portable ejecutado con las mismas comprobaciones: [ruta y hashes](evidence/portable-package.json). No se repitieron llamadas OpenAI de pago para una modificación de interfaz.

Último paquete verificado: `release/ZEN-20260930170228689/ZEN.exe`. La comprobación incluye el estado visible del micrófono en la cabecera. Una ejecución anterior del paquete falló la comparación del foco en modo reunión; la ejecución final completa pasó esa comprobación. Esto no sustituye el recorrido físico durante una llamada.

## Referencia descargada

Coucou está descargado por petición del usuario en `.reference/coucou`, separado y excluido de Git. [Revisión y propuestas](coucou-reference.md). Se consultaron código y capturas; no se ejecutó ni se incorporaron sus recursos. Las propuestas derivadas de esta referencia todavía no se han aplicado al panel.

## Pendiente de comprobación manual

Confort del panel durante uso diario y llamada real, arrastre mediante gestos del sistema, y recorrido físico por todos los monitores/DPI. La simulación no acredita estos casos. El objetivo funcional completo sigue teniendo los pendientes de [objective-verification.md](objective-verification.md).
