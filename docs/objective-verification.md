# ZEN: estado verificable · 30 de septiembre de 2026

**El objetivo final todavía no está completo.** Las instrucciones de los documentos se aplican dentro de la petición del usuario; páginas, imágenes y resultados se procesan como datos, sin autoridad para ordenar efectos.

## Implementado y probado

| Capacidad | Implementación y evidencia |
|---|---|
| Agente guardado | Agents API, ZeN/gpt-6.1-sol, sin overrides. Se corrigió la frase autorizada y después se añadió zen_desktop con autorización específica: [corrección](evidence/saved-agent-config.json) y [ampliación](evidence/desktop-agent-config.json). Validación de turno/resultado, sin mostrar reasoning_steps ni ejecutar acciones narrativas. |
| Búsqueda/continuación | [Búsqueda real Microsoft](evidence/saved-agent-live.json), 19.418 ms; [continuación real](evidence/agent-followup-live.json), 9.802 ms. Suscripción antes de entrada, idempotencia y una entrada activa por sesión. Mocks prueban idle distinto de éxito, ejecución/idempotencia de required_actions autorizadas y bloqueo de solicitudes incompatibles. |
| Interfaz | [Isla compacta v1](island-v1.md), 320×48 DIP y anclaje superior. Exclusiva para actividad/stream/contexto/tareas, preferencias separadas desde bandeja. Resultados completos bajo demanda, permisos concretos, micrófono y Detener visibles. Edge headless, Electron/Windows y stream público API real verificados por separado. DPI/monitores físicos y confort en llamada pendientes. |
| Página/archivo/aplicación | Órdenes directas acotadas, navegador aislado, visor de lectura y aplicaciones registradas/Notepad con ventana verificada. [Electron real](evidence/objective-electron.json): páginas/archivos propios, Notepad y foco conservado en modo reunión. |
| Creación revisada | Directorio elegido, destino/contenido inmutables, permiso de un uso, sin sobrescritura. Tests filesystem y Electron real: tarjeta visible, clic Permitir, archivo leído y segunda aprobación rechazada. |
| Visión/lectura | Auxiliar .NET: UI Automation y PrintWindow de ventana elegida, límites, exclusiones y revalidación. [Observación Windows](evidence/native-observation.json). [Imagen enviada y borrador](evidence/vision-agent-live.json): datos de prueba, perfil de prueba, sin enviar mensaje; resultado recuperado tras corregir presentación como objeto, sin repetir petición. Captura no persistida localmente. |
| Medios | SMTC con selección inequívoca y Pause verificado. [Reproductor real de prueba](evidence/native-media.json): segunda pausa no reanuda; reproductores personales no modificados. |
| Memoria | Vacía inicialmente, importación con preview editable; hechos/preferencias/tentativos, origen/fecha, búsqueda, corrección, exportación y borrado. Tests persistencia/reinicio/UI, Electron guarda y elimina. Solo contexto relevante. |
| Tareas | IDs/estados y progreso de eventos reales, concurrencia 1–3, cola de pendientes acotada, prioridades alta/normal/baja y FIFO entre iguales, cola serial de efectos, cancelación individual/global, tiempo/pasos, resultados persistentes y recuperación sin repetir efectos. **114 tests en doce archivos**; build y auxiliar compilados. |
| Voz/reunión | Realtime/WebRTC + sideband, transcripción y mismo gestor. Silencio persistente, reunión manual y opción de resultados sin foco (Electron real). Push-to-talk implementado: conecta silenciado, botón mantenido/Ctrl+Espacio con ZEN enfocado, suelta/cambio de foco silencia; tres mocks prueban negociación y cancelación. Hardware físico pendiente. [Interrupción real](evidence/voice-interruption-live.json): audio limpiado con investigación activa, tarea completa por escrito. Audio sintético; no valida hardware físico. |
| Ejecutable | [Paquete portable ejecutado](evidence/portable-package.json), ruta/hashes/pruebas. Sin claves ni datos personales; requiere .NET Desktop Runtime 10. Sin instalador/firma propia. |

clearRoundTripMs = 886,1 ms en voz incluye espera deliberada hasta investigación activa y transporte remoto: **no mide mute local ni interrupción hablada**. No se midió primera respuesta física o calidad acústica. Duración de visión no registrada: null.

El usuario dijo «perfecto validado» sobre la versión anterior. Es aceptación comunicada, sin atribuirle pruebas físicas específicas ni extenderla a cambios posteriores.

## Ampliación autorizada del agente

El usuario autorizó añadir zen_desktop manteniendo intactas las demás opciones. [Configuración remota verificada](evidence/desktop-agent-config.json). El bloqueo anterior quedó resuelto: puente implementado, con política sobre petición original, capacidades locales elegidas, deduplicación, resultados por call/turn e idempotencia.

[API + Windows reales](evidence/desktop-bridge-live.json): listar aplicaciones y abrir una página local mediante la función, título verificado y foco conservado, 35.277 ms conjuntamente. [Creación propuesta por el agente](evidence/desktop-creation-live.json): 83.587 ms, tarjeta con contenido correcto, ningún archivo antes de Permitir y creación verificada después. El foco de ese recorrido con aprobación humana cambió; no se presenta como foco conservado. El comparador del recorrido general se separó después. Todas las operaciones del puente no se validaron juntas contra API: lectura, captura, medios y apps tienen evidencia independiente; puente completo de esas rutas queda pendiente de recorrido real.

[Alcance y configuración](desktop-tools-proposal.md). No se declara control general de Windows por haber añadido una función limitada.

## Pendiente

- Control general Windows por UI Automation/ratón/teclado y navegación autenticada de LinkedIn. Borrador con captura de prueba validado; conversación real/envío no probados. Navegador ZEN no hereda cookies Edge/Chrome.
- Captura de monitor seleccionable, observación continua autorizada, portapapeles y organización general de proyectos. Hoy ventana seleccionada y creación nueva revisada.
- Presupuesto monetario duro por sesión. Prioridades, controles urgentes, pasos, tiempo y concurrencia implementados. Pausa bloquea efectos nuevos, sin suspender investigación remota.
- Detección fiable de llamada Teams; resultados discretos sin foco opt-in y push-to-talk ya implementados. Prueba física de push-to-talk pendiente.
- Palabra de activación fiable con consentimiento para micrófono continuo si se implementa. VAD/atajo no equivalen a «Hola Zen».
- Sandbox efectivo si se habilita código generado; no se habilitó shell arbitrario.
- Recorridos físicos: Teams real, micrófono ocupado, eco/auriculares, varios monitores/DPI, bloqueo/UAC/ventanas privilegiadas y pérdida de red real. Controles/mocks/diagnósticos existentes no sustituyen esos recorridos.
- Instalador, firma y actualizaciones. Portable disponible para probar.
- GPT-Live **registrado, no integrado ni probado**, por la orden de terminar primero tareas anteriores; [JSON y guion exactos](handoffs/order.md).

## Entorno

Windows; Node 22.17.1; Electron 44.5.1; .NET SDK 10.0.401; OpenAI SDK 7.25.0. [README](../README.md) contiene comandos. Cambios nuevos todavía no publicados en GitHub; remoto conserva la primera entrega.
