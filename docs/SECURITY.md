# Seguridad y privacidad

## 01 · Autoridad e identidad ![](assets/violeta.svg)

El usuario inicia sesión en Codex, que conserva la identidad y aplica sus permisos. ZEN trabaja con el chat local observado o fijado según la operación. La integración instala hooks tras una acción explícita y su confianza se revisa en Codex. Una decisión de permiso está ligada al evento pendiente, se consume una vez y vuelve a Codex si pierde vigencia o conexión.

## 02 · Límites de IPC y ejecución ![](assets/azul.svg)

- Renderer con sandbox, aislamiento de contexto, seguridad web y Node deshabilitado. Main verifica emisor, frame principal, URL local y esquema antes de autorizar cada acción. [IPC](../src/main/companion-ipc.ts)
- El renderer invoca métodos cerrados de preload. El CLI y los auxiliares reciben argumentos definidos por main. Texto, Markdown y eventos externos se tratan como datos.
- La solicitud de análisis se revisa antes del envío, caduca a los dos minutos y es de un uso. La selección de archivo pasa por diálogo nativo, límites de tamaño e identidad. La huella se revalida antes de utilizar el archivo. [Contexto](../src/main/companion-context.ts)
- La observación multimedia es de lectura. Ejecutar un control exige una sesión válida y una acción explícita del usuario.

## 03 · Secretos y conexiones ![](assets/ambar.svg)

El pipe local usa un token guardado en el perfil de ZEN. Se excluye de repositorio, respaldos portables y diagnósticos compartidos. La cuenta, configuración y conexiones de Gmail y Calendar se gestionan en Codex. El flujo activo de ZEN funciona sin claves de modelos o de Google. `CODEX_HOME` selecciona una ruta local.

## 04 · Protección de datos ![](assets/rosa.svg)

| Superficie | Límite |
| --- | --- |
| Actividad y Resumen | Main entrega el supervisor solo con Actividad visible y fuera de Pausa y Presentación. De otros chats muestra estados y nombres de herramientas observados. Sus permisos se devuelven a Codex, y sus argumentos, respuestas y avisos quedan fuera del supervisor. La última respuesta requiere Resumen visible y el chat autorizado. El índice SQLite y el historial JSONL se consultan en modo de lectura. |
| Pausa y Presentación | Ocultan detalles y bloquean efectos sensibles según la vista. Se revalida tras esperas y cambios de contexto. |
| Apuntes y fondos | Inicio recibe metadatos de notas. Los archivos se eligen con diálogos, y las imágenes se validan. El protocolo de tema sirve solo el fondo vigente. |
| Templates | Las referencias se eligen con diálogo nativo y se validan por formato y tamaño. El original y la miniatura quedan en el perfil y salen con el respaldo que elijas exportar. Main autoriza la lectura, la edición y la copia mientras la ventana de HUB está visible, fuera de Pausa y Presentación. Los prompts son texto y los enlaces de origen se abren por una acción explícita. |
| Copia portable | JSON sin cifrar con contenido personal. Importar requiere una vista autorizada y confirmación. Se valida formato y tamaño y se guarda primero una copia recuperable. Sesiones, credenciales y hooks quedan fuera del formato. |

## 05 · Verificar y diagnosticar ![](assets/verde.svg)

Probar accesos desde un frame ajeno, destino distinto, vista oculta, contexto caducado, permiso consumido y archivos inválidos. Diagnosticar con perfiles sintéticos y datos mínimos. Si se comparte evidencia, excluir rutas personales, cuentas, texto privado, capturas y valores secretos. Los auxiliares de producción se compilan sin símbolos de depuración para evitar incluir rutas de compilación. [Pruebas](TESTING.md)


Calendario valida el origen del chat, la correlación y el esquema de cada respuesta. Los textos de eventos se representan como texto. Las consultas son de lectura y la creación externa exige Guardar, un calendario confirmado con escritura y el flujo de permisos vigente de Codex. Las pruebas externas usan dobles. Los conectores disponibles en la sesión de desarrollo requieren su propia disponibilidad en el chat de destino de la aplicación.
