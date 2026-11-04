# Cápsula sin recuadro exterior

Actualización posterior del 04/11/2026: la superficie sólida descrita abajo se sustituye por la [apariencia guardada dentro de la cápsula](capsule-preferences.md), por aclaración del usuario. Se conserva la retirada del marco y material nativos exteriores; fondo y desenfoque CSS vuelven a aplicarse solo dentro del recorte.

Corrección del 04/11/2026 tras la captura que seguía mostrando un marco de cristal detrás de la cápsula.

La comprobación anterior verificaba el material de fondo de DWM y la sombra declarada por Electron, pero no la ausencia del marco no cliente. El constructor todavía conservaba el `thickFrame` predeterminado. [Electron documenta que ese ajuste añade el marco estándar de Windows](https://www.electronjs.org/docs/latest/api/structures/base-window-options).

Se desactivan `thickFrame` y las esquinas del sistema al crear la única ventana. La cápsula mantiene su recorte propio redondeado, cuatro bloques y 820×68 DIP. En modo recogido, su superficie es opaca: no hay fondo personalizado, pseudoelemento de fondo ni filtro de desenfoque detrás de la fila. El tema y los colores se conservan. La app completa mantiene sus superficies de cristal y el fondo elegido, sin reescribir las preferencias.

## Verificación más estricta

La prueba Win32 de la ventana propia comprueba ahora material DWM desactivado, ausencia de `WS_THICKFRAME`, renderizado no cliente desactivado y coincidencia exacta de `GetWindowRect` con `DWMWA_EXTENDED_FRAME_BOUNDS`. Se exige tanto al iniciar como después de expandir y volver a recoger. La cápsula no tiene sombra CSS y su cabecera no usa `backdrop-filter`.

La ausencia de marco estándar exige comprobar el redimensionado de la app, además de `isResizable`: los hit tests propios devuelven HTLEFT/HTRIGHT/HTBOTTOM y una prueba del bucle nativo SC_SIZE con mensajes dirigidos exclusivamente a esa ventana modifica su ancho, mantiene su altura y restaura el rectángulo de la prueba. Los mensajes se dirigen solo al HWND cuyo proceso propietario se ha verificado; no se envían teclas a otras aplicaciones. Maximizar, restaurar, geometría persistida y minimizar con retirada de datos privados siguen verificados.

Build y 809 pruebas en 67 archivos pasan, junto con el recorrido Electron y el mismo recorrido del EXE extraído. Se conservan los quince casos de herramientas compactas y las regresiones anteriores. Proveedores y contenido de pruebas son sintéticos; no se afirma validación física del ratón/DPI ni correo/calendario/reproducción reales.

La entrega reemplaza únicamente Desktop/ZEN.exe por la copia probada, con respaldo bajo release y comprobación de hashes, bundle cargado y observador nativo único. Solo se reinicia ZEN identificado por su bundle anterior. La entrega abre la cápsula para revisar la corrección y conserva el rectángulo y la maximización guardados de la app. Las sesiones, preferencias, históricos y configuración de Codex se conservan; no hay llamadas a modelos, modificaciones de Cloud ni publicación. Evidencias locales: `capsule-frame-native.json`, `portable-shell.json`, `single-executable.json` y `capsule-solid-deployment.json` dentro de docs/evidence.
