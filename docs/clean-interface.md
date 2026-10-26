# Interfaz limpia y correo legible

Petición del 25/10/2026: ordenar el lector de correo y retirar los mensajes informativos repetidos de la aplicación.

El correo abierto dispone de una cabecera con Recibidos, Gmail y Eliminar; un asunto con jerarquía clara y una fila común con Analizar en Codex, número de mensajes y Original/Texto. La búsqueda, la configuración de Google y Desconectar permanecen en la bandeja, sin ocupar el lector. El panel de análisis es un botón compacto y se amplía al solicitarlo, conservando revisión exacta, destino fijado y copia de un uso.

Cada mensaje separa nombre del remitente, dirección y destinatario, con fechas locales breves y fecha completa en hover. Aumentan la tipografía y el espacio entre los datos; el último mensaje cargado se abre inicialmente y los anteriores permanecen plegables. El cuerpo original sigue en su visor aislado y conserva su formato; Texto se presenta también sobre una superficie de lectura blanca. El asunto ya no se repite dentro de cada intervención.

Se retiran instrucciones permanentes, introducciones, explicaciones de implementación, notas de lectura normal, textos de éxito repetidos y pies redundantes en Gmail, análisis, Home, música, Codex y preferencias. Home conserva los datos reales de música, correo, trabajo y avisos. Los ajustes de integración y la atribución siguen accesibles en Preferencias; la atribución queda en Acerca de ZEN. Se conservan errores, lecturas incompletas, permisos, revisión de papelera, privacidad y el siguiente paso necesario después de copiar a Codex. Las imágenes externas siguen requiriendo un clic explícito, con el aviso de apertura en el título del control.

No cambian los transportes, OAuth/scopes, lectura autorizada, aislamiento/CSP, límites de contexto, controles multimedia, permisos de Codex ni geometría de la cápsula. No se lee correo real ni se inicia una generación en Codex para validar el diseño.

Build y 689 pruebas en 63 archivos pasan. El recorrido Electron y el EXE extraído con correo sintético comprueban lector sin controles ajenos, nombres/fechas legibles, entrada de análisis compacta, último mensaje abierto, cuerpos enriquecidos y todas las regresiones de análisis, papelera, música y privacidad. Se aplican anchos nativos de 320/380/760, sin desbordamiento. Las capturas de prueba se guardan localmente en `docs/ui-preview/companion/`, incluida `gmail-clean-reader.png`; no contienen correo del usuario. Los límites previos de control físico, DPI y uso real de proveedores permanecen vigentes.

Se ha sustituido el único `Desktop/ZEN.exe` por el portable probado, con respaldo dentro de release y SHA-256 `5AEE8DB9E2895A96F85144647D2C87995D13E9659331076CFF66CEFEEDDA7A54`. Arranque normal, bundle y observador único vinculado al main confirmados. Cuentas, preferencias, configuración histórica, hooks, confianza y relay conservados; sin commit/push. La entrega se registra en `docs/evidence/clean-interface-deployment.json`.
