# ZEN · isla compacta v1

Primera versión a petición del usuario: información lo más compacta posible, inspirada en el patrón de isla superior de Coucou. La isla se dedica a contexto de ejecución y actividad del agente en stream. Las preferencias quedan fuera, en una ventana separada que se abre explícitamente desde la bandeja de Windows.

## Implementado

- Inicio como isla recogida de 320×48 DIP mediante `showInactive`, anclada al centro del borde superior del área útil del monitor. Sin arrastre y sin abrir escucha automáticamente. Respeta la barra de tareas de Windows. Símbolo Z propio con respiración suave; no utiliza recursos del personaje de Coucou.
- Despliegue hacia abajo: 560 DIP de ancho, entrada breve de 250 DIP de alto y vistas de ejecución normalmente de 330 DIP, con espacio adicional para fichas de tareas. Contexto/Tareas usan hasta 600 DIP de ancho; las alturas se limitan a la pantalla. El estado recogido muestra actividad, micrófono y acceso para abrir; Detener está disponible cuando hay trabajo activo.
- Actividad, Tareas y Contexto. Sin ajustes de conexión, modelos, límites, perfil o prioridad en la isla. El contexto permite elegir una ventana, revisar su texto/captura y adjuntarlo a la siguiente petición, o autorizar una carpeta de destino para preparar una creación solicitada al agente.
- Fichas de hasta cinco tareas recientes, conservando la seleccionada cuando otra recibe actualizaciones. Tareas permite consultar las restantes, continuar o cancelar una tarea concreta. La petición original se puede desplegar como contexto; los resultados largos ofrecen lectura completa bajo demanda.
- Comentarios públicos y texto del campo raíz `result` del agente durante el stream. El texto en curso se identifica como provisional; completar requiere el evento de turno completado y la validación final existente. Campos de razonamiento, acciones narrativas y JSON bruto no se transmiten a esta vista. Resultados estructurados como objetos/colecciones se presentan al finalizar, sin convertirlos en órdenes ejecutables.
- Seguimiento del stream al final del contenido, que se pausa si el usuario se desplaza hacia arriba. Actualizaciones de texto en curso limitadas y transitorias; no se escribe cada fragmento en el historial local. El resultado final conserva su texto completo.
- Preferencias independientes con origen IPC y operaciones permitidas acotadas. La ventana no puede iniciar tareas, escuchar ni cambiar la geometría de la isla. Configuración DPAPI, perfil y agente guardado existentes conservados. La isla actualiza su configuración pública al recuperar foco.
- Voz, push-to-talk, modo reunión, aprobaciones concretas, cancelación, operaciones Windows y trabajo en segundo plano conservados. Recoger mantiene voz/tareas; Esc oculta y desconecta voz sin cancelar investigación. Bandeja y atajo permiten volver a abrir.

## Probado

- Tipos y compilación; **126 pruebas unitarias en 13 archivos**. Cubren anclaje superior y pantallas pequeñas, extracción incremental de `result` con escapes, exclusión de campos privados/narrativos, eventos de stream públicos, conservación transitoria y los contratos/políticas existentes.
- **Edge headless**: vistas compacta y desplegada, ausencia de configuración en la isla, navegación, permisos simulados de un uso, selección de tareas durante el stream, lectura completa, seguimiento del texto y pausa al desplazarse manualmente, Detener desde compacto, Enter/Shift+Enter, Esc sin Stop, perfil en vista separada, reducción de movimiento, pantalla pequeña y ausencia de errores JavaScript. [Informe](evidence/island-ui.json). Capturas revisadas: [recogida](ui-preview/topbar.png), [entrada](ui-preview/idle.png), [stream simulado](ui-preview/island-streaming.png), [permiso simulado](ui-preview/awaiting_approval.png).
- **OpenAI real** con la clave de pruebas ya autorizada: una petición informativa, nueve actualizaciones públicas recibidas antes de completarse, respuesta final estructurada válida. Sin cambios de configuración ni efectos Windows. No se imprime la clave ni el razonamiento. [Informe](evidence/island-stream-live.json).
- **Electron/Windows real**: inicio compacto, 320×48 DIP, expansión 560×260 DIP y mismo borde superior, ventana no movible, preferencias con lectura de configuración e IPC de ejecución bloqueado, aislamiento de Node, DPAPI ficticio y bandeja. Siguen pasando abrir página/archivo/Notepad, revisar/aprobar una creación concreta, impedir repetir aprobación, texto en reunión y aviso autorizado sin tomar foco. [Informe del paquete](evidence/island-electron.json).
- **Paquete portable ejecutado**, con comprobaciones de inicio compacto, preferencias aisladas y funcionamiento anterior. Ruta final: `release/ZEN-20260930172605727/ZEN.exe`. [Ruta y hashes](evidence/portable-package.json). No incluye claves ni datos personales; requiere .NET Desktop Runtime 10.

## Pendiente de comprobación física

Confort diario, micrófono/altavoz y una llamada real, monitores/DPI físicos y gestos del sistema. El atajo del proceso de prueba estaba ocupado por otra instancia de ZEN; estas pruebas no acreditan su activación física. Inicio por acercar el puntero y retracción automática al borde no forman parte de esta primera versión. La reducción de movimiento desactiva las animaciones.

Para probar: cerrar la instancia anterior desde la bandeja → Salir, ejecutar el nuevo ZEN.exe desde su carpeta completa y pulsar sobre la isla para abrir. La vista web es una simulación y no ejecuta operaciones reales.

Esta entrega completa la revisión compacta solicitada. Los pendientes del objetivo funcional general y el orden de GPT-Live siguen en [objective-verification.md](objective-verification.md) y [handoffs/order.md](handoffs/order.md). Referencia consultada: [coucou-reference.md](coucou-reference.md); implementación y recursos propios de ZEN.
