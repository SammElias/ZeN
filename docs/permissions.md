# Permisos

## Implementado

La única herramienta es `open_application({application:"notepad"})`. Zod rechaza campos extra, identificadores distintos, JSON corrupto y herramientas desconocidas. Main ejecuta solo el script fijo incluido; ningún argumento del usuario se interpola en PowerShell. No se cambia ExecutionPolicy ni se solicita elevación.

Autoridad determinista: una orden directa corta de apertura, más el permiso `allowNotepad` en configuración. La política admite variantes limitadas (`Abre el Bloc de notas`, `Por favor abre Bloc de notas`, `Open notepad`). Rechaza negaciones, instrucciones dentro de documentos, citas y órdenes compuestas. Un resultado del modelo nunca autoriza nada por sí solo.

La voz requiere consentimiento persistente y una invocación por botón/atajo; la transcripción usada como petición llega por sideband directamente de OpenAI. No se admiten argumentos de texto generados por el modelo en la delegación. Las transcripciones antiguas después de un nuevo turno se descartan. Las acciones ya iniciadas antes de interrumpir pueden haber surtido efecto.

La aplicación no lee archivos del usuario. Lee sus propios scripts/configuración y guarda sus datos locales. Renderer sin Node, acceso a medios limitado a audio bajo consentimiento, sin vídeo ni solicitudes de otros permisos. IPC valida origen y argumentos. La clave se introduce en el campo de configuración, se envía una vez a main para cifrarla y se limpia; main nunca devuelve la clave almacenada.

El verificador admite una ventana visible de un proceso notepad ubicado en System32 o en el paquete WindowsApps Microsoft.WindowsNotepad. Registra PID/handle/hora, nunca título o contenido. No reintenta si la apertura/verificación falla.

## Propuesto para fases futuras

Operaciones irreversibles necesitarán una aprobación única con acción, contenido y destino congelados. Cambiar cualquiera invalidará esa aprobación. Control de UI/código generado primero en VM o entorno aislado real, con límites y verificación. Una lista de comandos no constituye aislamiento.
