# Seguridad y privacidad

[Diagramas de arquitectura y Officina](diagrams/index.html)

**Bóveda de Contraseñas.** `passwords.kdbx` se abre con la contraseña maestra. Todo el contenido, incluidos proyectos, servicios y usuarios, queda cifrado. Una clave errónea o un archivo dañado nunca inicia una bóveda nueva sobre la anterior. Se abre bloqueada desde **HUB → Contraseñas**. La sesión se revoca al cambiar de sección, replegar, minimizar, ocultar, cerrar, suspender, activar Pausa/Presentación o recibir `lock-screen`. El candado de posición no desbloquea ni conserva abierta la bóveda. Perder foco oculta lo revelado. El ojo tiene un máximo de diez segundos y una sola cuenta visible. Las transiciones eliminan primero el valor saliente.

**Windows Hello.** El usuario puede activarlo desde una bóveda abierta tras verificar de nuevo la contraseña maestra. El archivo local `passwords-hello.json` contiene el componente de contraseña de KDBX cifrado con AES-256-GCM y los parámetros necesarios para abrirlo en ese equipo. Para nuevas activaciones, la clave AES es aleatoria y se envuelve con una clave RSA local no exportable del proveedor Microsoft Passport. El auxiliar comprueba la política de verificación obligatoria de la clave y rechaza claves que permitan descifrado silencioso. Las activaciones anteriores basadas en WebAuthn PRF siguen abriendo con su credencial original. Main controla la operación y cancela o rechaza resultados tardíos al bloquear la bóveda. La contraseña maestra sigue sirviendo para abrir el KDBX en cualquier equipo. [Almacenamiento de claves CNG](https://learn.microsoft.com/en-us/windows/win32/seccng/cng-key-storage-functions) · [Extensión PRF](https://www.w3.org/TR/webauthn-3/#prf-extension).

Las credenciales no entran en SQLite de HUB, recientes, prompts, estado global, logs ni telemetría. El respaldo general y el de HUB excluyen la bóveda. Para respaldarla, copiar únicamente su archivo cifrado estando bloqueada. Los errores de la bóveda son propios y no incluyen valores ni detalles de la biblioteca. No se promete borrado verificable de todas las copias de strings en memoria administrada; el desbloqueo y el uso del portapapeles presuponen una sesión Windows confiable.

El auxiliar de portapapeles registra `ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory=0` y `CanUploadToCloudClipboard=0` antes de publicar texto, bajo la misma apertura exclusiva del portapapeles. No existe fallback a una copia sin esas marcas. Registra el número de secuencia después de cerrar el portapapeles, cuando Windows ya ha materializado los formatos derivados. A los treinta segundos comprueba la secuencia y la ventana propietaria bajo bloqueo y vacía solo su propia copia, aunque ZEN se haya replegado o cerrado. Una copia posterior, incluso con texto idéntico, se conserva. [Formatos de Windows](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats).

## 01 · Autoridad e identidad ![](assets/violeta.svg)

El usuario inicia sesión en Codex, que conserva la identidad y aplica sus permisos. ZEN trabaja con el chat local observado o fijado según la operación. La integración instala hooks tras una acción explícita y su confianza se revisa en Codex. Una decisión de permiso está ligada al evento pendiente, se consume una vez y vuelve a Codex si pierde vigencia o conexión.

La tarjeta automática se abre solo en el escritorio desbloqueado y fuera de Pausa y Presentación. Mantiene el foco en la aplicación activa. Cerrar la vista devuelve la prioridad normal y mantiene pendiente cualquier solicitud que siga vigente.

## 02 · Límites de IPC y ejecución ![](assets/azul.svg)

- Renderer con sandbox, aislamiento de contexto, seguridad web y Node deshabilitado. Main verifica emisor, frame principal, URL local y esquema antes de autorizar cada acción. [IPC](../src/main/companion-ipc.ts)
- El permiso de pantalla completa requiere el frame principal de ZEN y la vista de Officina visible en el escritorio desbloqueado, fuera de Pausa y Presentación. Chromium exige un gesto del usuario para entrar.
- El renderer invoca métodos cerrados de preload. El CLI y los auxiliares reciben argumentos definidos por main. Texto, Markdown y eventos externos se tratan como datos.
- La solicitud de análisis se revisa antes del envío, caduca a los dos minutos y es de un uso. La selección de archivo pasa por diálogo nativo, límites de tamaño e identidad. La huella se revalida antes de utilizar el archivo. [Contexto](../src/main/companion-context.ts)
- La observación multimedia es de lectura. Los controles de reproducción exigen una sesión válida y una acción explícita del usuario. El ajuste del volumen general exige Sonido visible y ZEN enfocado. El auxiliar comprueba que la salida predeterminada siga siendo la que muestra el deslizador antes de escribir el nivel.

## 03 · Secretos y conexiones ![](assets/ambar.svg)

Clima guarda la clave de OpenWeather, la ciudad y la última previsión en un archivo cifrado mediante `safeStorage` del perfil local. La clave se usa en main para consultas HTTPS al proveedor. El estado de Clima devuelve ciudad y pronóstico. Al salir de Home o activar Pausa o Presentación se cancela la consulta. El respaldo portable excluye ese archivo cifrado.

El resumen diario se genera localmente. Main entrega a Home visible solo el saludo, el consejo y los campos de agenda necesarios para la vista. Pausa y Presentación ocultan el resumen. La caché guarda texto y una huella, sin títulos, descripciones ni identificadores de eventos. Los datos del resumen quedan fuera de Codex, los diagnósticos y las copias portables.

Traductor guarda la clave de Azure en el perfil local con `safeStorage`. Main acepta traducciones con HUB visible y fuera de Pausa y Presentación. La petición HTTPS envía solo el texto introducido al endpoint Global de Azure al pulsar Traducir. ZEN cancela la consulta al salir y excluye la clave y los textos de los diagnósticos, las peticiones de Codex y los respaldos.

El pipe local usa un token guardado en el perfil de ZEN. Se excluye de repositorio, respaldos portables y diagnósticos compartidos. La cuenta, configuración y conexiones de Gmail y Calendar se gestionan en Codex. El flujo activo de ZEN funciona sin claves de modelos o de Google. `CODEX_HOME` selecciona una ruta local.

## 04 · Protección de datos ![](assets/rosa.svg)

| Superficie | Límite |
| --- | --- |
| Actividad de Codex | Main entrega el detalle del chat fijado con Actividad o Permisos visible y fuera de Pausa y Presentación. En otros chats, la cronología expone estados y nombres reconocidos. El comando completo de una solicitud de otro chat se entrega solo a Permisos visible si el hook identifica el mismo chat, turno y carpeta observados al inicio. Main valida estos datos de nuevo al resolver. Una solicitud sin detalle suficiente sigue su flujo en Codex. Los avisos son genéricos. El índice SQLite y el historial JSONL se consultan en modo de lectura para títulos y resultados correlacionados. |
| Pausa y Presentación | Ocultan detalles y bloquean efectos sensibles según la vista. Se revalida tras esperas y cambios de contexto. |
| Apuntes y fondos | Inicio recibe metadatos de notas. Los archivos se eligen con diálogos, y las imágenes se validan. El protocolo de tema sirve solo el fondo vigente. |
| Apuntes rápidos | La hoja se guarda en texto sin cifrar en el SQLite local. Su IPC requiere HUB visible y desactivar Pausa y Presentación. La hoja queda fuera de las peticiones de Codex, los diagnósticos y las copias exportadas. |
| Pizarra | El dibujo se guarda en el SQLite local sin cifrar. Su IPC aplica las mismas restricciones de vista y privacidad de HUB. El dibujo queda fuera de Codex, diagnósticos y exportaciones, y persiste al restaurar una copia de la biblioteca. |
| Descubrimiento de apps | Las respuestas se guardan en el perfil y forman parte del respaldo de HUB. La propuesta se genera localmente. Valorar en Codex prepara texto editable en Inicio, con revisión del chat y envío explícito. Pausa y Presentación aplican las mismas restricciones de HUB e Inicio. |
| Officina | Main requiere la vista visible, el escritorio desbloqueado y desactivar Pausa y Presentación. Comprueba el proyecto, el chat del puesto y su carpeta antes de despachar. El tablero se guarda en SQLite local fuera del estado global y de las copias portables. La respuesta se valida como datos de una tarea y ejecución concretas. Los chats nuevos piden revisor humano. Las solicitudes que ZEN puede correlacionar se revisan en Permisos de Codex. Tanto el navegador integrado como la extensión aplican sus propios permisos de sitio. El puesto entrega al usuario la autenticación y los actos sensibles. La elección de navegador toma como fuente las indicaciones del usuario en el objetivo. El seguimiento cruza el turno con el chat, la carpeta y la identidad del encargo. La señal en directo expone la referencia del encargo, el estado y la hora. |
| Templates | Las referencias se eligen con diálogo nativo y se validan por formato y tamaño. El original y la miniatura quedan en el perfil y salen con el respaldo que elijas exportar. Main autoriza la lectura, la edición y la copia mientras la ventana de HUB está visible, fuera de Pausa y Presentación. Los prompts son texto y los enlaces de origen se abren por una acción explícita. |
| Métricas de Oura | Acceso de solo lectura con `daily`. El retorno OAuth de `localhost` escucha temporalmente solo en las interfaces loopback, valida origen y estado de un uso, elimina el fragmento del historial y muestra mensajes propios sin incluir la respuesta de Oura. Si un retorno válido no enumera `daily`, ZEN exige HTTP 200 del recurso de sueño diario, descarta el cuerpo y solo entonces guarda la sesión. El almacén de Windows cifra el Client ID, los tokens y las métricas. El resumen de sueño se entrega por IPC solo en Home visible. Los datos de Oura se excluyen de prompts, diagnósticos y respaldos. Pausa y Presentación ocultan los datos y detienen las consultas. Desconectar, caducar o detectar un rechazo elimina la sesión y la caché local y conserva el Client ID. [Política de privacidad](OURA_PRIVACY_POLICY.md) |
| Copia portable | JSON sin cifrar con contenido personal. Importar requiere una vista autorizada y confirmación. Se valida formato y tamaño y se guarda primero una copia recuperable. Sesiones, credenciales y hooks quedan fuera del formato. |
| Perfil compartido | Main autoriza desde Preferencias y usa AES-256-GCM para los archivos de Syncthing. El código aleatorio se protege con el almacén seguro de Windows. La bóveda usa una activación separada y conserva su cifrado KDBX dentro del archivo de transporte. Pausa y Presentación detienen el intercambio. |

Las carpetas de trabajo y los archivos de Officina se eligen mediante el selector nativo. Main conserva su ruta canónica e identidad local, y comprueba que las fuentes sigan disponibles antes de cada turno. Los chats de equipo se crean con el sandbox de solo lectura y el revisor humano. Los nombres y las rutas quedan en el tablero local y en el contexto de los chats que trabajan en el encargo. Codex lee los contenidos desde el disco.

Consultar un resultado de Officina usa el tablero local sin despachar turnos. Para abrirlo en Codex, Main comprueba el proyecto visible, la tarea, la ejecución y la conversación guardada al enviar ese encargo.

El estado de un turno directo se consulta solo para los chats de equipo del proyecto visible y tras comprobar su carpeta. El panel recibe el estado y la hora. La recuperación de un resultado histórico exige el turno y la identidad del encargo guardados.

Para recuperar un envío incierto, Main vuelve a verificar el chat dedicado y compara proyecto, tarea, ejecución y puesto con el mensaje en cola o aceptado en el turno. Si encuentra una entrada en cola, avisa al mismo chat únicamente mientras la cola esté autorizada en el proyecto visible. Los reintentos de envío se reservan para fallos previos a la entrega. Pausa, Presentación y la revisión de permisos conservan sus límites.

Eliminar un proyecto de Officina requiere la vista autorizada y que el proyecto confirmado siga seleccionado. Main elimina su tablero y actualiza la selección en una transacción local. Conserva los chats y los archivos usados como contexto. Los encargos que ya recibió Codex siguen en su conversación.

Para abrir una referencia de un informe, Main comprueba el proyecto visible y la tarea. Solo admite rutas locales existentes dentro de la carpeta de trabajo o archivos adjuntados explícitamente a esa tarea. Resuelve la ruta real antes de abrirla para bloquear escapes mediante enlaces o uniones de directorios. El comando para el editor se construye con la ruta comprobada y las URL web se limitan a HTTP y HTTPS.

Los perfiles personalizados se conservan en el tablero de su proyecto. Main verifica el proyecto visible al guardar. Las instrucciones del puesto viajan como contexto del siguiente turno y se aplican con los permisos y el contrato de respuesta vigentes de Codex.

Main materializa el texto pegado desde el objetivo guardado y verifica su contenido antes de cada turno. El archivo queda en el perfil local. El texto se usa dentro de los permisos de Codex para el encargo que lo recibió.

Main prepara y verifica los informes locales que completan un turno largo. El aviso de permisos de Officina se correlaciona con el chat y el turno observados. Las decisiones sobre permisos se siguen tomando en el circuito de Codex.

Las imágenes se incorporan desde el evento de pegado o de arrastre del usuario. Al enviar, Main valida los JPEG normalizados, los guarda en el perfil local y comprueba la huella antes de adjuntarlos a los turnos del encargo. Abrir una imagen desde el historial usa el mismo control de ámbito que los enlaces a adjuntos.

El chat de ZEN se crea en solo lectura con elevación desactivada. El encargo identifica un archivo de evidencia acotado al tablero del proyecto. El contrato de respuesta reserva las asignaciones y traspasos a los puestos operativos. Solo la acción explícita del usuario puede aplicar un prompt, tras comprobar que la propuesta sigue pendiente y que el texto revisado está vigente. Main exige que conste la aprobación exacta para enviar un seguimiento. El seguimiento admite comprobaciones de lectura y preparación de cambios para revisión, con el mismo sandbox de ZEN.

El ajuste de mejoras automáticas autoriza la coordinación de correcciones locales para incidencias comprobadas en el proyecto vinculado. Main genera el encargo desde el tipo de incidencia y referencia el turno original como evidencia. El despacho de ALM exige QA de Tester vinculado al traspaso de esa revisión. El circuito de permisos de Codex sigue aplicándose a los turnos de Desarrollo, Tester y ALM.

## 05 · Verificar y diagnosticar ![](assets/verde.svg)

Probar accesos desde un frame ajeno, destino distinto, vista oculta, contexto caducado, permiso consumido y archivos inválidos. Diagnosticar con perfiles sintéticos y datos mínimos. Si se comparte evidencia, excluir rutas personales, cuentas, texto privado, capturas y valores secretos. Los auxiliares de producción se compilan sin símbolos de depuración para evitar incluir rutas de compilación. [Pruebas](TESTING.md)


Calendario valida el origen del chat, la correlación y el esquema de cada respuesta. Los textos de eventos se representan como texto. Las consultas son de lectura y la creación externa exige Guardar, un calendario confirmado con escritura y el flujo de permisos vigente de Codex. Las pruebas externas usan dobles. Los conectores disponibles en la sesión de desarrollo requieren su propia disponibilidad en el chat de destino de la aplicación.
