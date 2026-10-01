# ZEN · isla superior para Windows

Asistente Electron + React + TypeScript con el agente guardado **ZeN / gpt-6.1-sol**, voz GPT-Live, memoria personal editable, tareas en segundo plano y operaciones Windows verificadas. El objetivo completo sigue incompleto; consulta [implementación, pruebas y bloqueos](docs/objective-verification.md).

## Probar

Voz activa: GPT-Live (gpt-live-1 / echo), tareas delegadas a gpt-6.1-sol. JSON exacto, pruebas y límites en [live-status.md](docs/live-status.md). El portable actual incluye esta revisión; los ejecutables anteriores conservan Realtime.

Al llamar a ZEN con **Ctrl+Alt+Z**, desde la bandeja o al iniciar la voz, prepara automáticamente una captura de la ventana como referencia para SOL. La cápsula muestra su disponibilidad. Sin captura continua ni guardado local; [alcance, privacidad y pruebas](docs/screen-context.md).

Crear proyectos o carpetas pasa a **Codex**, con avance visible y una revisión sencilla de archivos y ubicación. Puedes volver a hablar con ZEN mientras trabaja. [Cómo usarlo y qué está probado](docs/codex-projects.md).

**Portable compilado por petición explícita del usuario el 01/10/2026:** `release/ZEN-20261001095454813/ZEN.exe`. Conserva la carpeta completa. Incluye GPT-Live, contexto visual de la ventana detrás de la cápsula, actualización con título visible, voz estable y proyectos con Codex; 228 pruebas y comprobación real de arranque/interfaz aprobadas. [Evidencia del paquete](docs/evidence/portable-interface.json). Las pruebas físicas y el recorrido funcional completo siguen pendientes.

El ejecutable actual figura en [portable-interface.json](docs/evidence/portable-interface.json), campo executable. Ejecuta ZEN.exe desde su carpeta completa: arranca como cápsula de **640×48 DIP**, anclada arriba. Arrastra la cabecera o el personaje hacia los lados o a otra pantalla: sigue en el borde superior y guarda la posición. Haz clic en ZEN o pulsa **Ctrl+Alt+Z** para desplegar un **panel de 1120×210 DIP** que muestra únicamente la última intervención de Tú/ZEN y su stream, sin historial ni campo de escritura. Ambos anchos se ajustan a pantallas pequeñas. Adjuntar contexto abre una revisión opcional desde el clip del panel; las aprobaciones concretas aparecen en la conversación. **Preferencias** sigue en una ventana separada desde la bandeja de Windows. [Diseño y pruebas](docs/island-v1.md). Requiere Windows interactivo y **.NET Desktop Runtime 10** para el auxiliar Windows. Electron va incluido; el paquete no contiene claves ni datos personales. No es un instalador firmado.

El nuevo ejecutable pasó el arranque, la revisión de interfaz y el movimiento del controlador sobre dos pantallas reales con puntos de cursor sintéticos. Queda pendiente el arrastre manual físico. El recorrido funcional actual falló al conservar foco al abrir página/archivo y al establecer el foco en segundo plano de reunión: [evidencia](docs/evidence/objective-current.json). [portable-package.json](docs/evidence/portable-package.json) conserva la versión anterior que sí pasó el recorrido completo.

Compilación: Node 22.12 o superior y .NET SDK 10.

La isla incluye un compañero original animado, una última intervención legible y sonidos suaves de interfaz. Puedes desactivar sonidos y animaciones en **Preferencias → Aspecto y sonidos**. Los avisos se silencian en reunión, modo texto y durante la voz; las animaciones respetan el movimiento reducido de Windows. Consulta [diseño y verificación](docs/companion-design.md).

```powershell
cd C:\Users\samme\Desktop\ZeN
npm ci
npm run build:native
npm run build
npm start
```

1. La configuración existente se conserva. Si falta la conexión, abre Preferencias desde la bandeja; la clave personal se protege con safeStorage/DPAPI. La clave de entorno de las pruebas no se copia a ZEN. Requiere acceso a Agents API y al agente configurado en config/.
2. Prueba «¿Puedes abrirme Google?», «Abre el Bloc de notas», «¿Puedes pausar la música?» o una búsqueda con fuentes. La pausa no requiere activar permisos multimedia adicionales; identifica el único reproductor compatible. Si nombras YouTube y Windows solo identifica el navegador, usa el clip → Ver reproductores → Pausar este reproductor. Órdenes locales breves se ejecutan mediante política determinista; las narraciones del modelo no ejecutan Windows.
3. El clip del panel permite elegir una ventana, revisar texto o captura y adjuntarlo a la siguiente petición. Abrir aplicaciones, páginas, archivos y pausar medios sigue disponible mediante peticiones autorizadas al agente.
4. Para crear carpeta/archivo nuevo, elige directorio desde el clip del panel, pide al agente que prepare la creación y revisa la tarjeta antes de Permitir. No sobrescribe archivos.
5. El perfil personal queda en Preferencias: revisa, corrige, exporta o borra datos. El perfil inicial está vacío.
6. Voz requiere consentimiento existente. **Modo reunión** silencia respuestas; Preferencias permite resultados discretos sin foco. Push-to-talk conecta silenciado: mantén el botón o Ctrl+Espacio con ZEN enfocado para hablar; soltar o cambiar de ventana silencia. **Detener** cancela tareas, voz y nuevas operaciones/capturas, sin deshacer efectos existentes; también está disponible en la isla recogida cuando hay trabajo activo. Esc oculta y desconecta voz conservando investigación y resultados. La nueva intervención sustituye a la anterior; las aprobaciones pendientes conservan su revisión concreta.

## Límites y privacidad

Biblioteca local autorizada: `C:\Users\Gamming\Desktop` y `C:\Users\samme\Desktop`. No se suben completas. «Busca localmente presupuesto en mis archivos» y «Lee localmente C:\Users\samme\Desktop\nota.txt sin API» entregan resultados al panel sin enviar contenido de archivos al razonamiento ni al TTS; hablar la petición sigue usando transcripción remota. Para interpretación por modelo se envían solo fragmentos pertinentes. La lectura actual admite texto UTF-8; extracción de PDF/Word/Excel pendiente. Codex ha implementado este módulo dentro de ZEN; no hay delegación permanente a este chat.

El agente guardado conserva web_search y zen_desktop, y añade tool_search, zen_files y zen_cloud con autorización específica. [Herramientas implementadas, pruebas y límites](docs/toolkit-status.md). Su puente ejecuta operaciones verificadas sujetas a política y capacidades elegidas; no controla arbitrariamente Windows ni ejecuta acciones narrativas de su JSON. Aplicaciones disponibles: Windows App Paths; visor: txt/md/json/csv/png/jpg/jpeg hasta 2 MB. El shell y el código generado solo se ejecutan en contenedores alojados aislados, sin red ni montaje de archivos del PC. No hay shell local arbitrario, envíos, compras, borrados o sobrescrituras; tampoco activación permanente «Hola Zen» o detección automática fiable de llamadas Teams.

Una tarea informativa activa por defecto (configurable 1–3), hasta ocho pendientes (configurable 1–10), prioridad alta/normal/baja y 90 segundos por tarea; efectos locales serializados. El límite predeterminado de cuatro herramientas se aplica a llamadas locales antes de ejecutar y búsquedas según eventos observados; no es presupuesto duro del servidor. Pausa frena nuevos efectos, mientras investigación puede terminar. El máximo monetario duro por sesión sigue pendiente; el contador mensual conserva reservas si falta el uso recibido. Reiniciar no reproduce efectos pendientes.

Capturas de ventanas seleccionadas expiran en dos minutos y no se guardan en disco por defecto. Perfil y resultados de tareas sí persisten localmente y pueden contener texto solicitado. Agents API crea sesiones remotas; no se promete retención nula del proveedor. No importa memoria de ChatGPT ni graba reuniones automáticamente.

## Pruebas reproducibles

Estado actual: 228 pruebas en 24 archivos, build, interfaz Edge y Electron/Windows pasados. Pruebas reales de web, biblioteca sintética, código, shell alojado, skill propio, parche en memoria, imagen, navegador visual y MCP público: [evidencias y alcance](docs/toolkit-status.md). El recorrido completo y las pruebas físicas siguen pendientes. Ejecutar las pruebas de Windows por separado.

```powershell
npm test
npm run build:native
npm run build
npm run test:objective
npm run test:native
npm run test:ui
```

Las pruebas API reales requieren autorización y OPENAI_API_KEY segura en el entorno; consumen saldo. test:agent utiliza la clave presente; test:integration también exige ZEN_LIVE_API=1. No pegues claves en el chat ni en el repositorio.

```powershell
npm run test:agent
$env:ZEN_LIVE_API='1'
npm run test:integration
```

ZEN_TEST_MEDIA=1 amplía test:native con un reproductor silencioso de prueba; ZEN_TEST_VISION=1 añade imagen enviada a OpenAI. ZEN_TEST_INTERRUPT=1 amplía integración con interrupción durante investigación. Audio sintético no acredita micrófono/altavoz físicos ni una reunión real. Evidencia saneada en docs/evidence; test-results/ y release/ excluidos de Git.

GPT-Live está integrado ahora por petición explícita del usuario. La configuración vigente exacta está en config/live-session.json; el handoff anterior permanece íntegro como referencia histórica. [Pruebas y límites](docs/live-status.md).
## Pago por uso

Modo ahorro y contador mensual local: [costes de API](docs/api-costs.md). Por defecto, máximo mensual estimado de 100 EUR y objetivo diario orientativo de 1 EUR, editables en Preferencias. No son cuotas ni garantizan un máximo de factura.
