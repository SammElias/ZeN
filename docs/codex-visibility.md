# Visibilidad de Codex en ZEN — 22/10/2026

La aclaración del usuario mantiene a **Codex como ejecutor**. La extensión oficial de ChatGPT únicamente permite a Codex utilizar el navegador. No se crea otra extensión, navegador, chat, proyecto ni canal de control del equipo.

## Uso

- La cápsula prioriza la sesión con permiso pendiente, después una sesión trabajando y después las demás. La flecha vuelve a ese chat exacto de Codex; la bandeja y el nuevo atajo `Ctrl+Alt+C` utilizan la misma selección. `Ctrl+Alt+Z` continúa mostrando la cápsula. Ambos atajos son editables y se restauran si el cambio de registro falla.
- Al desplegar se ven el nombre del chat, la clase de herramienta y las tres acciones observadas más recientes. Navegador, control visual, comandos y edición de archivos se distinguen por la identidad de la herramienta, sin interpretar narraciones ni código para inventar fases.
- La conexión se comprueba mediante lecturas locales de cuenta y `hooks/list`. Se diferencia falta de instalación, confianza pendiente, hooks desactivados, configuración preparada y comprobación no disponible. La hora de comprobación es accesible; «preparado» no afirma conexión continua con la aplicación ni ejecución en curso. Eventos antiguos no acreditan actividad actual.
- Los títulos opcionales proceden de `thread/read` con `includeTurns:false`, solo para identificadores recibidos en hooks y un máximo de seis por comprobación. No se usa el preview del mensaje, no se cargan turnos, no se reanuda ningún chat y no se envían nuevas tareas. Si falla, permanece la etiqueta de carpeta observada.
- Solo los permisos, errores y finales de turno generan avisos. Los finales y errores del mismo turno no se notifican dos veces. El contador indica avisos sin leer y se limpia al abrir Avisos. La cápsula permite silenciar sonidos directamente. «Probar aviso» en Preferencias prueba el sonido local y solicita una notificación de Windows.
- Los permisos completos de un uso siguen en la ventana independiente de revisión, con la opción de devolverlos a Codex. Los permisos propios de la extensión y los controles de detener tareas permanecen en Codex. ZEN no simula esos controles.

## Verificación

Build de producción, **424 pruebas en 48 archivos** y recorrido nativo con eventos sintéticos pasan. El recorrido verifica retorno al identificador exacto sin abrir la aplicación real durante la prueba, tres acciones recientes, silencio, confianza pendiente visible, permisos aislados, respuesta exacta, revocación y contador leído. Las pruebas del lector comprueban que se soliciten solo cuenta, hooks y metadatos sin historial, descartando previews e identidades de cuenta.

Una consulta real de Codex con el usuario actual devolvió cuenta ChatGPT y **10/10 hooks confiados y habilitados**. ZEN no modificó registros de confianza. No se generó ninguna respuesta de modelo ni se importaron conversaciones. Evidencia: `docs/evidence/companion-connection-read.json`.

El recorrido de Electron utiliza el auxiliar .NET y pipe reales con eventos sintéticos; no prueba control físico del navegador, clic/foco/DPI, sonido oído ni entrega de notificaciones de Windows. Se conserva esta distinción en las evidencias del portable. La extensión oficial no ha sido alterada.

La entrega mantiene un único `Desktop/ZEN.exe`; compilaciones y respaldo anterior en `release`. Evidencia de entrega: `docs/evidence/codex-visibility-deployment.json`. Recursos Coucou con los avisos de licencia ya incluidos, para adaptación local.

Fuentes consultadas: [hooks de Codex](https://learn.chatgpt.com/docs/hooks), [extensión de navegador](https://learn.chatgpt.com/docs/chrome-extension), [notificaciones](https://learn.chatgpt.com/docs/notifications). Los esquemas de solo lectura se contrastaron con el protocolo generado por el Codex instalado.
