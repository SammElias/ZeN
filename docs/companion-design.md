# Diseño del compañero de ZeN

La referencia local es `.reference/coucou`, revisión `3cc3333`. Se ha tomado como orientación visual la isla negra, las tarjetas oscuras redondeadas, la jerarquía discreta de controles y las reacciones de un compañero a la actividad.

ZeN utiliza un personaje original dibujado en SVG: una perla lavanda con visor y órbita. No incorpora Mochi, iconos, imágenes, animaciones del personaje ni archivos WAV de Coucou. La licencia de sus recursos (`LICENSE-ASSETS.md`) reserva estos elementos al autor. La implementación nueva tampoco copia su código.

El compañero respira y parpadea, sigue el cursor dentro de la vista abierta y reacciona a pensar, ejecutar, escuchar, responder, completar una tarea, necesitar atención, fallar y cancelar. Los estados proceden de la actividad real de ZeN. La cabecera permite arrastrar lateralmente y entre pantallas, conservando el anclaje superior y 640 × 48 DIP al recogerse; las esquinas usan transparencia nativa. La expansión actual muestra únicamente la última intervención de Tú/ZEN y su stream, sin historial ni campo de escritura. Contexto queda bajo el clip y las aprobaciones concretas siguen disponibles para revisión. Preferencias se mantiene fuera de la isla.

Los avisos se sintetizan localmente con Web Audio: saludo en la primera interacción, abrir, recoger, enviar, adjuntar contexto, completar, solicitar atención y error. No requieren red ni capturan audio. El motor limita avisos consecutivos, evita repetir el aviso por actualizaciones de la misma tarea y suspende el contexto al terminar. Al silenciar, detiene también los tonos pendientes para impedir su reproducción posterior.

En Preferencias → Aspecto y sonidos se puede desactivar el sonido o las animaciones. Reunión, respuesta solo en texto, voz conectada y ventana oculta silencian estos avisos. Se respeta también el movimiento reducido de Windows. Las preferencias nuevas tienen valores predeterminados compatibles con archivos de configuración anteriores.

Verificación: compilación TypeScript/Vite, pruebas unitarias existentes y `npm run test:ui`. La prueba de interfaz verifica seguimiento del cursor, accesos rápidos visibles, programación real de tonos en el navegador, silencio inmediato en reunión, ausencia de avisos duplicados y guardado/desactivación de preferencias. Esto comprueba el motor de audio; no acredita una escucha física de los altavoces. `package:win` comprueba además el arranque real del paquete Electron y su auxiliar Windows sin clave API.
