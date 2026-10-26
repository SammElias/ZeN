# Lectura y respuesta de correo con Codex

Autorizado el 25/10/2026 al aceptar las cinco mejoras propuestas.

## Leer y continuar

- Las citas HTML reconocidas de Gmail, Outlook y blockquote se pliegan con **Ver texto citado**. El contenido sigue íntegro dentro del documento saneado; se conserva el registro de enlaces e imágenes. El plegado se añade después del saneado, con un máximo de cien controles y análisis acotado de DOM. Los detalles/scripts/eventos del remitente siguen excluidos. El formato Texto reconoce citas con `>`, cabeceras de respuesta españolas/inglesas y separadores de mensaje original, conservando todos los caracteres. Un mensaje compuesto únicamente de cita permanece visible.
- **Anterior / Siguiente** navegan por la consulta actual. Siguiente puede cargar páginas adicionales sin pasar por Recibidos, respetando cinco páginas/cien conversaciones y los permisos de lectura previos. Los límites, errores o duplicados no producen un bucle de consultas.
- Se recuerda el correo, consulta, posición vertical, formato y mensajes desplegados durante la sesión de ZEN. El cursor vive únicamente en RAM, no contiene cuerpos, borradores, credenciales ni tokens de página y caduca después de cuatro horas sin actualización. Al volver a Gmail visible se relee la consulta y el correo, únicamente dentro de las páginas previamente cargadas. Si ya no se encuentra, se queda en la bandeja. Una clave aleatoria por cuenta se mantiene al ocultar, cambia tras nuevo consentimiento/configuración/desconexión y evita recuperar el cursor de otra cuenta. Pausa y Presentación borran el cursor. No se conserva tras salir del proceso.
- Flechas arriba/abajo seleccionan un correo en la bandeja y Enter lo abre. Izquierda/derecha navegan en el lector. Escape vuelve a Recibidos y desde la bandeja recoge ZEN. Campos, revisiones y editor tratan Escape primero para evitar cerrar accidentalmente la lectura. El visor aislado solo comunica Escape y las dos direcciones de navegación, nunca texto ni otras pulsaciones; se verifican ventana, origen opaco, vista y enum.

Las lecturas se cancelan o descartan al ocultar/navegar/pausar/Presentación. El cursor no permite consultas ocultas ni evita verificar los identificadores de la lista actual. El lector presenta un estado de carga estable al cambiar de mensaje, sin enseñar la bandeja entre ambos. Formato y mensajes abiertos se restauran antes de recuperar el desplazamiento; el contenido remoto o un hilo modificado puede cambiar su geometría.

## Propuesta de Codex

**Analizar en Codex → Sugerir respuesta → Revisar → Copiar y abrir Codex.** El usuario pega y envía en su chat fijado. La petición incorpora una etiqueta aleatoria, visible en la revisión, para que Codex delimite únicamente el texto propuesto.

Después, **Traer de Codex** lee la última respuesta final del chat/proyecto fijados mediante el lector local ya existente o la observación confirmada. Solo devuelve el bloque que coincide con una petición revisada y copiada para ese correo. Se comprueban cuenta, huella del contenido, destino, visibilidad, versión y caducidad antes y después de la lectura. Una respuesta ajena, incompleta, sin etiqueta, repetida o antigua no se atribuye al correo.

El registro conserva solo etiqueta, huella y destino en RAM, hasta ocho correos/treinta minutos. Ocultar permite volver a la petición de la misma cuenta y contenido, pero retira el texto del editor; Pausa/Presentación/Salir invalidan la asociación. Cambiar cuenta, destino o contenido la hace inutilizable. Nada se añade a estados globales, avisos, resúmenes o logs.

La propuesta aparece en un editor local de texto, con **Copiar respuesta** y **Abrir Gmail**. El usuario revisa, copia y envía desde Gmail. ZEN no envía correo, no guarda borradores en Gmail ni inicia trabajo/modelos automáticamente. No se necesitan permisos OAuth adicionales ni una API de modelos de ZEN. No se reanuda otro chat ni se accede a secretos de Codex.

## Validación

Build y 719 pruebas en 64 archivos pasan. Pruebas de cuotas de DOM, citas reversibles, cursor sin contenido/otra cuenta/expiración, identidad de cuenta, correspondencia de respuesta, contenido modificado, pausa/ocultación/destino durante lectura, revisión de un uso y fallos separados. El recorrido Electron usa correo, respuestas, copia y aperturas sintéticas; valida además selección rápida por teclado, navegación y página siguiente, recuperación de posición/formato/desplegados y editor/copia exactos sin enviar. El ciclo normal de cierre se verificó con diagnóstico temporal local; se retira la instrumentación. El empaquetador deja de mantener Node activo por las tuberías de diagnóstico heredadas después de terminar main, conservando salida cero y recibo por PID/ruta exactos como requisitos. Tras verificar el ciclo completo de cierre, el modo de prueba finaliza Node únicamente al recibir quit de Electron y conserva su código; no fuerza el cierre antes del evento ni modifica la salida de producción.

No se leen correos reales ni se piden generaciones reales durante la validación. Se conservan los límites previos de control físico, DPI y servicios reales.

El EXE extraído supera el mismo recorrido con salida cero. Se sustituye el único `Desktop/ZEN.exe`, con respaldo dentro de release y SHA-256 `29A3C3018C8C83A9893C655871822389BFB5474E7F2851FE38D14BB7D6A8F7C1`. Bundle y arranque normal confirmados, junto con un único observador vinculado al main. Se conservan cuentas, preferencias, configuraciones históricas, hooks, confianza y relay; sin commit/push. La entrega se registra en `docs/evidence/mail-workflow-deployment.json`.
