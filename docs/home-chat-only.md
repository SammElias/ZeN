# Home y Chat · 07/10/2026

Petición vigente del usuario: «deja solo Home y el chat la integración con ChatGPT quítala». Sustituye la ampliación anterior del chat nativo. No se continúa la ampliación de capacidades ni se añade otra voz: se conserva GPT-Live existente.

## Implementado

- Navegación de dos iconos, **Home y Chat**, con contorno morado ajustado a 88 px, teclado y movimiento reducido. Inicio mantiene petición directa, análisis de pantalla y continuar conversación; se retira el acceso al navegador.
- Retirados navegador incrustado, chat nativo con el plan, selector de cuentas/modelos, autorización OAuth, IPC/preload público y mocks dedicados. No existe ruta para vincular ChatGPT ni para inferencia con su plan en la aplicación vigente.
- Runtime SIWC y dependencias directas `jose`, `proper-lockfile` y sus tipos retirados. Los paquetes anteriores y su evidencia se conservan como históricos. Las herramientas API de búsqueda/navegación de lectura siguen disponibles en el chat ZEN; no son un navegador incrustado ni una conexión de cuenta ChatGPT.
- Chat principal, GPT-Live, capturas manuales/automáticas, archivos, Codex, aprobaciones y preferencias conservados. Ambos JSON exactos sin cambios; no se modificó el agente remoto ni se hicieron nuevas llamadas de modelo.
- Borrador de texto conservado al plegar y volver a desplegar; la prueba detectó la pérdida anterior y se guardó el borrador antes de desmontar el compositor. No se redimensiona por delta.

## Probado

- Build TypeScript/Vite y **302 pruebas en 35 archivos**. Se retiraron las pruebas dedicadas a las funcionalidades eliminadas.
- Edge real: exactamente Home/Chat, API de cuenta/navegador ausente del preload, ausencia de paneles y accesos de cuenta, borradores entre secciones y plegado, voz/reunión conservadas, teclado, ancho de 380 px y movimiento reducido. `docs/evidence/navigation-ui.json`.
- Regresión de conversación y streaming: DOM/cabecera/altura estables, voz simulada, capturas, aprobaciones, proyectos, adjuntos y preferencias. Sin llamadas API. `docs/evidence/ui-current.json` y `conversation-ui.json`.
- Paquete Electron/Windows real: `homeChatOnlyVerified`, aislamiento, protección de secretos, cápsula, voz/flujo simulado y restantes comprobaciones de interfaz. El registro del atajo puede estar ocupado por la versión anterior abierta; el binario final se prueba tras retirarla.
- EXE único extraído y arrancado en Windows tras cerrar solo el árbol de la versión anterior de ZEN: todas las comprobaciones pasan, `remainingChecks:[]`. Entregado en `C:\Users\samme\Desktop\ZEN.exe`, con respaldo del anterior dentro de `release/desktop-backups`. Evidencia y SHA256 en `docs/evidence/home-chat-single.json` y `home-chat-desktop.json`.

## Cuenta retirada

La cuenta y sus credenciales se almacenaban exclusivamente en `AppData\Roaming\ZEN\chatgpt`, fuera del repositorio. Se intentó desconectar con el runtime oficial: el proceso auxiliar no pudo descifrar la protección del proceso original. Computer Use localizó la ventana ZEN, pero Windows rechazó los clics con `point ... is over ChatGPT.exe ... not target window ZEN.exe`. No se ejecutó el clic sobre la otra aplicación, no se mostraron ni exportaron tokens y no se atribuye revocación remota a estos intentos.

Las dos credenciales locales de esta integración se han retirado antes de sustituir el ejecutable, comprobando que `key.bin` conserva su hash y que no queda el archivo de cuenta. Configuración API, perfil, tareas y demás preferencias conservados. `docs/evidence/chatgpt-removal-account.json`. **Revocación remota pendiente de confirmación**: el usuario puede desconectar ZEN en [ChatGPT → Uso](https://chatgpt.com/settings/usage). El ejecutable nuevo no contiene código ni credenciales para usar ese permiso.

El objetivo general de ZEN mantiene los pendientes físicos y funcionales documentados en `objective-verification.md`; esta entrega no declara todas las funciones validadas.
