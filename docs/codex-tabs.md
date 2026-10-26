# Dos vistas internas en Codex

Codex tiene dos pestañas: **Actividad** y **Resumen**. Se mantienen la cápsula única, sus dimensiones y la navegación principal.

Actividad contiene la fase observada, comandos/acciones plegables y el acceso a Permisos. Permisos se revisa dentro de Actividad, con las decisiones de un uso existentes, sin añadir una tercera pestaña. Resumen contiene la última respuesta final, el resultado observado del turno y los archivos con cambios cuando existe una comparación disponible. El acceso Analizar y sus resultados permanecen en Resumen.

La pestaña inicial es Actividad. La selección se conserva en RAM al recoger y volver o al visitar otra integración; no añade preferencias en disco. Los eventos y nuevas respuestas no cambian la pestaña, no abren ventanas ni fuerzan el foco. Las pestañas admiten flechas y Home/End, con semántica tablist/tab/tabpanel. Al cambiar, la lectura empieza arriba del nuevo panel; no hay dos columnas estrechas ni contenido duplicado.

La elección reside en main. Solo Resumen visible recibe la última respuesta antes de IPC y permite la recuperación local o el acceso a contexto seleccionado. Cambiar a Actividad invalida revisiones/lecturas pendientes de contexto y descarta respuestas tardías; conserva asociaciones autorizadas en RAM para recuperarlas al volver. Actividad, Permisos, otras integraciones, cápsula recogida, ventana oculta/minimizada, Pausa y Presentación no reciben el texto de la última respuesta. Los permisos conservan la ruta exclusiva ya existente.

Se retiran de Actividad las tarjetas de respuesta/resumen y los mensajes explicativos repetidos. El resumen utiliza únicamente datos observados: no genera otro resumen con un modelo ni inventa pruebas o cambios atribuidos a Codex. Abrir Codex permanece accesible.

Verificación: prueba de privacidad actualizada para redacción en Actividad y estado anterior sin pestaña. Recorrido Electron y EXE extraído comprueban dos pestañas, separación real del DOM, comandos/última respuesta, estado vacío, permisos, teclado, geometría estable, contexto exclusivo de Resumen y todas las regresiones previas. Evidencia final local: `docs/evidence/codex-tabs-deployment.json`.

Sin API/modelos, nuevos hooks, cambios de confianza/cuentas, detener Codex o commit/push. Las pruebas usan eventos y proveedores aislados; los límites físicos y de correo/calendario reales se mantienen.

Entrega: **757 pruebas/65 archivos**, recorrido Electron y EXE extraído con salida cero. Desktop/ZEN.exe idéntico al portable probado: `49D903E70EABF35D3A412C05F78A996E3BF21D4E1E6F5A1475F0FF7D847878E3`. Bundle/arranque/observador único, cuentas y configuración protegida verificados en el recibo de entrega.
