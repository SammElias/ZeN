# Control visual de ZEN · 1 de octubre de 2026

Petición autorizada: observar la pantalla, proponer acciones estructuradas, ejecutarlas y obtener contexto nuevo hasta terminar la tarea. Implementación en `src/agent/computer.ts`, `src/main/computer-surface.ts` y `native/Zen.Windows/Computer.cs`.

## Uso

Abre la aplicación, mantén toda su ventana visible en un monitor y pide por chat o voz, por ejemplo: «Controla la pantalla y rellena este formulario», «Crea una tabla en Dataverse» o «Analiza este flujo de Power Automate». ZEN elige la ventana por nombre, foco o contexto detrás de la cápsula. Opera esa ventana; no abre ni cambia a otras aplicaciones automáticamente. El navegador del usuario conserva su sesión porque se controla su ventana existente. Autenticación y campos protegidos se dejan al usuario.

El ciclo usa Responses con el modelo existente `gpt-6.1-sol` y `computer`, dentro de la misma tarea. No modifica el agente guardado remoto, su configuración local ni el JSON de GPT-Live. El análisis de carpetas sigue abriendo Codex del escritorio. No se eliminan las herramientas existentes.

Cada bloque de clics, escritura, teclas o arrastre presenta las acciones concretas, aplicación y petición original, con «Ver pantalla revisada». Se aprueba mediante el código visible por chat o voz; en voz hay que soltar pulsar para hablar o silenciar explícitamente. La política actual exige revisión concreta de efectos: esta versión no concede permiso global para actuar sin confirmaciones. Captura, espera y desplazamiento simple no piden revisión de efecto; avisos de seguridad sí. El compositor queda disponible durante la tarea de control para enviar su confirmación. La aprobación es inmutable, de un uso y caduca a los cinco minutos. Una nueva orden de trabajo con otro objetivo/contexto o Detener cancela el control pendiente. Las consultas informativas no revocan por sí solas la tarea.

Antes de ejecutar se vuelve a observar. Cambios de imagen o posición invalidan el bloque; se obtiene contexto para una propuesta nueva sin repetir efectos. La comparación exacta puede requerir nuevas revisiones en pantallas animadas o con cursor de texto intermitente. Los efectos se serializan con las demás operaciones de escritorio. Cambiar a otra aplicación, cerrar la ventana, reutilizar su handle, una exclusión, escritorio seguro/bloqueado o un fallo de entrada detienen la operación. No hay reanudación automática después de timeout o reinicio.

Se admiten clic, doble clic, desplazamiento, movimiento, arrastre, texto Unicode, combinaciones de teclas permitidas, espera y captura. Coordenadas relativas a la imagen se transforman a píxeles físicos de la región cliente. El destino de ratón debe pertenecer a la ventana seleccionada y el teclado requiere foco real. Terminales, elevación, atajos globales/desarrollo y comandos reconocidos se rechazan. El auxiliar no es un sandbox y la inspección de píxeles no demuestra el significado de cada clic; por eso los efectos conservan revisión humana concreta.

## Consumo y límites

Esta ruta usa API, con contabilización existente, no la suscripción de Codex. Mantiene petición original, un registro textual acotado y el último intercambio de herramientas con su razonamiento cifrado; no reenvía capturas antiguas ni guarda las imágenes o texto escrito en el registro de ejecución. La revisión visual permanece en RAM y en el renderer local mientras está pendiente.

Preferencias avanzadas: 40 respuestas, 160 acciones y 10 minutos por tarea por defecto; editables. Un límite alcanzado produce tarea incompleta, no éxito. La finalización requiere estado y evidencia visual atribuida a la última captura; sigue siendo evaluación del modelo, no comprobación independiente de Dataverse. Presupuesto mensual estimado: no garantía de facturación.

## Verificación actualizada — 02/10/2026

El bloqueo de entrada se ha corregido conservando el escritorio interactivo heredado. Ratón/teclado Unicode y selección UIA pasan en Windows real. El ciclo con SOL real también pasa: tres respuestas, formulario guardado y resultado visible verificado. Véanse `docs/evidence/computer-native.json`, `computer-live.json` y [uso diario](workspace-improvements.md). Electron actual acredita `shownOnTop=true`. Power Platform y voz humana siguen pendientes.

## Verificación histórica — 01/10/2026

- 267 pruebas de lógica: admisión de órdenes, coordenadas, bloqueos, revisión, cancelación, foco, identidad, imagen/posición cambiada, deduplicación, continuidad, evidencia vigente y códigos de un uso.
- Compilación TypeScript y auxiliar Windows.
- IPC/renderer de Electron: ciclo con modelo y superficie sintéticos, propuesta antes de efectos, confirmación por chat, continuación y rechazo de reutilización del código. Resultado en `docs/evidence/computer-electron.json`. La comprobación general de Electron encontró además `shownOnTop=false`; no declarar toda la interfaz validada.
- Intento Windows real en Edge con página sintética: `docs/evidence/computer-native.json`. Captura/destino visibles, pero El primer controlador falló en `SetCursorPos`. El controlador final utiliza `SendInput` con movimiento absoluto y comprobación de cursor; Windows también rechazó la inyección (`computer-inject`, Win32 0). **El recorrido real de ratón/teclado no está acreditado y permanece pendiente.** La prueba no modificó Dataverse ni llamó a la API. `node scripts/computer-native.mjs` permite repetir el recorrido en una sesión interactiva; un fallo conserva resultado incompleto.

Pendientes: ratón y teclado en el ejecutable iniciado por el usuario, GPT-6.1-Sol/API real en este ciclo, confirmación física por voz y una tarea real en Power Apps/Power Automate. No declarar el objetivo completo.

Interfaz Edge headless: `docs/evidence/computer-ui.json`, propuesta/captura visible y compositor disponible durante tarea pendiente para confirmar y continuar. Candidato compilado en `C:\Users\Gamming\Desktop\ZEN Control - prueba\ZEN.exe` (`docs/evidence/computer-candidate.json`): no validado como paquete completo. El control de entrada real y `shownOnTop` fallaron en este entorno; se conserva el ejecutable y acceso ZEN anterior.

Contrato de Computer Use: https://developers.openai.com/api/docs/guides/tools-computer-use
