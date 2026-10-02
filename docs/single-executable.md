# Un único ejecutable en el escritorio

Desde la petición del 01/10/2026, la entrega de escritorio es únicamente `C:\Users\Gamming\Desktop\ZEN.exe`. No se crean carpetas de versiones/pruebas ni accesos directos adicionales en la raíz del escritorio. Los paquetes y respaldos quedan en `release/` dentro del proyecto.

El EXE portable incluye Electron, ZEN y sus recursos. Al arrancar extrae los archivos en un directorio temporal propio y los retira al cerrar. La configuración y las claves siguen en la ubicación de datos del usuario que ya utiliza ZEN. No solicita elevación ni instala servicios. Se conserva la dependencia existente del auxiliar Windows con .NET Desktop Runtime 10.

## Compilar

Con un paquete de aplicación ya compilado, por ejemplo:

```powershell
npm.cmd run package:single -- release/ZEN-20261001203609008
node scripts/single-file-smoke.mjs release/single-file/ZEN.exe
```

El resultado es `release/single-file/ZEN.exe`. `electron-builder` está fijado en 26.15.3 y la configuración en `config/portable-win.json`. No hay publicación remota ni credenciales dentro del paquete. En esta versión del constructor, `unpackDirName: true` omite `UNPACK_DIR_NAME` y deja que NSIS use `$PLUGINSDIR`, único para cada arranque. Así un segundo lanzamiento no borra los recursos del primero.

Entrega posterior con los [iconos de Windows](windows-icons.md): **104.549.946 bytes**, mismo archivo del escritorio. La bandeja carga un ICO válido y el binario interior y el portable llevan el personaje ZEN. Se comprobó el icono que devuelve el shell también sobre el EXE ya desplegado, con comparación de píxeles. La nueva instancia se lanzó como aplicación interactiva. Hash vigente en `docs/evidence/single-executable-deployment.json`; las cifras del siguiente historial corresponden a la entrega anterior del chat.

La prueba ejecuta el EXE completo con tareas sintéticas y registra extracción/arranque/renderizado/carga de iconos en `docs/evidence/single-executable.json`. No llama a modelos ni acredita el control físico de Windows o las funciones todavía pendientes. La validación del paquete completo continúa separada de la entrega de un único archivo.

El observador de pruebas mantiene activos los fotogramas únicamente en el proceso aislado `--zen-smoke`: Windows puede suspender `requestAnimationFrame` cuando la ventana de prueba queda tapada al recorrer otro monitor. Esa suspensión causó un timeout en la comprobación de bordes; no se eliminó ninguna aserción. La ventana de producción conserva sus preferencias normales.

Entrega con el chat corregido: `ZEN.exe`, 104.062.998 bytes. El arranque del EXE pasó, incluidos actividad, bordes y stream. En este ensayo portable, con la instancia anterior abierta, `shortcutRegistered` y `shownOnTop` quedaron en falso; la comprobación independiente de Electron sí acreditó `shownOnTop`. No se presentan esos indicadores como superados en el portable. NSIS no propaga stdout: el ensayo observa eventos de consola mediante un inspector efímero en loopback, solo con `--zen-smoke`, sin modificar el EXE ni usar la API. La instancia anterior, observada en Listo y con micrófono apagado, se cerró para liberar el archivo y lanzar la versión nueva. La carpeta antigua `ZEN Codex` se trasladó a `release/desktop-backups/20261001-ZEN-Codex`; no quedan otras carpetas o accesos ZEN en la raíz del escritorio. Hash y despliegue: `docs/evidence/single-executable-deployment.json`.
