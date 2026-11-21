# Instalación y despliegue

Contraseñas usa los auxiliares .NET 10 `Zen.VaultClipboard` y `Zen.VaultHello`, compilados y empaquetados por el flujo habitual. Para respaldar o trasladar la bóveda, bloquea la sección, cierra ZEN y copia `%APPDATA%\ZEN\passwords.kdbx`. Ábrela con su contraseña maestra en el otro equipo. El archivo de Windows Hello pertenece al equipo donde se activó. Las exportaciones generales excluyen ambos archivos y las pruebas usan perfiles sintéticos.

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
pwsh -NoProfile -File scripts/prepare-openweather-brand.ps1
npm run package:win
$paquete = Get-Content -Raw docs/evidence/portable-shell.json | ConvertFrom-Json
npm run package:single -- $paquete.destination
```

El portable se genera en `release/single-file/ZEN.exe`. Para trabajar en el repositorio, ejecuta `npm run build:native` y `npm run dev`. Para arrancar un bundle ya compilado, usa `npm start`. `npm run build` verifica tipos y genera los bundles de producción.

El paso `prepare-openweather-brand.ps1` descarga los logotipos de atribución de Clima desde el paquete oficial de OpenWeather cuando hacen falta. Los recursos de marca del proveedor se guardan en `public/icons/` para la compilación. [Atribución de OpenWeather](https://openweathermap.org/faq)

Para regenerar los recursos de marca desde el PNG original, ejecuta `node scripts/app-icons.mjs` con Microsoft Edge instalado. `public/icons/zen.ico` es el recurso común del ejecutable, el portable, la ventana, la bandeja y el favicon. `public/icons/zen-256.png` alimenta el componente de marca.

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

Sin chat fijado, ZEN prepara un borrador para enviar desde Codex. Con chat fijado, la entrega directa requiere un CLI que admita `queue` y una versión de Codex de escritorio que pueda reactivar ese chat desde el enlace de ZEN.

## 04 · Trasladar datos y preferencias ![](assets/violeta.svg)

1. En el equipo de origen, abre **Preferencias → Datos y configuración → Exportar copia**. Guarda el archivo `.zen-backup.json`.
2. Transfiérelo por un canal privado. Incluye biblioteca, carpetas, imágenes, borrador guardado, eventos locales de Calendario, apariencia, fondo, atajos y preferencias portables de la cápsula.
3. En el equipo de destino, abre la misma sección y elige **Importar copia**. Revisa la confirmación. ZEN guarda la copia anterior en `%APPDATA%\ZEN\backups` antes de sustituir biblioteca y preferencias.
4. Comprueba tus atajos y configura Codex en el destino. Las sesiones, credenciales, hooks, chat fijado y posiciones de pantalla son propios de cada instalación.

En **HUB → Respaldo y exportación → Restaurar biblioteca** puedes abrir tanto un respaldo del HUB como una copia completa de ZEN. Esa acción recupera la biblioteca. Usa **Ajustes → Datos y configuración → Importar copia** para recuperar también el borrador y las preferencias. El respaldo completo es JSON sin cifrar. [Seguridad](SECURITY.md)

Las copias nuevas incluyen los templates, sus referencias y sus miniaturas. La copia completa también incluye el borrador de Templates. Al importar una copia antigua sin galería, ZEN conserva los templates locales. Usa una versión que incluya Templates en el equipo de destino para recuperar la nueva galería.

Las copias de HUB y de ZEN incluyen las fichas guardadas de Descubrimiento de apps. Para recuperarlas, usa una versión con Descubrimiento. Una copia anterior a esa función conserva las fichas que ya existan en el equipo de destino.

Para activar **HUB → Traductor**, crea o utiliza un recurso de **Azure Translator** en región **Global**. En el portal, abre **Claves y punto de conexión** del recurso y copia una de sus dos claves en el campo **Clave de Azure** de ZEN. Cada instalación guarda su clave cifrada en su perfil. [Configurar Azure Translator](https://learn.microsoft.com/en-us/azure/ai-services/translator/how-to/create-translator-resource)

## 05 · Verificar, actualizar y revertir ![](assets/ambar.svg)

- Valida el artefacto con `node scripts/single-file-smoke.mjs release/single-file/ZEN.exe` y comprueba su SHA-256 con `Get-FileHash .\release\single-file\ZEN.exe -Algorithm SHA256`. Los informes de empaquetado se generan en `docs/evidence/`. [Pruebas](TESTING.md)
- Para actualizar, sal de ZEN desde la bandeja, conserva una copia del EXE anterior en `release/` y reemplaza el ejecutable. Si se ha pedido instalarlo en el escritorio, entrega solo `ZEN.exe`. Comprueba el hash y el arranque sin reiniciar Codex.
- Los accesos directos de ZEN deben apuntar al `ZEN.exe` portable. La ventana comunica esa ruta a Windows para que el botón de la barra de tareas pueda mostrar el icono y volver a abrir ZEN después de salir.
- Si falla el arranque, cierra ZEN y restaura el EXE anterior. Para recuperar datos tras una importación, importa la copia que ZEN guardó en `backups` con una versión compatible.
- Antes de publicar, revisa qué archivos se subirán. El repositorio admite fuentes y documentación revisadas. El EXE se distribuye como activo de Release únicamente cuando se autoriza esa entrega. [Reglas de trabajo](../AGENTS.md)
- Templates incluye treinta vistas previas originales de interfaces empresariales, con prompts para Power Apps Canvas y React. Cada usuario puede añadir sus referencias en HUB.

## 06 · Conectar Oura Ring

1. En el [portal de desarrolladores de Oura](https://developer.ouraring.com/), inicia sesión y crea una aplicación, por ejemplo `ZEN Métricas`. Si pide un sitio web, usa `https://github.com/SammElias/ZeN`.
2. Añade las URL públicas de la [política de privacidad](OURA_PRIVACY_POLICY.md) y los [términos de servicio](OURA_TERMS_OF_SERVICE.md) de tu aplicación. Registra como URI de redirección exacta `http://localhost:46328/oura/callback`. Tras crear la aplicación, copia el **Client ID**.
3. En ZEN, abre **Métricas**, pega el **Client ID** y pulsa **Conectar Oura**. Acepta el permiso de métricas diarias en el navegador que se abre en el mismo PC. Si Oura rechaza la conexión, la página de retorno y Métricas muestran el motivo del rechazo.
4. Cuando caduque la sesión, vuelve a conectar desde Métricas con el **Client ID** ya rellenado. Oura documenta que su flujo para clientes públicos carece de renovación automática. Si el puerto 46328 está ocupado, ZEN informa del fallo y puedes intentarlo al liberarlo.

ZEN solicita solo `daily`. Guarda el Client ID público al pulsar **Conectar Oura**, incluso si se cancela o falla la autorización. **Desconectar Oura** elimina la sesión y la caché del perfil cifrado y conserva el Client ID. La autorización concedida al cliente también se puede retirar desde la cuenta de Oura. [Autenticación de Oura](https://cloud.ouraring.com/docs/authentication)
