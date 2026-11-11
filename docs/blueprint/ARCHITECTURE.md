# Arquitectura

## Sistema y patrón

ZEN es una aplicación local Electron con un proceso principal que coordina módulos y auxiliares .NET de operaciones fijas. Un renderer React dibuja la cápsula recogida y su panel desplegable en el mismo `BrowserWindow`. Un preload aislado expone el contrato de ZEN. Knowledge Hub guarda la biblioteca en SQLite local. Codex conserva la identidad, los chats y la ejecución. Windows conserva las sesiones multimedia.

## Componentes y tecnología

| Límite | Responsabilidad | Punto de entrada |
| --- | --- | --- |
| Renderer React y TypeScript | Home, Codex, Sonido, avisos y preferencias | [main.tsx](../../src/renderer/main.tsx) · [CodexCompanion.tsx](../../src/renderer/CodexCompanion.tsx) |
| Preload / IPC Electron + Zod | Métodos cerrados, identidad del frame y validación de entrada | [preload](../../src/preload/companion.ts) · [IPC](../../src/main/companion-ipc.ts) |
| Proceso principal | Ventana, política de visibilidad, estado, efectos y preferencias | [companion-main.ts](../../src/main/companion-main.ts) |
| Conexión con Codex | Cola del chat fijado, hooks por pipe y lectura acotada del historial | [petición](../../src/main/companion-request.ts) · [puente](../../src/main/companion-integration.ts) · [lector](../../src/main/companion-codex-reader.ts) |
| Windows | `Zen.Media` consume sesiones WinRT y `Zen.CompanionDesktop` ayuda a volver a la ventana anterior | [multimedia](../../native/Zen.Media/Program.cs) · [escritorio](../../native/Zen.CompanionDesktop/Program.cs) |

Inicio combina el estado observado de Codex, la reproducción automática de Windows y los avisos recibidos. Para Apuntes, consulta los cuatro registros más recientes de Knowledge Hub por fecha de modificación y abre el lector con el identificador de la nota. La consulta usa la misma biblioteca SQLite y reconoce el formato anterior antes de migrarlo. La migración y la edición siguen ocurriendo en Knowledge Hub.

## Flujos de datos

1. **Enviar:** Home → puente → main valida modo, superficie y destino → CLI local de Codex → recibo del chat. Sin destino configurado, Home prepara el borrador y abre Codex.
2. **Observar:** Codex → auxiliar `Zen.CodexHook` → pipe con token → hub → estado filtrado antes de IPC. En Resumen, el lector puede recuperar una respuesta final del historial local del mismo chat.
3. **Analizar:** la selección explícita pasa a una revisión acotada en main; el envío consume la revisión y registra la correlación en memoria. Una respuesta ajena no la completa.
4. **Sonido:** el observador visible consulta WinRT sin enviar controles. Los controles usan su propia selección, vuelven a validarla y actúan solo tras un clic.
5. **Preferencias:** main carga JSON del perfil, normaliza imágenes y aplica la apariencia a ambas vistas. La posición de la cápsula se guarda por monitor; el panel usa el mismo anclaje.

`src/shared` reúne contratos y funciones puras; `native` auxiliares; `scripts` build y pruebas; `tests` fixtures. El código histórico de chat y agentes propios no forma parte de este arranque. Ver [datos](DATABASE.md) y [propuestas](ROADMAP.md).
