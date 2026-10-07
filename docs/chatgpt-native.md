# ChatGPT conectado a ZEN · 07/10/2026

**Retirado por petición posterior del usuario, 07/10/2026.** El usuario solicita únicamente Home y Chat y quitar esta integración. Este documento conserva evidencia histórica de una versión anterior; no describe el ejecutable vigente. [Retirada y validación actual](home-chat-only.md).

Petición y autorización del usuario: abrir el navegador habitual para vincular su cuenta y usar un **chat nativo dentro de ZEN**. La autorización no cambia el agente guardado ni el JSON GPT-Live.

## Implementado

- Navegación → icono de globo → **ChatGPT en ZEN → Continuar con ChatGPT**. Abre el navegador predeterminado de Windows, permite usar el acceso habitual de la cuenta y recibe el retorno OAuth en `127.0.0.1` con puerto disponible. No requiere copiar un código ni una clave API.
- Registro dinámico oficial para proyectos personales locales. Host estable por instalación, PKCE S256, state, nonce y firma/issuer/audiencia/caducidad de ID token verificados. Registros separados por cuenta y espacio, aunque coincida el correo. Cancelación y renovación serializada; rotación cifrada antes de verificar su identidad. Desconexión con revocación y aviso si no se confirma remotamente.
- Credenciales únicamente en main y protegidas por Windows DPAPI, en los datos privados de ZEN bajo `chatgpt/`. Escritura atómica y bloqueo entre procesos. No se guardan en el repositorio, navegador integrado, renderer, logs ni paquete. El IPC público devuelve estado y etiquetas, nunca tokens.
- Chat nativo por la ruta pública Responses usando **solo el token OAuth** y los permisos concedidos por el usuario. `store:false`, streaming literal y éxito únicamente con `response.completed`. Límites del plan, respuesta incompleta y desconexión se muestran conservando el texto parcial. No hay sustitución silenciosa por la API de pago.
- Modelos descubiertos desde la cuenta, respetando el orden y `visibility:list`. Selección inicial `gpt-6.1-sol`; si no está disponible se pide elegir uno del catálogo, sin cambiar el modelo del agente. Uso y límites abre la página oficial de ChatGPT.
- Último mensaje Tú/ChatGPT, copiar respuesta, detener, nueva conversación y pegado/adjunto explícito de una imagen. Las imágenes se preparan localmente y solo se envían al pulsar Enviar. No se reutiliza una imagen vieja en peticiones posteriores. Contexto de hasta cuatro intercambios completados, acotado en memoria; borrado al cambiar de cuenta, nueva conversación o salida. No se importa historial web.
- Interfaz blanca, negra y morada; altura estable durante deltas, borrador conservado al recoger o pasar al navegador web. La voz GPT-Live, capturas automáticas, herramientas del agente y creación de proyectos con Codex siguen en el chat ZEN. Este chat de cuenta no ejecuta herramientas locales ni hace de puente a efectos Windows.

Runtime oficial local fijado en `f723814abdccec135b519c451fb6e1992ee5e933`, con extensión acotada para imágenes. Su licencia no comercial, origen y licencias de dependencias acompañan el paquete en `dist/notices`. Este uso es el proyecto personal local del usuario; no se acredita habilitación de distribución comercial.

## Probado

- Build TypeScript/Vite y 322 pruebas en 37 archivos, incluidas ocho pruebas de la conexión: proveedor **simulado**, loopback HTTP y criptografía reales. PKCE, callback falso, nonce inválido, permisos de identidad sin plan, mismo correo en registros distintos, cifrado, renovación concurrente, revocación fallida, deduplicación y cancelación antes del envío.
- Streams SSE fragmentados: espacios/deltas literales, respuesta completada, corte prematuro y límite del plan a mitad de respuesta. Petición HTTP sin campos no admitidos ni credenciales API. Contexto aislado entre perfiles e imágenes antiguas no reenviadas.
- Edge real con cuenta/eventos **simulados**: ficha de conexión, imagen manual preparada, último mensaje, altura estable, texto parcial, cero llamadas al agente/API, teclado, borrador, plegado, navegador conservado y vista de 380 px. `docs/evidence/chatgpt-ui.json`.
- Electron/Windows real: IPC local validado, argumentos ajenos rechazados, conexión real deshabilitada en smoke, renderer sin Node, DPAPI disponible y prueba de protección del SO; regresión de cápsula, voz simulada, capturas, proyectos, chat y navegador. `test-results/electron.json`.
- Consulta real, sin credenciales, de discovery OpenID de `auth.openai.com`: issuer, autorización, token, JWKS, revocación y algoritmo RS256 coinciden. **Esto no acredita una autorización ni inferencia real.**
- Paquete portable y EXE único extraídos y arrancados en Electron/Windows real: todas las comprobaciones de interfaz pasan, incluyendo el IPC nuevo y regresiones. Ejecutable entregado en `C:\Users\samme\Desktop\ZEN.exe`; versión anterior preservada en `release/desktop-backups`. Hash, alcance y pendientes en `docs/evidence/chatgpt-desktop.json`, con la prueba del binario exacto en `chatgpt-single.json` y del paquete en `chatgpt-portable.json`.

## Pendiente del usuario / cuenta

1. Abrir el nuevo `C:\Users\samme\Desktop\ZEN.exe`, desplegar, globo → ChatGPT en ZEN → Continuar con ChatGPT.
2. Completar el acceso y consentimiento de OpenAI en el navegador. Si ofrece uso del plan, autorizarlo según sus límites. Si la cuenta/espacio no es elegible o la conexión no está habilitada, ZEN muestra la causa y no consume la clave API como alternativa.
3. Volver a ZEN y enviar una petición breve. Solo una respuesta `completed` acredita inferencia con el plan. Verificar después una imagen, renovación, desconexión y regreso tras reiniciar con la cuenta real.

La creación de Windows Hello sí fue confirmada por el usuario; después informó de que escribir su correo seguía devolviendo a Google. Ese intento web **no quedó resuelto por la passkey**. La integración nativa implementada aquí es un flujo oficial distinto: vincula una cuenta, sin transferir cookies de Chrome ni autenticar la web incrustada.

El objetivo completo de ZEN mantiene los pendientes de `objective-verification.md`, incluida la validación física de voz y otras tareas generales.

Fuentes: [registro y acceso](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [cuentas y renovación](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [modelos e inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [límites de la vista previa](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [integración local oficial](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt).
