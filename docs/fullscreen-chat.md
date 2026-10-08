# Chat a pantalla completa · 08/10/2026

Petición: añadir una opción para expandir ZEN a pantalla completa y leer mejor el chat de texto.

## Implementado

- Botón de cuatro esquinas en la cabecera desplegada. Abre Chat a pantalla completa en el monitor de la cápsula; el mismo botón o F11 vuelve al panel. F11 también permite entrar desde la cápsula. Esc sale primero de pantalla completa; los diálogos y el menú de adjuntos consumen Esc antes. La cruz continúa ocultando ZEN.
- Vista de lectura centrada de hasta 1040 DIP, texto de 16 px, conversación desplazable y compositor/controles al pie. Conserva Home y Chat, el último mensaje, el borrador, adjuntos, voz, tareas y aprobaciones. El compositor y la conversación permanecen montados al cambiar de tamaño.
- La ventana transparente sin marco ocupa `display.bounds` completo mediante la geometría propia de ZEN, sin depender de maximizar una ventana transparente de Electron. No permite coordenadas ni tamaños arbitrarios desde IPC. El arrastre queda desactivado durante esta vista; monitor, borde y ratios de anclaje se conservan al regresar.
- Recoger vuelve a la cápsula; Ocultar/restaurar conserva el comportamiento de barra de tareas. La pantalla completa no inicia capturas, voz, tareas ni llamadas API. No hay cambios de tamaño por delta ni autoocultación mientras se lee esta vista.
- `config/live-session.json` y `config/saved-agent.json` conservados byte a byte; agente remoto sin cambios.

## Probado

- Build TypeScript/Vite y 305 pruebas en 35 archivos. Geometría de pantalla completa y retorno en los tres bordes, coordenadas negativas y otro monitor con distinto origen.
- Edge real con IPC simulado: ocupa el viewport, columna más ancha, lectura sin desplazamiento forzado, compositor/mensaje conservados, borrador, F11/Esc, prioridad del menú de adjuntos, plegado y pantallas de 1920×1080, 800×600 y 380×700. Stream literal sin nuevas peticiones de layout. Evidencia: `evidence/fullscreen-ui.json`.
- Regresión general de interfaz y ciclo de alturas: `evidence/ui-current.json`; streaming con cero cambios de layout y DOM estable.
- Electron real en Windows con tareas sintéticas: ventana 1920×1080, controles dentro del viewport, retorno a 640 DIP y anclaje intacto, compositor conservado, arrastre y coordenadas IPC arbitrarias bloqueados. Sin llamadas API. La prueba de Preferencias ahora espera a que React termine de montar después de `loadFile`; su aislamiento sigue verificado.
- EXE único extraído y arrancado en Windows, `fullscreenChatVerified:true` y `remainingChecks:[]`. SHA256 y copia al escritorio en `evidence/fullscreen-desktop.json`. Conservado el EXE anterior bajo `release/desktop-backups`. Esta entrega incluye cambios locales sobre `dbda6f7`; todavía no están publicados en GitHub.
- Se conserva el primer intento en `evidence/fullscreen-single-attempt.json`: la vista ampliada pasó, pero dos comprobaciones iniciales de cápsula fallaron. La repetición del mismo binario pasó todas las comprobaciones; la causa de esa discrepancia no quedó aislada. El script de entrega ahora rechaza cualquier comprobación falsa, aunque el arranque haya terminado con código cero.

## Límites

Las pruebas de teclado/clic y arrastre son automatizadas; queda la comprobación física del usuario, especialmente con escalado DPI distinto entre monitores. No se atribuye validación nueva de voz física, APIs ni del objetivo general a esta mejora. Las evidencias del paquete y la entrega al escritorio registran el ejecutable concreto probado.
