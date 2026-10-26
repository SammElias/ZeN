# Integración compacta con el chat real de Codex

ZEN conserva la cápsula de 760×56 DIP y los cuatro accesos de navegación. No añade un chat, una bandeja de tareas ni ventanas de integración.

## Flujo

- Gmail conserva su revisión exacta y añade **Proponer cita**. Análisis, resumen, tareas, respuesta y propuesta de cita llevan un identificador distinto. Tras copiar y abrir el chat fijado, el usuario pega y envía en Codex.
- El resultado completo coincidente vuelve automáticamente al correo visible. Las respuestas se pueden editar y copiar. Actualizar no sobrescribe una edición; otra propuesta requiere el botón explícito de sustitución. No se envían correos, guardan borradores ni crean eventos desde ZEN.
- Codex ofrece un solo acceso plegado **Analizar**: archivo, página o texto. No añade una selección fija de proyecto, aplicación o entorno Power Platform. La indicación del usuario determina el destino; Codex pide los datos necesarios cuando falten. Los errores o exportaciones de flujos se analizan mediante este mismo acceso.
- Archivo elegido en el diálogo nativo, hasta 32 MB, regular y con identidad verificada. ZEN transmite la ruta revisada y SHA256, sin adjuntar su contenido. Comprueba la versión al revisar, copiar y recuperar el resultado. Un cambio obliga a seleccionar de nuevo; no atribuye una respuesta a una versión diferente.
- Página y texto se aportan explícitamente. ZEN no inspecciona pestañas, cookies, DOM ni pantallas. Se conserva el límite previo de Computer Use. El acceso de Codex al navegador sigue usando sus herramientas autorizadas.

## Sincronización y autoridad

La devolución usa respuestas finales recibidas por los hooks existentes del chat/carpeta fijados y una recuperación local de solo lectura mientras el origen esté visible. Un resultado observado por hook se retiene en RAM para su petición aunque llegue después otra respuesta. No atribuye a una petición un turno por proximidad temporal, por copiarla, por un Stop sin texto o por el estado global de Codex.

Cada revisión dura dos minutos y se consume antes de efectos o esperas. No se reenvía ni reintenta trabajo al recuperar conexión, navegar o restaurar. Las asociaciones tienen treinta minutos; Gmail admite ocho y el acceso de contexto una. Coincidencia exacta de marcador, texto final no truncado, chat, carpeta, cuenta y contenido de origen. Respuestas ajenas o incompletas siguen pendientes, nunca se presentan como éxito.

Los hooks ya proporcionados pueden retener únicamente el bloque de una petición autorizada en RAM cuando su integración está cerrada; no se leen correos ni archivos ocultos para ello. La devolución revalida el origen visible antes de IPC. Pausa/Presentación/Salir retiran asociaciones y texto privado. Los resultados no entran en estado global, avisos, disco, logs o portapapeles sin la acción de copiar. Los cambios de sección/visibilidad invalidan revisiones y descartan lecturas tardías. Sondeos locales de cuatro segundos solo mientras se espera un resultado visible, sin llamadas a modelos/proveedores; se detienen al obtenerlo.

## Límites reales

Se probó en modo lectura el comando público `app-server proxy` del binario que usa el escritorio. La conexión al socket falló en esta instalación Windows antes de inicializar. No se reanudó una copia del chat ni se modificaron los argumentos/configuración de Codex. Por tanto, **copiar, pegar y enviar en el chat sigue siendo el paso de ejecución**; no se afirma un envío directo disponible.

Calendario usa una propuesta revisable: creación, disponibilidad o cambios se solicitan después al chat con su conexión de calendario y confirmación concreta. ZEN no toma tokens del conector ni amplía OAuth Gmail. Power Platform no se configura en ZEN ni recibe un entorno inventado; sus operaciones continúan en Codex donde el usuario indique.

No se instalan hooks, cambian confianza/configuración MCP, detiene Codex, leen correos reales o envían peticiones de modelos para probar esta entrega. La recepción genuina de producción sigue acreditada por la entrega anterior; los casos de correlación nuevos se validan con eventos aislados, no se presentan como un encargo real completado por Codex.

## Verificación y entrega

Pruebas de dominios y recorrido Electron aislado: correlación, caché acotada, respuesta ajena, fechas/cuenta cambiadas, lecturas concurrentes/tardías, versión real de archivo, doble clic, revisión inmutable, cambios de destino, privacidad, retorno automático y conservación de ediciones. El recorrido conserva las comprobaciones previas de permisos, OAuth, papelera, visor, música, geometría y navegación. Evidencia final local en `docs/evidence/codex-sync-deployment.json`; cuenta exacta de pruebas y hash del EXE en ese recibo.

La entrega es únicamente Desktop/ZEN.exe, con respaldo en release. Los límites físicos, DPI, reproducción y correo reales permanecen sin nueva acreditación. Sin commit/push.

Entrega validada: **757 pruebas en 65 archivos**, recorridos Electron y EXE extraído con salida cero. SHA256 Desktop/ZEN.exe: `A9388994901FAD26EC0C08EE2AE78078F72DEA169FA5350584F46AC3CAF2457C`. Arranque normal y observador único comprobados; cuentas/preferencias, hooks/confianza/relay e históricos conservados.
