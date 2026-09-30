# ZEN · primera entrega

Asistente de escritorio para Windows con conversación en español, Astra en Responses API y voz Realtime. Su única acción local es abrir Bloc de notas y verificar una ventana visible del proceso permitido, también si ya estaba abierto.

## Arranque

Requisitos: Windows 10/11 con sesión de escritorio interactiva, Node.js **22.12 o superior** (probado con 22.17.1), conexión a Internet y proyecto OpenAI con saldo y acceso a los modelos. No requiere administrador.

```powershell
cd C:\Users\samme\Desktop\ZeN
npm ci
npm run build
npm start
```

`npm run dev` compila y abre Electron; para editar hay que volver a ejecutarlo. No hay servidor de desarrollo ni recarga automática. Se han instalado las dependencias y compilado esta entrega en la carpeta actual.

1. Abre Configuración. Introduce tu clave en el campo de contraseña y pulsa **Guardar clave**. ZEN la cifra con `safeStorage` de Electron / DPAPI de Windows en `key.bin`, bajo `%APPDATA%\ZEN`. Nunca se devuelve desde main al renderer. El campo se vacía al guardarla. La clave del entorno utilizada en las pruebas no se ha copiado a la configuración de ZEN.
2. Conserva `gpt-6-astra` y `gpt-realtime-2.1`, o cambia los modelos explícitamente. Si falta acceso, ZEN muestra un diagnóstico y no sustituye el modelo.
3. Para texto escribe **Abre el Bloc de notas** y pulsa Enviar. La respuesta válida incluye PID y ventana verificada.
4. Para voz, acepta el envío de audio a OpenAI y guarda la configuración. Pulsa **Conversar por voz** o **Ctrl+Alt+Z**. Autoriza el micrófono si Windows lo solicita y di **Abre el Bloc de notas**. Recibirás la respuesta de Realtime después de la verificación. El audio de respuesta es una voz generada por IA.
5. Usa **Detener** para cancelar la tarea, apagar el micrófono y desconectar la voz. Cerrar la ventana la oculta en la bandeja y detiene voz/tarea. Salir desde la bandeja termina la aplicación. ZEN no arranca automáticamente con Windows.

El atajo es configurable usando la sintaxis de aceleradores Electron (`Control+Alt+Z`, por ejemplo). Si está ocupado se conserva el anterior; si el predeterminado no se pudo registrar se avisa. El botón de bandeja «Abrir ZEN» solo muestra la ventana; «Conversar por voz» invoca voz. Cuando ya hay voz activa, el atajo muestra la ventana sin abrir una segunda sesión.

## Límites y privacidad

- Una tarea activa, diez llamadas como máximo y noventa segundos por tarea. Son decisiones de producto ajustables hacia abajo en Configuración.
- Sesión de voz máxima de cinco minutos; cerrar/ocultar la ventana desconecta la captura. Disponible, micrófono activo y voz conectada se muestran por separado.
- La política inicial exige una orden directa y breve (`Abre el Bloc de notas`, `Por favor abre el Bloc de notas`, `Open notepad`). Peticiones indirectas, compuestas, citas y negaciones se bloquean aunque Astra solicite la herramienta. Esta restricción conservadora está implementada; ampliar lenguaje autorizado queda en el backlog.
- No hay acceso general a disco, correo, compras, ratón, teclado, grabación permanente, memoria ni «Hola Zen».
- No hay shell arbitrario para el modelo. El ejecutor usa un script PowerShell fijo incluido con la aplicación, transmitido con `EncodedCommand` para evitar problemas de Unicode y archivos .ps1; no cambia la política de ejecución de Windows. **No es un sandbox para ejecutar código generado.**
- Las conversaciones/transcripciones quedan en memoria de la ventana (100 mensajes); no se guardan en el registro local. El audio se transmite a OpenAI solo durante una sesión explícita. Responses usa `store:false`; esto no es una promesa sobre todas las políticas de retención del proveedor.
- `settings.json`, `key.bin`, `execution.json` quedan en el directorio de datos del usuario, fuera del repositorio. El registro conserva metadatos, errores saneados, usos API y evidencia técnica; limita a 500 eventos y elimina los mayores de siete días al escribir. Configuración permite borrar la clave y el registro.
- Costes estimados: **no calculados** (`null`), sin importes inventados. El registro separa uso de voz, tokens de Astra y herramientas locales. El uso final tras desconectar bruscamente una sesión de voz no se garantiza completo. Comprueba la facturación en OpenAI.
- Sin reintento automático de API ni de la acción Windows. Si una verificación falla después del lanzamiento, comprueba el escritorio antes de volver a pedirla. Detener no cierra aplicaciones ya abiertas.

## Pruebas

```powershell
npm test                 # mocks; no saldo API
npm run build            # tipos y compilación
npm run test:electron    # Electron oculto, IPC, bandeja, DPAPI con clave ficticia
npm run test:windows     # abre Bloc de notas, verifica ventana y reutilización
```

Las dos pruebas siguientes requieren una `OPENAI_API_KEY` ya proporcionada de forma segura al entorno del proceso. No la pegues en el chat ni en un archivo del repositorio. El proyecto no carga `.env` y no necesita `.env.example`.

```powershell
$env:ZEN_LIVE_API='1'     # opt-in explícito; las pruebas pueden consumir saldo
npm run test:api          # acceso a modelos, function calling y credencial Realtime
npm run test:integration  # Astra + Windows y Realtime/WebRTC con audio sintético OpenAI
```

`test:integration` usa `gpt-4o-mini-tts` solo para generar la frase de prueba y `gpt-4o-mini-transcribe` para transcribirla; en la aplicación normal no se usa TTS separado. La prueba recibe audio remoto sin emitirlo por el altavoz. No comprueba tu micrófono, escucha física, pulsación real del atajo ni calidad acústica. Esas pruebas manuales están descritas en [docs/verification.md](docs/verification.md). Los resultados JSON se guardan en `test-results/`, ignorado por Git; la evidencia de esta entrega se conserva saneada en docs/evidence/.

## Diagnósticos

Clave ausente/inválida: vuelve a Configuración. 403/404: verifica acceso al modelo en el proyecto OpenAI. 429: revisa saldo/cuota o espera según el diagnóstico. Conectividad: revisa Internet, proxy/firewall y acceso HTTPS/WebRTC/WSS a OpenAI. Micrófono denegado: activa consentimiento en ZEN y permisos de micrófono de Windows. Sin micrófono: conecta uno y vuelve a invocar. Un modelo de transcripción sin acceso produce un error de voz, sin cambiarlo automáticamente.

Distribución futura necesita instalador, firma y arquitectura de credenciales propia. DPAPI protege una clave personal bajo el usuario de Windows; no permite ocultar una clave compartida en una aplicación distribuida.

Detalles: [arquitectura](docs/architecture.md), [capacidades OpenAI](docs/openai-capabilities.md), [permisos](docs/permissions.md), [verificación](docs/verification.md), [backlog](docs/roadmap.md).
