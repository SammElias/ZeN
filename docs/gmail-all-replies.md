# Formato por mensaje y respuesta

Corrección solicitada el 25/10/2026: el usuario observa que el formato enriquecido solo aparece en el primer correo. La validación anterior usaba un hilo con un único cuerpo HTML y otro en texto; no acreditaba correctamente varias respuestas enriquecidas simultáneas.

Se corrigen condiciones reproducibles del lector:

- El presupuesto acumulado de 1 MB de HTML de la conversación podía dejar sin vista Original a mensajes posteriores. Se elimina ese reparto por orden; cada mensaje disponible obtiene su propia vista aleatoria, aislada y revocable. Se mantienen los límites previos de respuesta HTTP de 8 MB y de cien mensajes, sin nuevas consultas a Gmail.
- Las respuestas que citan el contenido anterior podían superar el límite de 200 KB por HTML. El cuerpo HTML admite ahora hasta un millón de caracteres y el resultado saneado hasta 1,5 millones por mensaje. Si se supera ese límite, se muestra el texto disponible con aviso.
- Los mensajes de texto también usan el mismo visor en Original, escapados y con saltos de línea. Se indica que fueron enviados como texto; no se les inventan colores ni se interpreta su contenido como HTML. Texto sigue mostrando la alternativa disponible con sus límites existentes.
- Se normalizan los nombres MIME y se distinguen partes de cuerpo con nombre e indicación `inline` de los verdaderos adjuntos. Los adjuntos HTML siguen excluidos.
- Los estilos internos habituales de respuestas Outlook/Gmail se convierten en estilos inline permitidos antes de eliminar las hojas de estilo. Se admiten selectores simples de etiqueta, clase, identificador, descendiente e hijo, con especificidad y orden y prioridad del estilo inline existente. No se ejecuta CSS en un navegador durante este proceso, no se importan hojas externas ni se admiten URLs, scripts o estilos activos. Reglas anidadas, selectores complejos y propiedades no permitidas se omiten.

El procesamiento de estilos se acota a 50 KB de CSS, cien reglas, diez selectores por regla, treinta declaraciones, 200.000 comprobaciones y un recorrido de DOM limitado por tamaño/profundidad. Los analizadores son dependencias JavaScript declaradas y sus licencias se incluyen. Cada visor mantiene sus estilos y sus mensajes de control separados; alternar Original/Texto afecta a todos los mensajes desplegados del hilo.

Se conservan CSP/sandbox, bloqueo inicial y carga explícita de imágenes, caché en RAM, enlaces registrados y revocación al navegar/ocultar/pausar/Presentación. El cambio no añade endpoints de Gmail, descarga de adjuntos, lectura automática de correo ni nuevos ámbitos OAuth. Cuando Google no haya incluido un cuerpo disponible o se excedan los límites, se mantiene el aviso y Abrir Gmail para revisar el original completo.

## Validación

Build y 655 pruebas de 62 archivos pasan. Se comprueban siete respuestas largas que superan el antiguo presupuesto compartido, citas HTML mayores de 200 KB, mezcla de HTML/CSS/texto y partes inline con nombre, escape de texto, estilos Outlook y rechazo de CSS remoto/activo.

El recorrido de Electron y el EXE extraído abren dos mensajes HTML del mismo hilo simultáneamente, verifican colores independientes (morado/azul), sus dos marcos separados y el cambio de ambos a Texto y de vuelta a Original. Se repiten las comprobaciones de CSP, privacidad, imágenes/enlaces y las regresiones de la cápsula/Gmail/papelera. Las capturas y mensajes son sintéticos; `docs/ui-preview/companion/gmail-all-replies.png` muestra el caso probado. No se leyó correo real del usuario para diagnosticar o validar esta corrección y no se atribuye una causa única a su correo concreto sin esa inspección.

El primer recorrido del EXE extraído no superó la comprobación auxiliar `nativeHistoryRegression`, ajena al formato del correo. El auxiliar pasó después por separado (cinco casos, 197 ms) y el mismo EXE, sin cambios de hash, superó un nuevo recorrido completo. No se desactivó esa comprobación ni se modificó el auxiliar.

El único Desktop/ZEN.exe se sustituye tras probar el EXE, con respaldo dentro de release, hash idéntico, arranque/bundle y observador único. Evidencia local: `docs/evidence/all-mail-replies-deployment.json`. Se conservan cuentas, preferencias, históricos, OAuth, hooks/confianza/relay y Codex; sin API de modelos ni commit/push y con los límites físicos anteriores.

La comprobación inicial del arranque normal a los 15 s no fue concluyente. Una consulta posterior por CIM confirmó el bundle con el hash probado y un único observador cuyo padre pertenece a ese proceso de ZEN; el EXE del escritorio conserva el hash del portable validado.
