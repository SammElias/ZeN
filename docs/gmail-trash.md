# Eliminar conversaciones desde ZEN

Petición del 25/10/2026: añadir un botón de eliminar en Gmail. La papelera aparece junto a cada conversación y en el hilo abierto, dentro de la misma cápsula. El botón prepara una confirmación con el asunto y el número de mensajes observados. Solo Eliminar conversación envía el efecto. Cancelar conserva el correo.

La operación mueve **todo el hilo** a la papelera de Gmail. Se puede recuperar desde Gmail; ZEN no implementa eliminación permanente. Tras una respuesta confirmada actualiza Recibidos y su contador. Si falla esa actualización, distingue el éxito de mover a la papelera del fallo al volver a consultar la bandeja. Si no puede confirmar la respuesta del efecto, pide comprobar Gmail y no repite la petición.

## Permiso adicional opcional

La conexión habitual sigue pidiendo únicamente `gmail.readonly`. Los perfiles existentes permanecen utilizables, cifrados y sin modificaciones durante el despliegue. **Permitir eliminar** inicia una autorización explícita para `gmail.modify`, que es el permiso requerido por el endpoint de papelera. No se usa el ámbito de eliminación permanente `https://mail.google.com/`.

Los ámbitos concedidos se guardan con los tokens en el archivo cifrado existente. Un perfil anterior sin esa información se trata como lectura; no se le atribuye permiso para escribir. Una respuesta de Google que solo conceda lectura tampoco activa la papelera. La renovación conserva los permisos si Google no devuelve un nuevo alcance y los vuelve a comprobar antes de enviar el efecto. Rechazar o cancelar la ampliación conserva la conexión anterior; los errores se muestran también cuando esa cuenta anterior sigue conectada.

## Límites de ejecución

- Main y el servicio exigen Gmail desplegado, visible, sin minimizar, pausa ni Presentación. Home, la cápsula recogida y otras secciones no pueden preparar ni ejecutar una eliminación.
- Solo se puede revisar un identificador obtenido de la lista actual. El asunto y el número de mensajes proceden de metadata ya observada, no de parámetros arbitrarios enviados por el renderer.
- La revisión permanece en RAM, caduca en 60 segundos y es de un uso. Cancelar, listar de nuevo, leer otra conversación, navegar, ocultar, pausar, cambiar credenciales o desconectar la revocan.
- Tras confirmar, se vuelve a validar el estado y el permiso después de renovar el token. Solo hay un efecto en curso. Doble clic, respuesta tardía o error no ocasionan reintentos.
- El transporte admite exactamente POST a `users/me/threads/{id}/trash?fields=id`, sin cuerpo y con respuesta máxima de 8 KiB. Permanecen bloqueados DELETE, envío, modificación genérica, recuperación, adjuntos y otros efectos. No hay cookies, caché ni redirecciones. Los diagnósticos no guardan el correo, su identificador, credenciales ni cuerpos remotos.
- Una petición ya transmitida puede completarse en Google aunque se oculte ZEN o se interrumpa la red. Se descarta la respuesta tardía y se pide revisar Gmail; no se afirma que ocultar deshaga un efecto enviado.

## Validación y entrega

Build y 602 pruebas en 60 archivos superadas. Los casos de papelera prueban cuenta antigua, autorización opcional, persistencia cifrada, concesión insuficiente, rechazo de ampliación, destino inmutable, cancelación, caducidad, navegación, privacidad, permiso tras renovación, un solo efecto y respuesta incierta/tardía. El transporte permite solo el endpoint mínimo y rechaza otras mutaciones.

El recorrido Electron utiliza una cuenta y mensajes sintéticos. Comprueba permiso explícito, icono en lista/hilo abierto, confirmación del hilo completo, Cancelar, revocación al navegar y activar Presentación, doble clic y actualización de bandeja. El EXE extraído se comprueba antes de sustituir únicamente `Desktop/ZEN.exe`, con respaldo en `release/desktop-backups`, identidad de hash, arranque/bundle y observador. Evidencia local en `docs/evidence/gmail-trash-deployment.json`.

No se elimina ni lee correo real para las pruebas, no se autoriza Google en nombre del usuario y no se cambian Cloud, hooks, confianza, relay ni Codex. La autorización real adicional queda a cargo del usuario mediante Permitir eliminar. No hay API de modelos ni commit/push en esta entrega; permanecen los límites físicos anteriores.

Referencias oficiales: [threads.trash](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/trash), [ámbitos de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).
