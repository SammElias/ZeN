# ZEN apoyado en la bienvenida

Petición del 09/10/2026: mostrar el personaje detrás de «¿Qué hacemos hoy?», apoyado con las dos manos y profundidad. La captura señala Inicio; el chat con mensajes conserva su escenario lateral.

## Recurso

`public/mascot/welcome-leaning.png`: nueva pose transparente de 1145×1374, creada con la herramienta imagegen incorporada a partir de `zen_mascota_kit/references/zen-base-actual.png`. Los originales no se retocaron ni reemplazaron. Pose grafito con capucha, conservando pelo, rostro, texturas y logo; no es un modelo 3D ni un rig facial. El prompt completo está en `docs/evidence/welcome-image-prompt.txt`.

## Integración

`HomePanel.tsx` reserva el espacio del personaje y mantiene el H1 como texto accesible. `MascotHost` traslada la única presentación a ese anclaje mediante un portal. `MascotWelcome.tsx` compone el mismo recurso en dos regiones: cuerpo detrás del título y dedos delante. El título tiene relieve y sombra de contacto. Las imágenes no interceptan clics. Un fallo de carga conserva una cabeza canónica de respaldo y el título.

No hay llamadas API para pintar, cambiar de vista ni mostrar la pose; la generación del recurso fue una operación de diseño. Inicio utiliza esta pose grafito; el vestuario elegido para la mascota de Chat permanece guardado. La pose no camina ni mueve las manos mientras están apoyadas. Al plegar reaparece la cabeza en la cápsula. Se conserva la conversación, el borrador, las acciones y el compositor.

## Validación

`node scripts/welcome-ui.mjs` comprueba el renderer real con datos de demostración: transparencia, orden de capas, avatar único, navegación, borrador, movimiento reducido y tamaños 320×360, 360×480, 580×480, 640×560 y 960×640. Capturas en `docs/ui-preview/welcome`. Las regresiones `mascot-ui.mjs` y `chat06-ui.mjs` pasan. `mascot-smoke.ts` también captura y comprueba la bienvenida en Electron nativo. La evidencia del paquete indica el alcance de su validación; no acredita voz física ni funciones externas.

La revisión nativa detectó recorte superior cuando coincidían avisos y actividad. El escenario ahora puede reducir su altura al espacio disponible y la prueba comprueba sus límites superior e inferior. Build y 358 pruebas pasan. Los bloqueos intermitentes de Windows al sobrescribir evidencias se resolvieron publicando un archivo temporal completo mediante renombrado y reintentos acotados, solo para artefactos de pruebas; no se repiten acciones del usuario ni solicitudes API.

## Incidencia de clave comunicada durante el trabajo

El perfil local de ZEN no contenía `key.bin`. Se reutilizó la credencial existente ya autorizada, se verificó autenticación con una lectura de modelos y se guardó cifrada por Windows fuera del repositorio. No se generó ninguna respuesta del modelo para esta comprobación y no se imprimió la clave. El error histórico no se borra; una nueva petición vuelve a leer la configuración protegida. Esta comprobación acredita autenticación, no una conversación nueva ni acceso a todas las funciones del agente.

## Entrega

Actualizado el único `C:/Users/Gamming/Desktop/ZEN.exe` y reabierta la aplicación. SHA256 `9BF54C45E6EABF2096FC2A2B3DFCFB3FED960B624DD5BB37F1ED76DBABDC9388`. El archivo extraído pasó el recorrido Electron con la nueva bienvenida. La instancia anterior no tenía tareas pendientes registradas antes del reinicio. El respaldo queda en `release/desktop-backups`, sin nuevas carpetas en la raíz del escritorio. La clave protegida sigue presente tras el reemplazo. No se acredita inspección visual por Computer Use de la instancia personal: las capturas verificadas son de Electron con datos aislados.
