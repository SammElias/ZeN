# Apariencia guardada en la cápsula

Corrección del 04/11/2026 tras precisar el usuario que tema, fondo y opacidad desaparecían en la cápsula.

La configuración y la imagen seguían guardadas en el perfil estable de Windows, fuera del EXE. La corrección anterior del recuadro había fijado una superficie sólida y ocultado el fondo únicamente en modo cápsula. No era una pérdida de los archivos al compilar.

La cápsula vuelve a usar el tema, fondo propio (imagen o degradado), opacidad y desenfoque CSS elegidos. La opacidad se aplica directamente dentro de su superficie redondeada. No cambia el guardado explícito de Apariencia ni el tratamiento del modo app. No se reescriben los ajustes existentes ni se migran perfiles.

El exterior conserva el recorte de 820×68 DIP, sin sombra CSS, material DWM, marco grueso ni renderizado no cliente. El fondo se recorta dentro de la cápsula; no se recupera el rectángulo exterior de cristal de Windows. Presentación continúa retirando la imagen antes de IPC.

La prueba Electron arranca con un archivo de apariencia ya guardado y comprueba tema, degradado, opacidad y desenfoque. Después guarda tema claro, importa una imagen sintética, recoge la cápsula y verifica que conserva imagen y opacidad, además de repetir la comprobación nativa del marco. Se mantienen las pruebas de persistencia al reconstruir la clase, protocolos locales y privacidad.

La validación usa proveedores e imágenes sintéticos, sin leer correo o calendario reales ni llamar a modelos. La entrega conserva sesiones, preferencias, imagen propia, históricos y configuración de Codex; sustituye únicamente el EXE del escritorio con respaldo dentro de release. Evidencias locales: `capsule-preferences-deployment.json`, `portable-shell.json` y `single-executable.json` en docs/evidence.

Build y 828 pruebas en 67 archivos pasan. El recorrido Electron y el del EXE extraído verifican las cuatro regresiones de apariencia, privacidad y marco nativo. La entrega conserva todos los archivos protegidos (incluida la imagen propia), coincide con el hash probado y arranca con su bundle y un único observador nativo.
