# Actualizar la música y salir de presentación — 24/10/2026

El usuario indica que la canción no aparece al reanudar Spotify y pide un botón Actualizar contenido. La captura muestra Presentación activa: ese ajuste de ZEN oculta información y controles y no se desactiva al reproducir música en otra aplicación.

Se añade Actualizar contenido al reproductor desplegado y al compacto. Consulta de nuevo la metadata y el estado de la sesión elegida, sin enviar play/pausa, cambiar el destino ni perder una selección válida. Conserva el sondeo visible posterior; la actualización manual no invalida su generación. Si Windows ha retirado la sesión, se actualiza la lista y se pide elegir fuente de nuevo, sin retargeting automático ni reintentos de efectos.

El panel de presentación explica la diferencia e incluye Salir de presentación y mostrar música. Solo esta acción explícita cambia presentación; el botón de actualizar permanece bloqueado mientras la política o la pausa oculten contenido. Al salir, vuelve la elección explícita de fuente. Si ZEN está en pausa, se ofrece abrir preferencias para reanudarlo. La actualización no se confunde con reanudar la canción y no toca la reproducción.

Build y 516 pruebas en 58 archivos pasan. El recorrido Electron aislado comprueba que un cambio de reproducción simulado se refleja al actualizar, conserva la sesión, ejecuta lecturas sin órdenes nuevas, recupera una sesión retirada sin elegir otra automáticamente y mantiene el bloqueo de presentación hasta pulsar su salida explícita. Conserva las pruebas de cápsula única, geometría estable, Gmail y permisos. No se acredita reanudación física de Spotify ni interacción con el navegador; continúa vigente el límite anterior de Computer Use.

Sin API de modelos, Spotify Web API, hooks/confianza ni cambios de configuraciones históricas. La entrega actualiza únicamente Desktop/ZEN.exe, con respaldo en release y comprobación de extracción/arranque. Evidencia local: docs/evidence/music-content-refresh-deployment.json.

Entrega terminada: SHA256 d6b9725c4afa8313cdb4bffbf079c77e6b0ab6cf90432a019ba179194560c7cf. Copia y main del arranque normal coinciden con el paquete probado; observador activo confirmado. Los archivos de cuenta y preferencias de presentación permanecen idénticos después del reemplazo.
