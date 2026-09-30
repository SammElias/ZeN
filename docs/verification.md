> Informe histórico. Estado vigente y nuevas pruebas: [objective-verification.md](objective-verification.md). Las limitaciones y conteos siguientes describen aquella entrega, no el producto actual.

# Verificación · primera entrega · 30 de septiembre de 2026

La revisión **ZEN Capsule** tiene su informe propio en [ui-verification.md](ui-verification.md). Actualiza el comportamiento de ocultar: Esc/cierre desconecta voz sin cancelar una tarea activa; Detener sigue cancelando. Las 49 pruebas mencionadas abajo corresponden a la primera entrega; la revisión de interfaz amplía a 70 y añade capturas/pruebas UI. Este documento conserva la evidencia histórica de la base funcional.

## Resultado

La primera entrega tiene implementación real y pruebas de texto y voz contra OpenAI en Windows. **La demostración con una persona, micrófono/altavoz físicos y pulsación del atajo sigue pendiente.** No se presenta una prueba de audio sintético como aceptación física completa.

## Implementado

| Entregable | Código / comportamiento |
|---|---|
| Electron + React + TypeScript | src/main/, src/preload/, src/renderer/; build reproducible y package-lock.json |
| Conversación, bandeja, atajo, Detener | src/main/index.ts, src/renderer/main.tsx; atajo configurable y una instancia |
| Responses con Astra | src/agent/orchestrator.ts; function calling estricto, contexto de tarea, sin fallback |
| Voz Realtime y delegación | src/agent/voice.ts, src/renderer/voice.ts; WebRTC, sideband, transcripción, delegación y respuesta de audio |
| Interrupción / cancelación | AbortSignal, VAD interrupt_response, invalidación de turnos y resultados antiguos |
| Apertura permitida y verificación | src/policy/, src/tools/windows/; Win32 EnumWindows, PID y ruta confiable, reutilización |
| Configuración y secretos | src/shared/contracts.ts, src/storage/store.ts; safeStorage/DPAPI, borrado, diagnóstico |
| Límites | Una tarea, hasta 10 llamadas, 90 segundos; sesión de voz máxima 5 minutos |
| Registro | Metadatos sin conversación/clave; voz, tokens y herramientas separados; uso API y coste estimado no calculado |
| Documentación | README, AGENTS y docs/; backlog separado |

## Probado

Entorno: Windows, sesión interactiva accesible por procesos locales; Node 22.17.1, npm 10.9.2. Fecha local: 30/09/2026, Europe/Madrid. Los JSON usan UTC.

| Prueba | Resultado y evidencia |
|---|---|
| `npm run build` | Tipos y bundles main/preload/renderer correctos |
| `npm test` | 49 pruebas, 4 archivos, todas correctas; política, args manipulados, IPC schema, deduplicación, límite de llamadas, cancelación, timeout, errores API, almacenamiento y delegación/interrupción de voz |
| `npm run test:windows` | Abrió Bloc de notas, encontró ventana visible, volvió a verificarla como ya abierta sin repetir lanzamiento. docs/evidence/windows.json |
| `npm run test:electron` | Arranque real, UI renderizada comprobando DOM, bridge disponible, Node ausente en renderer, IPC inválido bloqueado, bandeja creada, Ctrl+Alt+Z registrado, safeStorage cifra/descifra una clave ficticia y la elimina. docs/evidence/electron.json |
| `npm run test:api` | Con clave existente y autorización explícita: acceso a 3 modelos, Astra devuelve herramienta esperada, Realtime emite credencial efímera sin revelar ni guardar valor. docs/evidence/api.json |
| `npm run test:integration` | Módulos de producción: texto con Astra y ejecutor Windows; audio sintético OpenAI por WebRTC → transcripción → delegación sideband → Astra → ventana verificada → audio remoto. Respuesta final confirmada tras devolver la herramienta. docs/evidence/live-integration.json |
| `npm audit` / `npm audit --omit=dev` | Cero vulnerabilidades conocidas al cerrar la entrega; no implica auditoría de seguridad completa |

La prueba real de texto usa el mismo orquestador y ejecutor, pero no pulsa Enviar desde la UI. La de voz recibe un track remoto y transcripción final, sin emitir el audio por el altavoz. Interrupciones y manejo de fallos API están probados con mocks; no se han provocado fallos de facturación, red o acceso en la cuenta real.

## Incidencias resueltas y límites observados

- Windows rechazó inicialmente la ejecución de un archivo .ps1. El ejecutor transmite su propio script fijo con EncodedCommand; no modifica ExecutionPolicy, ni acepta código del modelo.
- La primera prueba de voz terminó al recibir una frase preliminar de Realtime antes del resultado de la herramienta. Se corrigió el criterio del harness: ahora exige function_call_output devuelto y la respuesta de audio posterior. La aplicación ya gestionaba la delegación en main; no se contó esa primera prueba como éxito.
- La captura visual de una ventana Electron oculta devolvió `UnknownVizError` en este entorno. Se conservó la prueba DOM/bridge; **revisión visual de la UI no declarada probada**. La captura no es una capacidad de producto de esta fase.
- El registro de uso de Realtime recibe response.done; al cerrar por Detener no se garantiza un uso final completo. El registro marca finalUsageConfirmed:false. Costes estimados no disponibles, sin importes inventados.

## Pendiente y pasos concretos

1. **Demostración física completa:** ejecutar `npm start`, guardar una clave personal en Configuración, aceptar voz y guardar. Desde otra aplicación, pulsar Ctrl+Alt+Z, decir «Abre el Bloc de notas» y escuchar la confirmación. Comprobar que el indicador del micrófono se apaga al pulsar Detener y al ocultar ZEN. Repetir con Bloc de notas ya abierto. Registrar fecha, dispositivos y resultado.
2. **Atajo y configuración:** cambiar a un atajo libre, guardar e invocar desde otra aplicación. Probar un atajo ocupado y comprobar el mensaje y conservación del anterior. El registro del atajo está probado; la pulsación física no.
3. **Interrupción acústica:** durante una respuesta hablada, comenzar otro turno; comprobar que el audio anterior se corta y no se ejecutan herramientas del turno cancelado. Pulsar Detener durante «pensando»; una ventana ya abierta puede permanecer abierta. Los invariantes internos están probados con mocks, no el comportamiento acústico del hardware.
4. **Dispositivos y red:** probar micrófono ausente/denegado, permisos de Windows, reconexión manual tras fallo de Wi-Fi y firewall WebRTC. Las rutas de diagnóstico existen; esas situaciones físicas no se han reproducido aquí.
5. **UI visual y accesibilidad:** inspeccionar a 100/125/150 % de DPI, teclado y lector de pantalla. El renderer carga y contiene los controles; no hay aprobación visual en distintos monitores.
6. **Distribución:** instalador y firma fuera del alcance; usar la ejecución de desarrollo documentada. No distribuir una clave compartida.

## Propuesto

Memoria, palabra de activación, acceso a archivos seleccionados, búsqueda, visión, control general por UI y aprobaciones de operaciones irreversibles están en docs/roadmap.md; no tienen implementación ni se declaran probados.
