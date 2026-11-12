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
| Actividad y Resumen | Se filtra antes de IPC. La última respuesta requiere Resumen visible y el chat autorizado. El lector consulta SQLite y JSONL de Codex en modo de lectura y limita las rutas y bytes leídos. |
| Pausa y Presentación | Ocultan detalles y bloquean efectos sensibles según la vista. Se revalida tras esperas y cambios de contexto. |
| Apuntes y fondos | Inicio recibe metadatos de notas. Los archivos se eligen con diálogos, y las imágenes se validan. El protocolo de tema sirve solo el fondo vigente. |
| Copia portable | JSON sin cifrar con contenido personal. Importar requiere una vista autorizada y confirmación. Se valida formato y tamaño y se guarda primero una copia recuperable. Sesiones, credenciales y hooks quedan fuera del formato. |

## 05 · Verificar y diagnosticar ![](assets/verde.svg)

Probar accesos desde un frame ajeno, destino distinto, vista oculta, contexto caducado, permiso consumido y archivos inválidos. Diagnosticar con perfiles sintéticos y datos mínimos. Si se comparte evidencia, excluir rutas personales, cuentas, texto privado, capturas y valores secretos. Los auxiliares de producción se compilan sin símbolos de depuración para evitar incluir rutas de compilación. [Pruebas](TESTING.md)
