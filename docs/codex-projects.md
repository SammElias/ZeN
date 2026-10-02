# Proyectos y carpetas con Codex · 01/10/2026

## Uso e interfaz

Di «Crea un proyecto sencillo llamado …» o «Crea una carpeta para …». Silencia el micrófono o suelta pulsar para hablar, pulsa **Preparar con Codex**, revisa tu petición literal y elige **Preparar mi proyecto**. La revisión anterior sigue siendo necesaria para sellar una transcripción exacta; una pausa de voz no concede permisos. No se cambia el JSON de Live ni se añaden funciones locales a su sesión automática.

La cápsula muestra **ZEN → Codex**, «Dando forma a tu idea», «Listo para revisar» y «Guardando tu proyecto». **Volver a ZEN / Ver proyecto** cambia el contexto sin abrir otro chat ni mostrar configuración. Una nueva intervención tuya vuelve a la conversación; la propuesta queda disponible. Se conserva únicamente el último mensaje hablado y las transcripciones literales.

Codex prepara una tarjeta con nombre, resumen, carpetas y archivos. Puedes inspeccionar los contenidos antes de elegir ubicación. **Elegir ubicación** abre el selector de Windows; el panel presenta la ruta final. **Crear aquí** autoriza exactamente esa propuesta y destino, una sola vez. Cambiar ubicación invalida la aprobación anterior. Puedes descartarla sin escribir nada. La revisión utiliza dos columnas en panel ancho, una columna y acciones accesibles en pantallas pequeñas, animaciones discretas y respeto del movimiento reducido.

## Implementado

- Ruta de creación reconocida exclusivamente desde la petición humana original: proyectos, carpetas/directorios y estructuras de carpetas. Consultas de consejos, resúmenes, imágenes y archivos sueltos conservan sus rutas anteriores. Pantallas, documentos y la narrativa de un modelo no pueden iniciar el flujo.
- Codex mediante el **harness de Agents API**, en una sesión separada con gpt-6.1-sol y entorno `openai_hosted`, tamaño small, red deshabilitada y sin subagentes. Se crea y verifica el proyecto remoto, después se descarga el artefacto inmutable `/workspace/outputs/zen-project.json` del turno completado. No se etiqueta como terminado un stream cortado ni un artefacto de otro turno.
- Esta integración se ejecuta dentro de ZEN usando la API del proyecto. No crea un chat en la barra lateral de la aplicación Codex ni requiere mover al usuario entre aplicaciones. El CLI local está disponible, pero no se utiliza para ejecutar código generado en el PC. Se conservan intactos el agente guardado ZeN y `config/live-session.json`.
- La referencia visual temporal, si existe, se pasa al constructor como datos no confiables. No se sube ni monta una carpeta completa, ni se comparten claves con el sandbox.
- Un coordinador para cancelación/deduplicación. La preparación remota es una tarea informativa; el guardado local utiliza la cola de efectos Windows existente. Ocultar mantiene la preparación; Detener cancela nuevas operaciones y descarta propuestas locales pendientes. No repite automáticamente entradas o escrituras tras fallos.
- Propuesta de texto validada en main: raíz nueva, rutas relativas Windows, sin traversal, ADS, nombres reservados, colisiones de mayúsculas, binarios ni ejecutables. Máximo 50 archivos, 80 directorios, ocho niveles y 2 MB. Solo se exportan bytes UTF-8, sin ejecutar ni instalar el contenido en Windows.
- Propuesta en RAM, hasta tres pendientes y caducidad de treinta minutos. Renderer recibe metadatos; los contenidos se solicitan explícitamente para inspección. Reiniciar invalida propuestas y permisos anteriores, sin recrearlas automáticamente. No se guardan contenidos generados en logs o historial de tareas.
- Exportación a una carpeta raíz nueva en el destino seleccionado. No sobrescribe proyectos existentes. Cada archivo se verifica con SHA-256; comprueba que las rutas sigan dentro del destino. Cancelación o fallo tras una escritura conserva los elementos ya creados y declara creación incompleta: no borra ni repite automáticamente.
- La herramienta previa `prepare_folder` y la preparación manual de carpetas redirigen con un mensaje al flujo Codex. Las definiciones remotas de herramientas no se modifican. Los archivos sueltos de texto mantienen su aprobación anterior.
- Descarga el resultado antes de pedir borrar la sesión alojada. El registro indica si la limpieza se confirmó; un fallo de limpieza requiere revisión y puede dejar recursos remotos pendientes. Las estimaciones habituales cubren tokens; no son una factura completa de costes del sandbox.

## Probado

- **218 pruebas en 23 archivos y build.** Clasificación de petición original, aislamiento de preparación frente al agente guardado, referencia visual conservada, rutas y colisiones, propuesta sin escritura, aprobación exacta de un uso, no sobrescritura, cancelación durante verificación, fallo de stream, artefacto ajeno bloqueado y limpieza.
- [API real](evidence/codex-project-live.json): Codex preparó `ZEN-Codex-fixture`, carpetas docs/src y README solicitado, contenido verificado, exportación a una carpeta temporal propia de Windows y sesión remota eliminada. Sin carpetas personales subidas ni ejecutable generado.
- [Electron/Windows](evidence/codex-project-electron.json): IPC real de destino y aprobación, escritura de archivo JS sintético sin ejecutarlo, contenido verificado, repetición bloqueada y propuesta desconocida rechazada. Mantiene aislamiento, DPAPI, biblioteca local y anclaje. Se corrigió la espera del smoke para medir la anchura final después de la animación; una medición intermedia dio 641 en vez de 640 DIP y no se consideró prueba aprobada.
- [Interfaz Edge](evidence/codex-project-ui.json): cambio ZEN/Codex, contenidos previos, destino visible, aprobación identificada, vuelta automática a la conversación con nueva voz, propuesta conservada al volver y pantalla de 320 px. Inspección visual de capturas, sin ejecutar efectos desde la simulación.

## Pendiente y límites

Probar manualmente el recorrido con tu voz y tus proyectos. La API real cubre un proyecto sintético pequeño; no acredita cualquier aplicación compleja. Esta entrega prepara **proyectos nuevos de texto**, sin instalar dependencias de Internet. Modificación de proyectos existentes, binarios, ejecución local, commits/push y publicación necesitan un flujo propio. Peticiones mixtas con otros efectos Windows no quedan ejecutadas por el constructor.

El usuario autorizó después compilar: el portable `release/ZEN-20261001092421154/ZEN.exe` ya incorpora este cambio y pasó la comprobación real de arranque/interfaz, incluidos IPC de proyectos y aprobación de un uso. [Evidencia](evidence/portable-interface.json). Los portables anteriores no incorporan este cambio. El objetivo general permanece incompleto por los pendientes y fallos de foco registrados anteriormente.

Contrato comprobado con el SDK instalado y OpenAI Docs: [arquitectura del harness Codex](https://developers.openai.com/api/docs/guides/agents-api/architecture), [entornos alojados](https://developers.openai.com/api/docs/guides/agents-api/environments/openai-hosted), [artefactos por turno](https://developers.openai.com/api/docs/guides/agents-api/environments/files).

## Análisis de carpetas existentes

Por petición posterior del 01/10/2026, seleccionar una carpeta para analizar abre Codex del escritorio y prepara su compositor; no usa este harness ni el agente ZEN para leer/analizar los archivos. El envío sigue dentro de Codex. Aprobaciones de ZEN disponibles también por código de voz/chat. [Flujo actual y verificación](codex-desktop-folders.md).
