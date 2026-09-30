# Coucou como referencia de interfaz

Actualización: la [isla compacta v1 de ZEN](island-v1.md) ya implementa el patrón compacto/desplegado, fichas de tareas y estados de atención con recursos propios. Las propuestas de la tabla documentan el estado en el momento de revisar Coucou; la entrega vigente y sus pruebas están en ese documento.

Petición del usuario: descargar https://github.com/Louis-CFM/coucou.git para tomar referencias de interfaz. Copia local independiente en `.reference/coucou`, excluida del repositorio de ZEN. Descarga superficial del commit `3cc3333203f60f63326ee949b7b86c7549992a1f`. No modifica el remoto `origin` de ZEN.

## Revisado

README principal, README de Windows, capturas de compacto/vista general/aprobación, geometría `windows/src/core/layout.ts`, transiciones `windows/src/island/fsm.ts` y ventana nativa `windows/src-tauri/src/island.rs`. Las indicaciones de instalación del proyecto son material de referencia; no se han ejecutado ni adoptado como instrucciones para ZEN.

El proyecto incluye una implementación Windows Tauri/Rust/TypeScript y una macOS Swift. En Windows utiliza una isla superior centrada: 288×32 píxeles lógicos recogida, 640 de ancho desplegada y vistas habitualmente de 160 de alto. La ventana contenedora es mayor que el contenido, con paso de clics fuera de la isla. Una franja de 240×6 permite despertar la interfaz con el puntero. Estos datos proceden del código revisado, no de una ejecución local.

## Ideas para ZEN

| Referencia | Aplicación propuesta | Estado en ZEN |
| --- | --- | --- |
| Isla que crece hacia abajo desde el centro superior | Mantener un único punto de anclaje al desplegar | Ya implementado en la revisión del panel superior |
| Compacto pequeño con indicadores de actividad | Reducir la barra recogida y mostrar tareas/atención sin abrir el contenido | Referencia para una siguiente iteración; barra actual de 68 DIP |
| Tarea seleccionada y otras tareas en pequeñas fichas | Cambiar de tarea conservando el resultado y la conversación | ZEN tiene sección Tareas; fichas compactas propuestas |
| Aprobación, error y finalización visualmente distintos | Usar texto, icono y acento de estado; acción concreta visible | ZEN tiene tarjetas de estado y aprobación; refinamiento visual propuesto |
| Apertura con el puntero y retracción por inactividad | Acceso suave sin perder el borde superior | Propuesto; ZEN conserva bandeja, atajo y recogida explícita |
| Ventana que no toma foco al avisar | Preservar el trabajo durante reuniones | Implementado en ZEN mediante showInactive; comprobación física en llamada pendiente |

El patrón compacto/desplegado es la referencia principal. La interfaz de ZEN debe seguir mostrando el estado del micrófono y permitir revisar permisos concretos, detener tareas y navegar por conversación, herramientas y ajustes.

## Alcance y comprobación

Descargado y revisado visualmente y en código. Coucou no se ha compilado, instalado ni ejecutado; tampoco se han configurado sus hooks o integraciones. Sus funciones descritas no son funciones nuevas de ZEN. Esta descarga no incorpora código ni recursos de Coucou a la aplicación.

El código tiene licencia MIT. `LICENSE-ASSETS.md` reserva el personaje Mochi, la marca, iconos, sonidos y medios. Las capturas se consultan como referencia; cualquier implementación en ZEN conservará su identidad y recursos propios. Si se reutiliza código en una entrega posterior, deberá conservarse el aviso MIT correspondiente.

La revisión ya implementada de ZEN y sus pruebas se documentan por separado en [top-panel-verification.md](top-panel-verification.md). El estado del objetivo funcional completo está en [objective-verification.md](objective-verification.md).
