# Entorno y configuración

## Desarrollo en Windows

- Node.js 22.12 o superior, dependencias del `package-lock.json` con `npm ci`.
- .NET SDK 10 para compilar auxiliares; .NET Runtime 10 para ejecutarlos.
- Codex de escritorio instalado y una sesión iniciada para la operación normal. El CLI local debe admitir `queue` para el envío directo.
- Una aplicación que publique su sesión de Windows para mostrar título y controles de reproducción.

## Configuración local

| Clave o ubicación | Uso |
| --- | --- |
| `CODEX_HOME` | Raíz opcional de la instalación de Codex. Sin valor explícito, ZEN usa `.codex` del usuario. |
| `%APPDATA%\ZEN` | Perfil estable: preferencias, geometría, fondo y vínculo al chat. |
| `companion-target.json` | Chat y carpeta fijados, mantenidos localmente. No incluir valores reales en documentación o fixtures. |
| `dist/`, `release/` | Bundles de compilación y paquetes locales; no son configuración de usuario. |

Para fijar un chat, `companion-target.json` contiene `session`, `cwd` y `title`, por ejemplo `{ "session": "identificador-del-chat", "cwd": "C:\\ruta\\al\\proyecto", "title": "Mi chat" }`. ZEN comprueba que coincidan el chat y la carpeta.

No añadir variables de servicios históricos como requisito de arranque del compañero actual. Ejecutar pruebas con directorios temporales y datos sintéticos. Ver [uso](UX_FLOWS.md), [datos](DATABASE.md) y [entrega](DEPLOYMENT.md).
