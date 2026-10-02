# Identidad de ZEN en Windows · 01/10/2026

La imagen base64 usada anteriormente por la bandeja era inválida: `nativeImage.createFromDataURL(...).isEmpty()` devuelve `true`. Por eso existía el espacio de la aplicación, pero su imagen era invisible. El ejecutable también carecía de un icono propio configurado.

Se utilizan dos variantes del personaje original de ZEN: el icono completo sobre un fondo oscuro para archivos y ventanas, y un rostro de mayor contraste sin fondo para la bandeja. Fuentes SVG en `public/icons/`; exportación local mediante `node scripts/app-icons.mjs`, sin llamadas a modelos. Los ICO contienen 16, 20, 24, 32, 40, 48, 64, 128 y 256 píxeles. Los tamaños pequeños utilizan DIB de 32 bits con transparencia y máscara; 256 utiliza PNG. Los fotogramas pequeños exclusivamente PNG se cargaban en Electron, pero no ofrecían el icono correcto al shell en la comprobación inicial; se sustituyeron por DIB y se comprobó el resultado real.

- Bandeja: `tray.ico`, validado al arrancar para evitar otro icono silenciosamente vacío.
- Ventanas, Preferencias y visores: `zen.ico`.
- Identidad Windows: `com.zen.desktop`; los procesos de prueba usan `com.zen.desktop.smoke`.
- Binario Electron interior: recursos de iconos y nombre de producto ZEN editados únicamente en la copia de `release/`, mediante `scripts/windows-icon.mjs`. No se modifica el runtime instalado.
- EXE portable exterior: `win.icon` en `config/portable-win.json`, incluido por NSIS.

Se conserva el comportamiento solicitado: la cápsula no ocupa la barra de tareas; al ocultarla, ZEN se muestra allí. El icono de bandeja está disponible también en cápsula. Windows decide si lo sitúa directamente en la bandeja o dentro de «iconos ocultos»; no se cambian preferencias del sistema ni se crea una instalación en Inicio.

Validación: build TypeScript/Vite; los 18 PNG pasan lectura nativa, dimensiones, transparencia útil y colores; ambos ICO cargan en Electron. `node scripts/icon-smoke.mjs <ZEN.exe>` comprueba que los recursos PE contienen las nueve representaciones esperadas, extrae la imagen mediante `app.getFileIcon` y compara sus píxeles con el personaje de ZEN. Evidencia en `docs/evidence/windows-icons.json` y `docs/evidence/zen-shell-icon.png`. El EXE final se somete también a arranque y extracción mediante `single-file-smoke.mjs`.

La entrega sigue siendo únicamente `C:\Users\Gamming\Desktop\ZEN.exe`; fuentes, paquetes y respaldos permanecen dentro del proyecto. Los pendientes generales de foco y control físico se mantienen en `docs/objective-verification.md`.
