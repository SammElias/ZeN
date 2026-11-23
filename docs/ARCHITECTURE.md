# Arquitectura de ZEN

**Contraseñas en HUB.** `PasswordVault` guarda una base KeePass KDBX 4 independiente en `passwords.kdbx`, con AES-256, autenticación KDBX y Argon2id (64 MiB, tres iteraciones). `kdbxweb` y `hash-wasm` se empaquetan en main; el renderer recibe metadatos solo con la bóveda desbloqueada y una contraseña únicamente al pulsar el ojo. Las escrituras usan archivo temporal cifrado, flush y sustitución atómica. Bloquear revoca también las operaciones asíncronas pendientes. El auxiliar `Zen.VaultClipboard` recibe la copia por stdin y conserva su temporizador de 30 segundos separado de la ventana. Antes del repliegue nativo se espera un frame sin valores revelados. [Formato KDBX](https://keepass.info/help/kb/kdbx.html).

`Zen.VaultHello` usa el proveedor Microsoft Passport de CNG para las nuevas activaciones y conserva WebAuthn PRF para abrir o revocar configuraciones anteriores. Devuelve a main la clave simétrica una vez verificada la identidad. `VaultHelloBinding` cifra y autentica el componente de contraseña del KDBX en el archivo local de Windows Hello. El proceso nativo usa el HWND de ZEN como propietario del diálogo. El IPC reutiliza la sesión de Contraseñas y la protección de diálogos de la cápsula.

## 01 · Sistema activo ![](assets/violeta.svg)

ZEN es un compañero local de Codex para Windows. Una sola ventana Electron muestra el estado en una cápsula y abre Home, HUB, Calendario, Métricas, Volumen y Configuración en el panel. HUB incluye Contraseñas y Home también abre Codex. Codex conserva la cuenta, los chats y la ejecución. Windows publica las sesiones multimedia. ZEN gestiona la interfaz, las preferencias y la biblioteca local.

Main notifica los cambios de superficie aceptados con un evento semántico. El renderer prepara un `AudioContext` compartido en inactividad y sintetiza cada tono local al primer uso. Los efectos se sustituyen o descartan según el intervalo, y el dispositivo se libera durante la inactividad. Esta salida es independiente de las sesiones multimedia de Windows. [Audio de interfaz](../src/renderer/companion-interface-audio.ts)

El proceso principal se compila con esbuild. El renderer usa React, TypeScript y Vite. El puente usa Zod para validar entradas y el almacenamiento local usa `node:sqlite`. Los auxiliares son proyectos .NET 10. Las versiones se fijan en [package.json](../package.json) y [package-lock.json](../package-lock.json).

## 02 · Límites y responsabilidades ![](assets/azul.svg)

| Límite | Responsabilidad | Fuente |
| --- | --- | --- |
| Renderer | Vistas, navegación, editores y representación del estado. | [Entrada React](../src/renderer/main.tsx) |
| Preload | Expone métodos explícitos de `window.companion` y suscripción al estado. | [Puente](../src/preload/companion.ts) |
| Main | Ventana, bandeja, atajos, estado, visibilidad, diálogos y efectos autorizados. | [Entrada Electron](../src/main/companion-main.ts) · [IPC](../src/main/companion-ipc.ts) |
| Contratos | Esquemas, tipos y reglas de presentación compartidos. | [Contrato del compañero](../src/shared/codex-companion.ts) |
| Auxiliares Windows | El hook transmite eventos, el auxiliar de escritorio observa ventanas y el de medios usa las sesiones de Windows. La compilación también incluye `Zen.Windows`. | [Manifiesto de auxiliares](../config/native-helpers.json) |
| Construcción y pruebas | Bundles, empaquetado portable y recorridos con perfiles de prueba. | [Despliegue](DEPLOYMENT.md) · [Pruebas](TESTING.md) |

```mermaid
flowchart LR
    UI["React: cápsula y panel"] <-->|"API de preload"| IPC["Puente IPC"]
    IPC <-->|"Entradas validadas y estado filtrado"| Main["Electron main"]
    Main -->|"Cola al chat fijado"| Codex["Codex local"]
    Codex -->|"Hooks por pipe local"| Main
    Main -->|"Títulos y resultados de análisis"| History["Índice y sesión de Codex"]
    Main <-->|"SQLite y JSON"| Profile["Perfil de ZEN"]
    Main <-->|"Auxiliares .NET"| Windows["Sesiones multimedia y ventanas"]
    Main -->|"Lectura de métricas diarias"| Oura["Oura Cloud V2"]
```

## 03 · Flujo de datos ![](assets/turquesa.svg)

1. **Petición.** Main comprueba la vista y el destino. Con chat fijado, el CLI ejecuta `queue --thread`. Tras validar el recibo, ZEN solicita a Codex de escritorio que reactive ese mismo chat mediante `codex://threads/wake/<id>`. El enlace contiene solo el identificador. Sin destino, se prepara un borrador en Codex o se copia el texto cuando el enlace supera el límite. El turno se observa por separado.
2. **Actividad de Codex.** Main envía la cronología del supervisor con Actividad visible y recupera los títulos del índice local de solo lectura. La cronología de otros chats muestra nombres de comandos reconocidos. La tarjeta de Permisos recibe los comandos completos que Main correlaciona con el inicio del turno y su carpeta. El hook espera una decisión de un uso. **Abrir en Codex** libera la espera sin decidir y abre el chat exacto. El análisis del chat fijado conserva su referencia de correlación.
3. **Sonido.** Un observador lee automáticamente la sesión en reproducción o en pausa que publica Windows. Un controlador separado actúa sobre la sesión seleccionada con un gesto explícito desde Sonido. Otro canal del mismo auxiliar usa Core Audio para consultar y ajustar el volumen de la salida predeterminada, incluso sin una sesión multimedia. Al ocultar el panel se detienen las consultas y se conserva la selección. Ocultar no envía órdenes al reproductor.
4. **HUB.** La biblioteca se lee y escribe en el perfil local. Desde Home se accede al HUB con su píldora. El [IPC del HUB](../src/main/companion-notes-ipc.ts) gestiona la vista y sus archivos. El [IPC de respaldo](../src/main/companion-backup-ipc.ts) gestiona desde Preferencias la copia portable de la biblioteca y de los ajustes.

**Apuntes rápidos.** La hoja guarda su texto, selección y scroll en una fila de `hub_state` dentro de `knowledge-hub.sqlite`. Su IPC valida el origen y la vista activa y confirma la transacción local antes de devolver el control al editor. La fila queda fuera del índice, de los apuntes recientes y de los respaldos de la biblioteca, y se conserva al restaurarlos.

**Pizarra.** El SQLite de HUB conserva una sola hoja con el color, el grosor y las operaciones de pincel y goma. Las coordenadas parten de la hoja original de 960 × 640 y se extienden con el área disponible. Las operaciones nuevas guardan los límites visibles al dibujar y las anteriores conservan los de la hoja original. Main valida el documento antes de guardarlo. El renderer repinta las operaciones en orden con la paleta activa y una escala uniforme. Deshacer elimina la última operación. Cada gesto terminado se guarda en una transacción local.

Templates usa registros separados en el mismo SQLite. La lista devuelve metadatos ligeros y el detalle carga los prompts de las plataformas disponibles cuando se abre. Las referencias se guardan con su original y una miniatura, y se sirven bajo demanda por el protocolo local mientras HUB está visible. La versión de la colección permite sustituir una sola vez los ejemplos editoriales por los empresariales. La ampliación agrega las 23 fichas nuevas una sola vez y conserva las ediciones, favoritos y borradores. La marca de versión evita reinsertar ejemplos borrados. La migración reconoce los identificadores originales y conserva las plantillas personales. El respaldo incluye ambos tipos de registros y sus borradores en la copia completa. [Almacenamiento de Templates](../src/main/knowledge-templates.ts)

**Descubrimiento de apps** guarda fichas bilingües en el SQLite de HUB y las incluye en el respaldo. El renderer construye la propuesta inicial con reglas locales y prepara una petición separada del borrador normal de Inicio. El envío pasa por el mismo IPC y la misma comprobación de destino que las demás peticiones de Inicio.

**Officina** usa el selector y la geometría de la cápsula. Main conserva cada tablero, objetivo y cola en `officina.sqlite`. El Chat global crea un proyecto con `project/create` y registra los cinco chats de puesto y Coordinación con `thread/start`. Usa una clave de creación estable, guarda cada confirmación y puede continuar una preparación parcial. Si al despachar falta un chat dedicado, comprueba el índice y el App Server antes de reemplazar la referencia de ese puesto. Los vínculos manuales anteriores siguen disponibles. El botón **Abrir carpeta en Codex** apunta a la raíz guardada del proyecto mediante el enlace de escritorio. La barra lateral de Codex gestiona su propia lista de carpetas.

El puente pone cada turno en cola. Cuando el usuario pide su navegador habitual, el turno del puesto incluye la mención de la extensión. Una revisión clara de pestañas abiertas se asigna directamente al Analista. Coordinación planifica los demás objetivos y verifica los resultados. El lector local comprueba la respuesta final, la carpeta, la ejecución, la tarea y el puesto. Main guarda juntos los resultados y las nuevas asignaciones. Tras reiniciar, la lectura puede confirmar un envío anterior. La cola vuelve a activarse mediante una acción explícita. [Servicio de Officina](../src/main/companion-officina.ts)

Para mostrar un trabajo en curso, Main verifica en el registro local el mensaje aceptado del turno con la identidad completa del encargo. Si el circuito de permisos indica una solicitud del mismo chat, carpeta y turno, Officina muestra la espera de permiso. La proyección para el proyecto visible queda en memoria y contiene el identificador del encargo, el estado y la hora. La interfaz combina esa señal con los planes, las respuestas y los bloqueos del tablero.

Las respuestas de equipo y Coordinación pueden incluir un resumen para el seguimiento y un cuerpo Markdown para el usuario. Main guarda ambos y mantiene acotado el contexto que envía al siguiente turno. Una respuesta ya registrada en Codex con el texto completo en el campo anterior se puede recuperar al volver a revisar la cola.

Al elegir una carpeta, Main la usa como raíz del proyecto de Codex, `cwd` y raíz de ejecución de los chats del equipo. Una carpeta que ya tiene proyecto se reutiliza. Los archivos seleccionados se guardan como referencias del encargo y pasan a los turnos de su equipo en el contexto de la petición. Codex lee las fuentes con sus herramientas locales. Main comprueba la identidad de las rutas antes de crear el equipo y antes del envío.

Una conclusión cierra el objetivo y omite los turnos que todavía estaban en cola para esa tarea. Cuando el último turno guardado de un objetivo antiguo terminó con una limitación confirmada y ya no tiene trabajo en curso ni en cola, la lectura lo proyecta como cerrado con limitaciones. La siguiente escritura normal guarda el estado de cierre y mantiene el registro original del turno y de su respuesta.

**Métricas.** Main abre la autorización de Oura en el navegador del sistema y recibe el retorno de un solo uso en loopback. Si el retorno válido no enumera `daily`, Main comprueba el acceso al recurso de sueño diario con Oura Cloud antes de guardar la sesión. Guarda las series diarias y sus horas de consulta. El panel de Métricas recibe las series mientras está visible. Home recibe solo la última medición de sueño de la caché. La cápsula recibe la duración y el día del último sueño si se eligió esa opción.

**Clima.** Main consulta las condiciones actuales y la previsión de tres horas de OpenWeather con la clave cifrada de cada instalación. Agrupa los tramos por fecha local de la ciudad y conserva el último resultado en memoria si la consulta falla. Home usa ese resumen y solicita novedades como máximo cada quince minutos en condiciones normales. [Cliente OpenWeather](../src/main/openweather-api.ts)

**Traductor.** [El cliente de Azure en main](../src/main/companion-translator.ts) usa el endpoint Global de traducción de texto v3 y conserva la clave cifrada en `companion-translator.bin`. El IPC admite español e inglés y limita cada texto a 5000 caracteres. El panel de HUB mantiene el texto y el resultado durante la visita a Traductor.

## 04 · Persistencia y decisiones ![](assets/verde.svg)

| Datos | Almacenamiento y propiedad |
| --- | --- |
| Apuntes, prompts y borradores | `knowledge-hub.sqlite` en el perfil ZEN. [HUB](../src/main/knowledge-hub.ts) contempla la biblioteca anterior en JSON. |
| Preferencias y aspecto | JSON local y fondo normalizado. La posición se guarda por monitor. El respaldo portable reúne solo los datos descritos en [Despliegue](DEPLOYMENT.md). |
| Última respuesta | Índice SQLite y sesión JSONL de Codex, de solo lectura para ZEN. |
| Actividad, avisos y revisiones | Estado acotado de la sesión en memoria. |
| Oura | Client ID, sesión y caché en `companion-oura.bin`, cifrados con el almacén de Windows. El Client ID se guarda al iniciar la autorización. |

**Perfil entre equipos.** Main reutiliza el formato portable para extraer datos guardados y aplica los cambios con recuperación local. Cada equipo escribe su propio archivo cifrado en una carpeta de Syncthing. Las revisiones por objeto conservan el contexto de la última versión aplicada para distinguir cambios sucesivos de ediciones simultáneas. Solo se aplican al perfil local los grupos que cambiaron. La bóveda tiene un flujo separado de copias KDBX cifradas que se combinan al desbloquear.

La autoridad sobre los efectos queda en main. Una ventana contiene una cápsula pequeña y un panel opcional. Las operaciones de navegación convergen en abrir, cambiar u ocultar el panel. Los comandos antiguos de presentación se adaptan a estas operaciones. Los estados guardados de cápsula y Workspace conservan su presentación y añaden la sección visible.

La geometría de [cápsula y panel](../src/main/companion-capsule-layout.ts) calcula sus rectángulos y la unión de sus regiones interactivas. La cápsula conserva su tamaño. El panel aprovecha el espacio interior y el redimensionado nativo. El fondo de las zonas excluidas deja pasar clics. El candado controla el arrastre y la apertura por cursor en Windows. Siempre encima conserva su propia preferencia.

Cuando llega una solicitud, Main abre Permisos en la misma ventana con prioridad temporal, conservando el foco anterior. Al resolver, cerrar o cambiar de sección, Main devuelve la prioridad a la preferencia guardada. La apertura automática se aplaza durante los diálogos y arrastres de ZEN.

En el renderer, `workspace-surface` contiene la escena y su capa de cristal, y `workspace-content` conserva el scroll y el foco. El movimiento se aplica al contenido mientras la escena, el cristal y el contorno mantienen su opacidad. Las vistas comparten el fondo. El tema específico de HUB queda limitado al lector, con la misma preferencia persistida.

En Windows, `companion-hover` mide la permanencia en cada icono de Apps y el tiempo fuera de la región que comparten la cápsula y el panel. El renderer identifica el icono y comunica las interacciones que aplazan el temporizador. Main valida la sección, la posición del cursor y el candado antes de actuar mediante la navegación existente. Las dos presentaciones comparten el área de dibujo de la ventana. El recorte deja visible la cápsula hasta que el compositor prepara el panel. Al hacer clic se activa la ventana y se habilitan sus controles nativos.

La [transición del panel](../src/main/companion-panel-transition.ts) coordina la espera de pintado, el progreso del recorte y su cancelación. Main aporta la captura de Electron y aplica la geometría nativa. Al abrir, la región se amplía desde la cápsula una vez dibujado el panel. Al replegar, se reduce hacia el mismo borde y el escritorio queda accesible en la parte descubierta. El área original sigue contando para detectar el regreso del cursor y revertir el repliegue.

El menú y las animaciones derivan el orden visible de la misma [regla de navegación](../src/shared/companion-navigation.ts). Con el panel abierto, el cambio desde Apps usa las capturas saliente y entrante como caras del cubo y conserva el estado de la sección. Si llega otro destino, se prioriza esa selección.

La X minimiza la ventana de ZEN y la conserva en la barra de tareas. Al restaurar vuelven la misma vista y el borrador de Inicio mantenido en memoria. Al minimizar, main sigue revocando el contexto de revisión y los accesos que requieren una vista visible. **Salir de ZEN** ejecuta el cierre de Electron y libera el bloqueo de instancia.

Codex ejecuta las consultas de Gmail y Calendar mediante las conexiones configuradas allí. El arranque activo usa el compañero de Codex y el repositorio conserva implementaciones históricas fuera de ese flujo.

## 05 · Dependencias y límites ![](assets/ambar.svg)

El envío directo depende de `queue` en el CLI y de la reactivación de la cola en Codex de escritorio. La lectura del último mensaje depende del formato local de Codex. El reproductor solo puede mostrar y controlar lo que exponga Windows. Ante una entrega incierta o un fallo de reactivación, revisa la cola del chat antes de reenviar. Los límites de acceso se detallan en [Seguridad](SECURITY.md).


## 06 · Calendario

[Calendario](../src/main/companion-calendar.ts) conserva eventos locales y una copia validada de los resultados remotos en `companion-calendar.json`. Su IPC exige Calendario visible, sin Pausa ni Presentación. Las peticiones usan exclusivamente la cola de Codex del chat fijado. Las respuestas llegan por el hook o por el lector existente mientras hay una solicitud pendiente.

El contrato `zen_calendar` liga respuesta, cuenta, calendario, intervalo y solicitud. La cobertura completa permite conciliar ausencias dentro del intervalo. Los resultados parciales se fusionan y una consulta selectiva conserva la cobertura de los otros calendarios. Las creaciones externas conservan un recibo local para evitar repetir una operación incierta después de reiniciar. Elegir explícitamente **Solo en ZEN** permite guardar una copia local mientras sigue pendiente la confirmación externa. El respaldo portable incluye los eventos locales.
