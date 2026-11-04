# Sesiones persistentes de Google

Gmail y Calendar guardan su conexión cifrada en el perfil estable de ZEN (`%APPDATA%\ZEN`), fuera del directorio temporal del EXE portable. Cerrar, ocultar, pausar, Presentación o navegar retira datos y lecturas de las vistas, pero no elimina la conexión guardada. Desconectar sí es una acción explícita independiente por integración.

Al volver a abrir ZEN, cada servicio carga su autorización y el cliente Desktop ya configurado. Un token de acceso caducado se renueva al abrir la sección autorizada, sin abrir el navegador, importar el JSON ni leer el buzón o calendario ocultos. Gmail conserva el refresh token si Google no devuelve uno nuevo durante la renovación. Calendar utiliza su archivo de tokens independiente. El secreto y el Client ID de escritorio solo se importan una vez para ese cliente y usuario de Windows.

## Corrección del 3 de noviembre de 2026

Guardar otra vez el mismo Client ID en Gmail borraba la sesión OAuth, aunque mantenía el secreto del JSON. Ahora esa operación conserva los archivos, cuenta y permisos sin escrituras ni un nuevo consentimiento. Cambiar a un cliente diferente sigue invalidando la conexión anterior. La configuración del cliente nuevo se escribe de forma atómica antes de retirar la anterior de memoria.

La renovación de Gmail guarda y valida el nuevo token antes de sustituir el de memoria. Un error temporal de red o de cifrado no borra el archivo de sesión ni pide importar credenciales. Se puede volver a actualizar. Una respuesta tardía de una consulta anterior no reemplaza otra autorización.

Si Google rechaza el refresh token con `invalid_grant`, Gmail deja de presentarlo como una conexión operativa, revoca las vistas privadas y muestra **Reconectar con Google**, conservando la configuración. No repite automáticamente la renovación rechazada durante esa ejecución ni abre Google por su cuenta. Solo una conexión nueva completada limpia ese estado; guardar el mismo Client ID no lo oculta. La interfaz retira la lista y el lector anteriores cuando recibe ese estado y permite reconectar con el cliente ya importado.

## Caducidad que controla Google

Una autorización guardada no evita que Google la revoque o caduque. En un proyecto OAuth externo con estado **Pruebas**, Google documenta que los refresh tokens caducan a los siete días para estos permisos. Ese rechazo requiere nuevo consentimiento, pero no un JSON nuevo. Conviene revisar el estado de publicación del consentimiento en el proyecto de Google; esta entrega no cambia Google Cloud ni publica el cliente. [Caducidad de refresh tokens en Google](https://developers.google.com/identity/protocols/oauth2#expiration).

## Evidencia

El diagnóstico local del 3 de noviembre recuperó correctamente el secreto Desktop y las dos sesiones cifradas en un proceso Electron aislado, usando una copia de `Local State` y sin modificar el perfil ni consultar Google. Ambos archivos contienen refresh token; el registro acotado de Gmail indica un rechazo de renovación `invalid_grant`. Esto confirma un rechazo del proveedor; no demuestra por sí solo si el proyecto está en Pruebas, si hubo revocación o cuál fue su causa.

Build y 798 pruebas en 66 archivos pasan. Los casos nuevos comprueban guardar el mismo ID con cuenta y permiso de papelera, cerrar y restaurar sin OAuth, renovar automáticamente y restaurar de nuevo sin importar JSON, recuperar un fallo de red, conservar el archivo si falla el cifrado, reconectar tras rechazo con el cliente guardado y restaurar Calendar sin lecturas ocultas. Google y los tokens de las pruebas son sintéticos.

El recorrido Electron y el EXE portable extraído verifican la retirada del correo anterior, el botón de reconexión y la recuperación del buzón simulado sin importar JSON. No se usa un modelo, no se lee correo ni calendario real para estas pruebas y no se intenta reutilizar una autorización que Google ha rechazado. La comprobación local de persistencia no acredita que un refresh token concreto siga autorizado en Google.

El único `Desktop/ZEN.exe` queda actualizado con hash idéntico al portable probado y respaldo en `release/desktop-backups`. Se reinicia únicamente la instancia de ZEN identificada por su bundle; los archivos de las cuentas, preferencias, históricos, hooks y configuración de Codex conservan sus hashes antes del cierre y después del arranque. El proceso normal carga el bundle probado y un único observador nativo vinculado. Evidencias locales: `docs/evidence/google-sessions-storage.json` y `docs/evidence/google-sessions-deployment.json`. No se publica el proyecto ni se crean carpetas nuevas en el escritorio.
