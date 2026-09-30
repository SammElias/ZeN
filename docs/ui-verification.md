> Informe histórico. Estado vigente y nuevas pruebas: [objective-verification.md](objective-verification.md). Las limitaciones y conteos siguientes describen aquella entrega, no el producto actual.

# ZEN Capsule · interfaz · 30 de septiembre de 2026

## Implementado

- Cápsula de 360 × 68 DIP y tarjetas de 480 px, altura adaptable limitada a 440; panel de 640 px limitado al 70 % del área útil. Input multilínea, historial y ajustes bajo demanda.
- Tokens de ZEN_UI_SPEC: fondo opaco, superficies oscuras, Segoe UI Variable, acentos morados, iconos SVG consistentes, texto seleccionable y foco visible.
- Inicio oculto en bandeja. Una única ventana frameless. Invocación por atajo/bandeja; si ya está visible se enfoca sin iniciar otra sesión. Por defecto el atajo enfoca texto; escucha automática configurable, condicionada a clave y consentimiento.
- Monitor del cursor como fallback explícito. Coordenadas DIP y workArea de Electron, incluidos monitores con coordenadas negativas. Reajuste al cambiar pantallas/resolución. No se consulta todavía la ventana activa de otras aplicaciones.
- Tamaño nativo ajustado al contenido: sin un lienzo transparente del tamaño del escritorio. Fallback opaco; no hay click-through global. Siempre encima solo mientras visible. Área arrastrable limitada a cabecera; botones, input y resultados excluidos.
- Expansión/recogida nativa de 240 ms, interpolación sin rebotes y anclaje inferior estable; entrada 200 ms y salida 140 ms. Movimiento reducido desactiva animación CSS y redimensionamiento animado. La visibilidad, tarea, conexión, micrófono y reproducción son estados separados.
- **Esc / ocultar:** termina captura y sesión, conserva conversación y no llama a cancelar la tarea existente. Resultados recibidos oculto quedan en el renderer y el registro; no reabre ni crea notificaciones. Bandeja indica tarea activa o atención.
- **Interrumpir voz:** silencia reproducción local y solicita cancelar la respuesta de audio/limpiar el búfer, sin cancelar el orquestador Windows. **Detener:** cancela generación/herramientas pendientes y desconecta voz. No deshace acciones ya realizadas.
- Medidor de voz con RMS real del micrófono vía AnalyserNode, sin ondas inventadas. No se actualiza oculto ni con movimiento reducido. Silenciar deshabilita la pista; el estado refleja micrófono apagado aunque la sesión siga conectada.
- Tarjetas de tarea, resultado con Copiar/Detalles, error persistente y cancelación. Preparando muestra actividad operativa, sin porcentajes ni razonamiento interno. Enter envía; Shift+Enter añade línea; se respeta composición IME.
- Preferencias nuevas compatibles con settings antiguos: listenOnInvoke y autoHideSuccess desactivadas por defecto. Temporizador de 6 s inhibido durante tarea, audio, error, aprobación, interacción, panel o resultado copiable. Todos los resultados actuales ofrecen Copiar y permanecen visibles; el temporizador solo admite un éxito breve sin contenido copiable.
- Vista independiente `preview.html`: simulación explícita, sin backend, herramientas, micrófono o llamadas OpenAI. Estados por `?state=idle|executing|completed|failed|awaiting_approval|cancelled|thinking`. Tarjeta de aprobación con botones de simulación de un solo uso. En la aplicación real esos permisos no están habilitados: no hay operaciones irreversibles ni contrato de aprobación ejecutable en la fase 1.

Componentes: src/renderer/App.tsx, components.tsx, capsule.css, auto-hide.ts; ventana/geometría: src/main/index.ts y overlay.ts; contratos/IPC: src/shared/contracts.ts y preload/index.ts. Se conserva Responses/Astra, Realtime/WebRTC/sideband, autorización determinista, ejecutor y DPAPI.

## Probado en esta revisión

| Control | Resultado |
|---|---|
| Build y tipos | Correctos |
| `npm test` | 70 pruebas / 5 archivos: regresiones existentes, geometría negativa/escala simulada, límites, temporizador, estados persistentes, interrumpir sin cancelar, desconectar sin cancelar y Detener con cancelación |
| `npm run test:ui` | Edge headless en Windows; estados representativos, Enter/Shift+Enter, Esc sin invocar Stop, historial conservado, ajustes, viewport pequeño, movimiento reducido y ausencia de errores JS |
| Capturas | docs/ui-preview/*.png; revisión visual de cápsula, resultado, error y aprobación simulada. Se corrigió espacio insuficiente en tarjetas cortas |
| `npm run test:electron` | Electron real: inicio oculto, bridge/aislamiento/IPC, bandeja, DPAPI, registro del atajo, visible siempre encima, oculto sin always-on-top y anclaje inferior entre cápsula y tarjeta. docs/evidence/ui-electron.json |
| Integración real conservada | Responses/Astra + Windows y Realtime con audio sintético: completado tras devolución de herramienta y respuesta final. docs/evidence/ui-live-integration.json. No es prueba de micrófono/altavoz físicos |

El primer intento del harness de voz en esta revisión venció después de speech_started, sin fin de turno. El siguiente, manteniendo envío de silencio después de la frase, completó la sesión. Se reforzó el fixture con una fuente de nivel despreciable y sin throttling de fondo para evitar que Chromium detenga un grafo de audio inactivo. Esto modifica el harness, no el transporte de micrófono del producto. No se atribuye con certeza el primer timeout a una única causa.

Los tests de aprobación cubren solo la simulación y la prohibición de desaparición automática. No prueban aprobación real ligada a actionId, caducidad o ejecución: siguen fuera del backend actual. Las pruebas de interfaz usan un bridge simulado; la prueba Electron usa la aplicación real y la de API usa los módulos reales.

## Pendiente de validación física

1. Windows a 100/125/150 %, dos monitores y cambio real de foco/escala. Las pruebas de geometría son simuladas; no se han cambiado ajustes del equipo para reproducir la matriz.
2. Pulsación real del atajo desde otra aplicación, micrófono/altavoz físicos, silencio, niveles, interrupción acústica y permisos denegados. Registro del atajo y circuito sintético sí probados.
3. Ejecutar una tarea, pulsar Esc antes de acabar y volver a invocar: observar resultado vigente y bandeja sin reapertura automática. La separación de cancelación está probada con mocks y Esc en UI simulada; falta esta demostración humana completa.
4. Revisión con lector de pantalla y monitores/DPI físicos, cobertura de bordes nativos en Windows 10/11. La revisión de capturas es de navegador; no equivale a aprobar el compositor de Electron en todas esas condiciones.
5. Aprobaciones reales futuras: acción inmutable, destino/efecto, identificador validado y caducidad/deduplicación en main. La UI de simulación no autoriza ninguna operación.

## Vista previa y ejecución

`npm start` inicia oculto; abrir desde bandeja o Ctrl+Alt+Z. `npm run preview:ui` sirve la vista en [localhost](http://127.0.0.1:4173/preview.html?state=completed); no usa la clave. `npm run test:ui` requiere Edge instalado, genera capturas y resultados. Las pruebas API siguen siendo opt-in con ZEN_LIVE_API=1 y clave segura en el entorno.

Fuentes consultadas: [screen de Electron](https://www.electronjs.org/docs/latest/api/screen), [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) y [eventos de audio Realtime](https://developers.openai.com/api/reference/resources/realtime/client-events#output_audio_buffer.clear). La documentación respalda coordenadas/operaciones; no sustituye las pruebas físicas pendientes.

