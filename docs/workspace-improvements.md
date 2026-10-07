# Uso diario y control verificado — 02/10/2026

Mejoras autorizadas por el usuario, con validación local prioritaria y llamadas reales acotadas. Agente guardado, modelo principal y JSON Live conservados byte a byte; sin subagentes.

## Uso

- **Selección:** selecciona texto en otra aplicación y pulsa `Ctrl+Alt+S`. También está disponible desde el clip; si la aplicación no expone selección accesible, copia y elige «Texto copiado». Vista local de hasta 4.000 caracteres, válida dos minutos; solo se envía al pulsar Enviar. Botones Explica, Corrige, Resume y Traduce preparan una petición editable.
- **Zona de pantalla:** el clip permite recortar una captura estática. Únicamente la zona elegida se adjunta al enviar. No observa continuamente.
- **Pausa:** Pausar/Continuar en el panel o por chat/voz. Una llamada en curso puede terminar y consumir; los nuevos pasos y efectos esperan. Detener aborta la espera. Los tiempos máximos de tarea siguen vigentes.
- **Retomar/corregir:** «Tareas y favoritos», también desde la bandeja. Recupera la petición y un resumen acotado del último paso; el usuario edita y envía. Se obtiene contexto nuevo, se cancela la ejecución anterior y se invalidan sus revisiones pendientes. Reiniciar nunca repite efectos automáticamente.
- **Resultados:** Guardar texto, imágenes y archivos generados; Abrir ubicación después del guardado. Diálogo nativo de destino, archivo nuevo sin sobrescritura. Descargas Code Interpreter limitadas a citas de contenedores observados, cuatro archivos, 10 MB por archivo y 24 MB por respuesta. Los resultados en RAM caducan a los 30 minutos.
- **Ruta y gasto:** Local / Codex del escritorio / API antes de enviar. Estimación por tarea cuando existen recibos; «+ pendiente» si falta consumo confirmado. Presupuesto orientativo por tarea (0,50 € inicial, editable en el panel y Preferencias); se detienen nuevas llamadas al alcanzar lo registrado/reservado incierto. No es límite garantizado de facturación. Voz separada; herramientas y contenedores pueden añadir cargos.
- **Favoritos:** hasta 20 instrucciones locales, editables; elegir una prepara el compositor sin llamar a la API.
- **Voz:** «Copia la respuesta», «Léeme el resultado» y «Deja de hablar, sigue trabajando». La lectura usa solo una voz local instalada. El comando hablado se procesa al soltar pulsar para hablar o silenciar explícitamente; nunca desde un fragmento o silencio automático. La sesión Live activa sigue teniendo su coste propio.

## Control real de Windows

El auxiliar conservaba mal el escritorio de entrada al llamar SetThreadDesktop y cerrarlo. Se eliminó esa reasignación: hereda el escritorio interactivo, con las comprobaciones de escritorio, ventana, foco y proceso existentes. SendInput conserva ahora el error Win32 original y las tuberías usan UTF-8. No hay elevación ni permisos globales nuevos.

`computer-native.json`: ratón/teclado y UI Automation reales en Edge; modelo simulado. Escribe «Prueba ñ de ZEN», guarda y comprueba el DOM; bloquea proceso incorrecto.

`computer-live.json`: mismo formulario local con **GPT-6.1 SOL real**, imágenes reales y controlador Windows real. Tres respuestas, resultado guardado y verificado; 0,0099315 € estimados en ese intento con conversión local 1 EUR/USD. Las confirmaciones de la prueba son códigos de chat automatizados, limitados a ese formulario y texto; no son una prueba de voz humana.

`generated-file-live.json`: Code Interpreter real, descarga de CSV citado y exportación local verificada. 0,00398 USD estimados de tokens; cargo de contenedor aparte. Los intentos previos de control registraron 0,015284 USD adicionales; uno se interrumpió por cambio de foco y otro pidió intervención. No se presentan los intentos fallidos como éxito.

## Evidencia y límites

- Build TypeScript/React y auxiliar .NET; **294 pruebas en 34 archivos**.
- Edge: selección pegada, recorte real de imagen, favoritos, petición de continuación, presupuesto, confirmación durante tarea, chat y cápsulas sin desbordamiento; cero cambios de tamaño por delta.
- Electron real: IPC validado, favoritos, guardado con diálogo de destino inyectado y bytes reales, rechazo de sobrescritura, lectura local enviada al renderer, pausa/continuación, aislamiento, bandeja y bordes. El diálogo inyectado no acredita un clic físico en Guardar.
- Pruebas de interfaz en `test-results/ui.json`; paquete y entrega en `docs/evidence/portable-interface.json`, `single-executable.json` y `single-executable-deployment.json`.

Pendientes que requieren contexto real del usuario: dictado físico de estos comandos, audición de la voz local, pruebas de reunión con una aplicación externa y creación/análisis de tablas o flujos en su entorno autenticado de Power Platform. El formulario local no acredita Dataverse. Cambiar de aplicación detiene el control; páginas animadas pueden invalidar la comparación exacta de capturas. El objetivo general no se declara completo.

## Simplificación solicitada — 07/10/2026

Se eliminan «Por tarea €», la etiqueta de ruta/pago por uso y los importes de tareas recientes. Tareas y favoritos y Pausar/Continuar permanecen disponibles. El chat ya no envía un presupuesto particular: el backend usa el valor guardado en Preferencias. No cambia la facturación ni se desactivan las medidas de ahorro.

Build y pruebas UI aprobadas; se comprueba que no aparecen los controles de coste y que el envío conserva el contexto sin sobrescribir el presupuesto configurado. Captura revisada en `docs/ui-preview/latest-1791355740709/codex-desktop.png` (generada localmente e ignorada por Git). Paquete Electron comprobado en `docs/evidence/portable-interface.json`. Sin llamadas API para este cambio; agente guardado y JSON Live intactos.
