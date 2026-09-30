# ZEN · isla superior para Windows

Asistente Electron + React + TypeScript con el agente guardado **ZeN / gpt-6.1-sol**, voz Realtime, memoria personal editable, tareas en segundo plano y operaciones Windows verificadas. El objetivo completo sigue incompleto; consulta [implementación, pruebas y bloqueos](docs/objective-verification.md).

## Probar

La ruta portable más reciente figura en [portable-package.json](docs/evidence/portable-package.json), campo executable. Ejecuta ZEN.exe desde su carpeta completa: arranca como isla de **320×48 DIP**, anclada arriba y sin tomar foco. Haz clic en ZEN o pulsa **Ctrl+Alt+Z** para desplegar. La isla contiene Actividad, Tareas y Contexto; muestra el stream público y los resultados. **Preferencias** se abre por separado desde la bandeja de Windows. [Primera versión compacta y pruebas](docs/island-v1.md). Requiere Windows interactivo y **.NET Desktop Runtime 10** para el auxiliar Windows. Electron va incluido; el paquete no contiene claves ni datos personales. No es un instalador firmado.

Compilación: Node 22.12 o superior y .NET SDK 10.

```powershell
cd C:\Users\samme\Desktop\ZeN
npm ci
npm run build:native
npm run build
npm start
```

1. La configuración existente se conserva. Si falta la conexión, abre Preferencias desde la bandeja; la clave personal se protege con safeStorage/DPAPI. La clave de entorno de las pruebas no se copia a ZEN. Requiere acceso a Agents API y al agente configurado en config/.
2. Prueba «Abre el Bloc de notas», «Abre https://www.microsoft.com» o una búsqueda con fuentes. Órdenes locales breves se ejecutan mediante política determinista; las narraciones del modelo no ejecutan Windows.
3. Contexto permite elegir una ventana, revisar texto o captura y adjuntarlo a la siguiente petición. Abrir aplicaciones, páginas, archivos y pausar medios sigue disponible mediante peticiones autorizadas al agente.
4. Para crear carpeta/archivo nuevo, elige directorio en Contexto, pide al agente que prepare la creación y revisa la tarjeta antes de Permitir. No sobrescribe archivos.
5. El perfil personal queda en Preferencias: revisa, corrige, exporta o borra datos. El perfil inicial está vacío.
6. Voz requiere consentimiento existente. **Modo reunión** silencia respuestas; Preferencias permite resultados discretos sin foco. Push-to-talk conecta silenciado: mantén el botón o Ctrl+Espacio con ZEN enfocado para hablar; soltar o cambiar de ventana silencia. **Detener** cancela tareas, voz y nuevas operaciones/capturas, sin deshacer efectos existentes; también está disponible en la isla recogida cuando hay trabajo activo. Esc oculta y desconecta voz conservando investigación y resultados. Tareas permite continuar una sesión o cancelar una tarea concreta.

## Límites y privacidad

El agente guardado conserva web_search y añade zen_desktop con autorización específica. Su puente ejecuta operaciones verificadas sujetas a política y capacidades elegidas; no controla arbitrariamente Windows ni ejecuta acciones narrativas de su JSON. Aplicaciones disponibles: Windows App Paths; visor: txt/md/json/csv/png/jpg/jpeg hasta 2 MB. No hay shell generado, envíos, compras, borrados o sobrescrituras; tampoco activación permanente «Hola Zen» o detección automática fiable de llamadas Teams.

Dos tareas informativas simultáneas por defecto (configurable 1–3), hasta ocho pendientes (configurable 1–10), prioridad alta/normal/baja y 90 segundos por tarea; efectos locales serializados. El límite de diez herramientas se aplica a llamadas locales antes de ejecutar y búsquedas según eventos observados; no es presupuesto duro del servidor. Pausa frena nuevos efectos, mientras investigación puede terminar. El máximo monetario por sesión sigue pendiente; registra uso recibido sin inventar importes. Reiniciar no reproduce efectos pendientes.

Capturas de ventanas seleccionadas expiran en dos minutos y no se guardan en disco por defecto. Perfil y resultados de tareas sí persisten localmente y pueden contener texto solicitado. Agents API crea sesiones remotas; no se promete retención nula del proveedor. No importa memoria de ChatGPT ni graba reuniones automáticamente.

## Pruebas reproducibles

```powershell
npm test
npm run build:native
npm run build
npm run test:objective
npm run test:native
npm run test:ui
npm run package:win
```

Las pruebas API reales requieren autorización y OPENAI_API_KEY segura en el entorno; consumen saldo. test:agent utiliza la clave presente; test:integration también exige ZEN_LIVE_API=1. No pegues claves en el chat ni en el repositorio.

```powershell
npm run test:agent
$env:ZEN_LIVE_API='1'
npm run test:integration
```

ZEN_TEST_MEDIA=1 amplía test:native con un reproductor silencioso de prueba; ZEN_TEST_VISION=1 añade imagen enviada a OpenAI. ZEN_TEST_INTERRUPT=1 amplía integración con interrupción durante investigación. Audio sintético no acredita micrófono/altavoz físicos ni una reunión real. Evidencia saneada en docs/evidence; test-results/ y release/ excluidos de Git.

GPT-Live conserva el JSON exacto del guion en [docs/handoffs](docs/handoffs/order.md), pendiente de terminar requisitos anteriores según el orden solicitado. Voz activa: Realtime.
