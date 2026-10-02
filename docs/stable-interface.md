# Interfaz compacta y streaming estable · 01/10/2026

El usuario autorizó aplicar las seis mejoras propuestas a partir del parpadeo y su captura del panel con espacio vacío. Modelos, herramientas, instrucciones, JSON Live y permisos existentes se conservan.

## Implementado

1. **Streaming separado.** La última conversación y el avance de Codex tienen almacenes de presentación independientes. Se procesan todos los eventos en orden; solo los repintados de deltas se agrupan cada 50 ms. Nuevos mensajes, cambios de interlocutor, resultados finales e interrupciones se presentan inmediatamente. Cabecera y controles no reciben el texto de cada delta. Los enlaces se convierten al asentarse la presentación, evitando cambiar su estructura a mitad de una URL.
2. **Altura compacta.** Conserva 640×48 DIP recogida y 1120 DIP de ancho expandida. Respuestas asentadas: altura medida entre 220 y 440 DIP; pantalla pequeña limita el tamaño. Durante streaming/trabajo/voz reserva 340 DIP. Aprobaciones y revisión de proyectos conservan espacio propio y desplazamiento. El ajuste se produce al abrir, cambiar de contexto, preparar adjuntos o asentar el mensaje; los deltas no redimensionan la ventana. Main omite layouts idénticos y anima solo cambios de modo.
3. **Conversación conservada.** Los errores, desconexiones e inactividad de voz se muestran junto al micrófono, con botón para cerrar el aviso; no sustituyen el último mensaje. Reconectar conserva la conversación visible y reinicia el reloj de captions. La nueva intervención humana sigue descartando referencias de tareas anteriores.
4. **Estados estables.** Cabecera con Listo, Escuchando, Trabajando, Respondiendo, Reunión y estados de conexión. Cambios ordinarios se estabilizan durante 300 ms; necesidad de atención y cierre se presentan inmediatamente. Retirada de pulsaciones, saltos y fades durante streaming; el personaje conserva seguimiento suave del puntero y el movimiento reducido. Detener, permisos y acciones no se retrasan.
5. **Ficha de pantalla.** Pantalla, aplicación, disponibilidad y hora, con vista de la captura exacta y Actualizar. Caducidad visible y título completo al pasar el puntero. No añade captura continua ni cambia lo que se envía a SOL.
6. **Controles agrupados.** Texto arriba, escritura/adjuntos debajo, micrófono y avisos a la izquierda; hablar/reunión/detener a la derecha. Copiar conserva el texto literal. Scroll sigue los fragmentos mientras estás al final; al subir para leer se detiene el seguimiento y ofrece Ir al final.

La pausa de presentación de 700 ms solo permite medir texto asentado y quitar «En directo» visualmente; no convierte captions Live en turnos, no inventa eventos de finalización y no concede autorización a herramientas. El cierre de Live sigue requiriendo session.closed.

## Probado

- **238 pruebas en 27 archivos**, build TypeScript/renderer. Nuevas pruebas de agrupación literal, finalización inmediata, interrupción, preservación de mensajes y reinicio de reloj de voz.
- [Edge con puente simulado](evidence/stable-interface-ui.json): ráfaga de 80 eventos, 8 actualizaciones del texto en la ejecución registrada; cero cambios de cabecera, cero layouts durante la ráfaga, DOM de mensaje/personaje conservado, altura fija de 340 DIP y texto exacto con caracteres españoles. Panel breve de 246 DIP; respuesta extensa ampliada. Copia exacta, seguimiento/lectura del scroll, aviso de inactividad y estado Listo comprobados, además de adjuntos, reunión y revisión de Codex.
- [Electron/Windows](evidence/stable-interface-electron.json): 40 eventos sintéticos sin eventos nativos de resize ni cambios de bounds; mensaje/personaje conservados, texto literal, aviso de voz separado. Aislamiento, CSP/pegado de imágenes, lectura local, proyectos y movimiento entre monitores conservados.
- [Portable verificado](evidence/portable-interface.json): `release/ZEN-20261001152044381/ZEN.exe`, incluye comprobaciones de streaming estable y aviso de voz, además de las comprobaciones anteriores. Conserva toda su carpeta y sal del ejecutable anterior desde la bandeja antes de abrirlo.

No se hizo ninguna nueva llamada a la API ni se subieron capturas personales. Un primer fixture Electron enviaba un cierre de transcripción con un identificador nuevo sin inicio; la prueba fue corregida para emitir inicio y cierre y pasó. Las primeras expectativas web del texto «En directo» permanente y del único contenedor de proyecto se actualizaron al diseño vigente.

## Pendiente

No se ha medido el parpadeo físico de la instalación del usuario con su sesión Live, GPU/DPI y pantallas reales. Las pruebas acreditan estabilidad de DOM, layouts y bounds bajo eventos sintéticos, no una grabación física de todos los fotogramas. Voz/Teams/DPI y los fallos generales de foco anteriores siguen pendientes. El [objetivo completo](objective-verification.md) continúa incompleto.

## Corrección del parpadeo · 02/10/2026

El panel de actividad tenía un breakpoint `max-height:560px` que cambiaba una fila de 84 a 120 px. Al adaptar la ventana nativa a su contenido se alternaban 538 y 574 px continuamente. Se elimina la dependencia de la altura del viewport: el panel depende únicamente de sus filas.

La prueba de regresión simula que cada petición de altura cambia el viewport de Electron: reproduce 14 alternancias 538/574 con la regla anterior y mantiene 538 px en las 14 iteraciones con la corrección. Se conserva movimiento del robot, adaptación a anchura y ausencia de redimensionados por delta. Evidencia en `evidence/resize-stability-ui.json`.
