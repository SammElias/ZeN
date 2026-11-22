# Servidor personal en otro Windows

El instalador prepara un cliente independiente de ZEN. Usa tu cuenta de Windows y se inicia al entrar en ella. Conserva la instalación en `release/local-tools/Syncthing` y las notas en `%USERPROFILE%\Servidor-personal\Notas`. Git excluye `release/`. Las identidades, contraseñas y notas permanecen en cada equipo.

## Añadir un portátil

1. Instala [Tailscale para Windows](https://tailscale.com/docs/install/windows) e inicia sesión en tu red privada. Clona el repositorio de ZEN desde GitHub y abre PowerShell en la carpeta del proyecto.
2. Obtén la IPv4 de Tailscale de la Raspberry y su ID de Syncthing. Si administras la Raspberry, puedes consultar el ID con el siguiente comando desde un equipo con acceso SSH. Sustituye `IP_TAILSCALE` y `USUARIO_SSH` por los valores de tu servidor.

~~~powershell
$servidor = 'IP_TAILSCALE'
$id = ssh "USUARIO_SSH@$servidor" 'sudo -n -u personal-sync syncthing serve --home=/var/lib/personal-sync --device-id'
~~~

3. Ejecuta el instalador del repositorio. Verifica la huella SHA-256 de cada descarga de GitHub, instala para el usuario actual y prepara solo la carpeta **Notas** con reglas de exclusión.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\setup-personal-sync.ps1 -ServerAddress $servidor -ServerDeviceId $id
~~~

La política se aplica a ese proceso de PowerShell.

4. Autoriza el ID que imprime el instalador en el panel de Syncthing de la Raspberry y comparte **Notas** con ese dispositivo. Autoriza también en el cortafuegos de la Raspberry la IPv4 que la aplicación Tailscale muestra en ese portátil. La guía del servidor en `/usr/local/share/doc/personal-sync/Guia.md` documenta esa regla. Mantén desactivadas las opciones de introductor y aceptación automática de carpetas.
5. Espera a que el portátil figure como **Conectado** y **Al día**. Crea una nota de prueba y comprueba que aparece en la Raspberry. Incorpora otros datos después de revisar qué contienen.

Si el portátil ya tiene un perfil de Syncthing o archivos en la carpeta local **Notas**, revisa esos datos y vincula la Raspberry desde su panel. El script protege el perfil y los archivos que encuentre.

## Vincular el perfil de ZEN

1. En el equipo que tiene tu perfil, abre **Preferencias → Datos y configuración → Sincronización entre equipos**. Pulsa **Crear perfil compartido** y elige la carpeta **Notas** que gestiona Syncthing. ZEN crea `Perfil ZEN` dentro de esa carpeta.
2. Pulsa **Copiar código** y guarda la clave en tu gestor de contraseñas. Espera a que Syncthing entregue los archivos cifrados al portátil. En su ZEN, pega el código del perfil, pulsa **Vincular** y elige la raíz local de **Notas**.
3. El portátil recibe la apariencia, las preferencias y el orden de accesos del perfil compartido. Los elementos propios de la biblioteca se incorporan. Los cambios simultáneos de un mismo elemento aparecen como versiones en la sección de sincronización. Usa **Usar versión** para publicar la que elijas.
4. Si quieres compartir contraseñas, pulsa **Sincronizar bóveda** en cada ZEN vinculado. En un portátil sin bóveda, abre **HUB → Contraseñas** e introduce la maestra de la bóveda de origen. Al desbloquearla, ZEN combina las copias cifradas de la misma bóveda. Las variantes simultáneas de una cuenta quedan en el historial de KDBX y se pueden revisar con KeePass desde una copia local. Windows Hello se configura en cada portátil.

ZEN guarda primero en el equipo y revisa los archivos sincronizados cada doce segundos fuera de HUB y Preferencias. Si quieres revisar ahora, usa **Sincronizar ahora**. Pausa y Presentación suspenden el intercambio. Syncthing transporta los archivos y Restic conserva instantáneas en la Raspberry. La clave del perfil y la maestra de la bóveda se guardan fuera del directorio sincronizado.

La sincronización usa los datos guardados del HUB, templates y Descubrimiento de apps. Agenda local, borradores, Apuntes rápidos, Pizarra, geometría por monitor, sesión de Codex, credenciales de conectores y Windows Hello permanecen en cada equipo. **Desvincular** conserva los datos locales y las últimas copias ya publicadas.

## Configuración asistida con Codex u otra IA

En el Windows nuevo, abre el código de ZEN y pega este encargo en el asistente:

> Configura ZEN en este Windows siguiendo `docs/PERSONAL_SYNC.md`. Verifica que este PC pertenece a mi red privada de Tailscale y usa la Raspberry existente. Instala Syncthing con `scripts/setup-personal-sync.ps1` y conserva cualquier perfil que ya exista. Autoriza en la Raspberry únicamente este equipo y comparte **Notas**. Instala esta misma revisión de ZEN, guía la vinculación del perfil compartido y comprueba que un archivo de prueba va y vuelve. Detente para que yo complete inicios de sesión, la vinculación con el código y el desbloqueo de la bóveda. Resume qué quedó funcionando y qué requiere mi intervención.

### Comprobaciones para el asistente

1. Si el portátil solo tiene el código fuente, compila el portable con el procedimiento de [Despliegue](DEPLOYMENT.md). El PC nuevo debe usar una revisión que incluya **Sincronización entre equipos**.
2. Comprueba que Tailscale está conectado antes de pedir el ID del servidor. Usa la IP privada de la Raspberry indicada por el usuario y una conexión SSH ya autorizada. Comprueba la huella SSH si es el primer acceso desde ese portátil.
3. Tras instalar Syncthing, comprueba que el panel se limita a `127.0.0.1`, que el ID del portátil es nuevo y que **Notas** figura al día. El puerto `22000/TCP` del servidor debe autorizar solo la IP de Tailscale del portátil. La guía de la Raspberry explica cómo conservar la regla al reiniciar.
4. En ZEN, conserva el perfil compartido existente. El usuario copia el código desde el ZEN de origen y lo introduce directamente en **Vincular**. Comprueba que **Perfil vinculado** aparece en Preferencias y que un elemento ficticio se propaga en ambos sentidos.
5. Guía al usuario a activar **Sincronizar bóveda**, abrir **HUB → Contraseñas** y desbloquearla él mismo. El proyecto **APIS** viaja dentro de la bóveda cifrada, junto con el resto de sus entradas. En el nuevo ZEN queda accesible al desbloquear. Los valores que necesite una integración se pegan directamente en su pantalla de configuración. Comprueba después el indicador de conexión de la integración.
6. Mantén el código de vinculación, la maestra y los valores de APIS fuera del chat, los comandos, los logs y Git. Usa datos ficticios para las pruebas. Comprueba la llegada cifrada y el respaldo por huellas y estado del servicio.

Los inicios de sesión de Codex, Windows Hello y las autorizaciones OAuth se completan en cada portátil. [Seguridad de ZEN](SECURITY.md)

## Administración local

Abre [el panel de Windows](http://127.0.0.1:8384/) y usa el usuario `administrador`. Windows protege la contraseña para tu cuenta en `%LOCALAPPDATA%\Syncthing`. Para copiarla al portapapeles desde esa cuenta, ejecuta lo siguiente y pégala directamente en el panel. Limpia el historial del portapapeles si lo tienes activado.

~~~powershell
$credencial = Import-Clixml (Join-Path $env:LOCALAPPDATA 'Syncthing\zen-personal-sync-gui.clixml')
$credencial.GetNetworkCredential().Password | Set-Clipboard
~~~

Para pausar el inicio automático, deshabilita la tarea **Start Syncthing at logon** en el Programador de tareas. Para cambiar de equipo, instala y autoriza el nuevo cliente con su propia identidad. Los perfiles de ZEN y Syncthing se administran por separado.
