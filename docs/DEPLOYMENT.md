# Instalación y despliegue

## 01 · Instalar en otro equipo ![](assets/verde.svg)

1. En Windows x64, descarga `ZEN.exe` de la [última versión de ZEN](https://github.com/SammElias/ZeN/releases/latest). La sección siguiente explica cómo compilar desde el código de GitHub.
2. Instala **.NET Runtime 10 x64** para los auxiliares. Para usar Codex, instala su aplicación e inicia sesión en ese equipo. [Descargas de .NET 10](https://dotnet.microsoft.com/es-es/download/dotnet/10.0)
3. Ejecuta `ZEN.exe`. Busca el icono en la bandeja de Windows o pulsa `Ctrl+Alt+Z` con el atajo inicial.
4. Para observar actividad, abre **Preferencias → Conexión y diagnóstico de Codex → Preparar integración**. Revisa los hooks de ZEN con `/hooks` en el CLI de Codex.

## 02 · Compilar desde GitHub ![](assets/azul.svg)

Necesitas Windows x64, Git, PowerShell 7, Node.js 22.12 o posterior y .NET SDK 10. El lockfile fija las dependencias.

```powershell
git clone https://github.com/SammElias/ZeN.git
Set-Location ZeN
npm ci
npm run package:win
$paquete = Get-Content -Raw docs/evidence/portable-shell.json | ConvertFrom-Json
npm run package:single -- $paquete.destination
```

El portable se genera en `release/single-file/ZEN.exe`. Para trabajar en el repositorio, ejecuta `npm run build:native` y `npm run dev`. Para arrancar un bundle ya compilado, usa `npm start`. `npm run build` verifica tipos y genera los bundles de producción.

## 03 · Configurar el equipo ![](assets/turquesa.svg)

ZEN guarda el perfil en `%APPDATA%\ZEN`. El flujo activo usa la cuenta iniciada en Codex y puede arrancar sin configurar variables. `CODEX_HOME` es opcional y selecciona la raíz de Codex. El valor por defecto es `.codex` en el perfil del usuario.

Para fijar un chat, guarda `companion-target.json` en `%APPDATA%\ZEN` con los valores del usuario de destino. Usa el identificador real del chat, la ruta de su carpeta y un nombre legible. ZEN comprueba la relación entre chat y carpeta. Ejemplo de estructura con valores ficticios:

```json
{
  "session": "00000000-0000-4000-8000-000000000001",
  "cwd": "C:\\Proyectos\\MiProyecto",
  "title": "Mi chat"
}
```

Sin chat fijado, ZEN prepara un borrador para enviar desde Codex. Con chat fijado, la entrega directa requiere un CLI que admita `queue`.

## 04 · Trasladar datos y preferencias ![](assets/violeta.svg)

1. En el equipo de origen, abre **Preferencias → Datos y configuración → Exportar copia**. Guarda el archivo `.zen-backup.json`.
2. Transfiérelo por un canal privado. Incluye biblioteca, carpetas, imágenes, borrador guardado, apariencia, fondo, atajos y preferencias portables de la cápsula.
3. En el equipo de destino, abre la misma sección y elige **Importar copia**. Revisa la confirmación. ZEN guarda la copia anterior en `%APPDATA%\ZEN\backups` antes de sustituir biblioteca y preferencias.
4. Comprueba tus atajos y configura Codex en el destino. Las sesiones, credenciales, hooks, chat fijado y posiciones de pantalla son propios de cada instalación.

Las copias anteriores de la biblioteca se restauran en **Apuntes → Respaldo y exportación**. El respaldo completo es JSON sin cifrar. [Seguridad](SECURITY.md)

## 05 · Verificar, actualizar y revertir ![](assets/ambar.svg)

- Valida el artefacto con `node scripts/single-file-smoke.mjs release/single-file/ZEN.exe` y comprueba su SHA-256 con `Get-FileHash .\release\single-file\ZEN.exe -Algorithm SHA256`. Los informes de empaquetado se generan en `docs/evidence/`. [Pruebas](TESTING.md)
- Para actualizar, sal de ZEN desde la bandeja, conserva una copia del EXE anterior en `release/` y reemplaza el ejecutable. Si se ha pedido instalarlo en el escritorio, entrega solo `ZEN.exe`. Comprueba el hash y el arranque sin reiniciar Codex.
- Si falla el arranque, cierra ZEN y restaura el EXE anterior. Para recuperar datos tras una importación, importa la copia que ZEN guardó en `backups` con una versión compatible.
- Antes de publicar, revisa qué archivos se subirán. El repositorio admite fuentes y documentación revisadas. El EXE se distribuye como activo de Release únicamente cuando se autoriza esa entrega. [Reglas de trabajo](../AGENTS.md)
