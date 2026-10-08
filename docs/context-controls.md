# Captura accesible e Inicio desde el robot · 08/10/2026

## Implementado

- «Actualizar captura» visible junto al editor en Inicio, Chat, Tareas, pregunta rápida y pantalla completa. Ya no requiere abrir el panel de Contexto. Permanece disponible cuando la referencia está vacía, caducada, quitada o no disponible.
- Fuente y hora en una fila compacta, con título completo al pasar el cursor. «Ver» abre la imagen exacta; «Quitar» retira la referencia. La renovación bloquea clics duplicados mientras se prepara y conserva el borrador. No hay captura continua ni cambios en selección de monitor, exclusiones, caducidad o política de efectos.
- Si hay contexto manual seleccionado, se conserva: el botón explica que hay que quitarlo para utilizar la captura automática. No se reemplaza una imagen pegada, un archivo o una carpeta de forma implícita. Al escribir, renovar no llama a `run`; Enviar conserva el identificador concreto de la referencia elegida. La entrega visual a una sesión Live ya activa mantiene el comportamiento existente del backend.
- Clic en la cabeza de la cápsula o en el robot flotante abre Inicio. El botón de Chat, el menú Chat y los accesos explícitos de conversación conservan su destino. Arrastrar no dispara navegación. Voz, historial, proyectos y borradores conservados.
- El aviso inferior se oculta mientras se lee su detalle en el centro: evita duplicarlo y mantiene alcanzable «Volver» a 320×360 con micrófono/reunión y editor multilínea.
- Agente remoto y ambos JSON exactos sin cambios.

## Probado

- Build TypeScript/Vite. Recorrido de Edge con IPC/captura simulados: actualización única, borrador, vista previa exacta, identificador enviado, ningún envío antes de Enviar, renovación después de caducar/quitar, prioridad de imagen manual, botón alcanzable en 320×360, 380×400 y 960×640, robot de cápsula/flotante → Inicio y menú Chat → Chat. `evidence/context-controls-ui.json`.
- Regresión compacta: Inicio cabe, borrador compartido, lectura y filtro de tareas conservados, permisos/Detener/compositor alcanzables, texto ampliado y ausencia de errores de página. `evidence/compact-ui.json`.
- Regresión de pantalla completa, borrador, F11/Esc, scroll y stream sin redimensionado: `evidence/fullscreen-ui.json`.
- Paquete y EXE único extraído/arrancado en Windows con perfil sin clave: IPC contextual, referencia congelada, tamaños, cápsula y pantalla completa pasan. Copia del mismo binario verificada por SHA256 en `evidence/context-controls-desktop.json`; anterior conservado dentro de `release/desktop-backups`. No se cierra ni cancela una instancia de producción para la prueba.

## Límites

Estos recorridos usan capturas sintéticas y no llaman a la API. La captura física de ventanas excluidas, voz, foco y cambios de DPI conservan sus pendientes. El EXE concreto se identifica en la evidencia de despliegue; la versión base de GitHub es `cdbf4f9` y estos ajustes son locales hasta su publicación.
