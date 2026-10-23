# Reparación del cifrado local — 09/10/2026

El mensaje «No se pudo descifrar la clave» se producía antes de enviar la petición al proveedor. La recuperación anterior había usado el perfil `ZEN credential recovery` al cifrar, aunque escribió el archivo en `%APPDATA%/ZEN/key.bin`. Leer el archivo desde aquel perfil funcionaba; leerlo desde el perfil real de ZEN fallaba. La clave recuperada coincidía en memoria con la clave existente autorizada; solo se registraron booleanos, nunca valores de credenciales.

Se corrigió el auxiliar local para seleccionar explícitamente el nombre y `userData` de ZEN antes de inicializar Electron. La credencial existente se verificó mediante lectura de modelos y se volvió a cifrar en el perfil correcto. Se conservó una copia del archivo cifrado anterior en `%APPDATA%/ZEN/credential-backups`, fuera del repositorio. No se reemplazó `Local State`, no se sustituyó una clave legible y no se escribieron secretos en claro.

La verificación posterior usó el propio EXE del escritorio en un proceso nuevo, con el perfil habitual y sin `OPENAI_API_KEY` heredada. El proceso principal pudo descifrar `key.bin` con almacenamiento protegido. El inspector de diagnóstico solo estuvo enlazado a loopback y devolvió booleanos; se cerró al terminar. El arranque normal posterior no usa inspector.

Esta reparación cambia los datos locales cifrados, no el EXE. Conserva las dimensiones 637×60 y el panel a media pantalla. El SHA-256 del EXE sigue siendo `61C8337FA49F14A2DD1E4192E1DBB2A83925A8ED83B7B6F685991CA7BE361513`; agente guardado y JSON Live intactos. Ninguna generación de respuesta, voz ni acción del modelo se ejecutó durante esta comprobación. El error anterior permanece como registro histórico del intento fallido; un nuevo envío usa la clave reparada.

Evidencia sin secretos: `evidence/credential-profile-repair.json`.
