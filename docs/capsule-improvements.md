# Mejoras de ZEN · 02/10/2026

Integradas las seis mejoras de la carpeta `C:\Users\samme\Desktop\ZeN` (commit `c5fc734`) con nuestra versión, por petición explícita de merge. La cápsula conserva 240×40 DIP arriba o 40×240 en ambos laterales; el chat desplegado conserva 640 DIP, el último mensaje, capturas y confirmaciones por voz/chat. El análisis de carpetas abre Codex del escritorio con la suscripción del usuario; solo una lectura explícitamente local utiliza estos lectores dentro de ZEN. Preferencias siguen en la bandeja. Los JSON de Live y del agente guardado permanecen intactos; no se han actualizado agentes remotos.

## Implementado

| Mejora | Comportamiento |
| --- | --- |
| Micrófono | Tres barras discretas junto al micro recogido. Miden la entrada real con Web Audio a 10 Hz, sin renderizar React en cada muestra. Desaparecen al silenciar; el nivel es cero al desconectar/finalizar. No activan herramientas ni autorizan efectos. |
| Progreso concreto | «Leyendo», «Buscando», «Preparando proyecto», «Verificando» y «Redactando» según actividad observada. Preparación de una carpeta y conversación usan canales separados. Los deltas de texto no cambian continuamente la cabecera ni el tamaño. Sin porcentajes inventados ni clasificación de afirmaciones del modelo. |
| Contexto visual | Al cruzar a otro monitor se invalida la referencia antigua; al terminar el arrastre se prepara una sola captura del monitor de destino. Si se vuelve al monitor inicial durante el mismo gesto, también se renueva. Los cambios de geometría/DPI invalidan referencias. La caducidad pide «Actualiza la referencia». Se conserva «Ver captura», captura manual y prioridad de la imagen pegada. No hay captura continua ni captura al recibir fragmentos de voz. |
| Interrupción | Mientras ZEN habla, una transcripción de entrada autenticada por Live silencia su reproducción y envía una instrucción de interrupción una vez por segmento. Los intervalos del servidor permiten reanudar audio nuevo y descartar reproducción anterior. No se cancelan tareas, cierran transportes, infieren turnos ni ejecutan efectos. Reunión y silencio manual siguen teniendo prioridad. |
| Documentos locales | Lectura de PDF con texto, Word `.docx` y Excel `.xlsx`, además de texto/código. Mismas raíces y permisos temporales de carpeta; los archivos originales no se suben ni indexan en la API. Solo fragmentos pertinentes entran al razonamiento cuando se pide. La consulta «localmente … sin API» continúa completamente local. Excel muestra valores guardados e identifica fórmulas sin ejecutarlas; no abre enlaces ni macros. |
| Convivencia y foco | Invocar por voz o en reunión muestra ZEN sin activar la ventana. Abrir explícitamente para escribir conserva el foco solicitado. Resultados discretos de reunión usan `showInactive`. Anclaje y tamaño se calculan en DIP; captura mantiene coordenadas nativas físicas. Arrastre y posición relativa guardada se conservan. |

La interrupción usa `session.instructions.append`, sin reenviar configuración inicial. La aceptación de una instrucción y la transcripción no prueban por sí solas la entrega del audio; el recorrido físico sigue pendiente. [Documentación oficial de sesiones Live](https://developers.openai.com/api/docs/guides/live-conversations).

## Lectura acotada

Lector fijo en un worker Node, con cancelación, máximo tres lectores concurrentes, ocho segundos por documento y límite del heap JS de 128 MB por lector. La compatibilidad Node de PDF.js se adapta dentro de ese worker para Electron; no se cambia el renderer ni la configuración de voz. **No es un sandbox del sistema operativo.** Recibe bytes ya validados, sin rutas arbitrarias ni código generado.

- Documento: máximo 10 MB; texto plano: 1 MB. Texto extraído: 64 000 caracteres; fragmento al modelo limitado además por la preferencia de contexto vigente.
- PDF: hasta 40 páginas; documentos cifrados o sin texto se rechazan. Escaneados necesitan OCR, todavía pendiente. Algunas fuentes complejas pueden necesitar recursos adicionales.
- Office: ZIP comprobado por tamaños y CRC, máximo 2 000 entradas, 100 partes pertinentes, 6 MB por parte y 24 MB descomprimidos. Solo XML de contenido conocido. DTD y entidades declaradas se rechazan; relaciones externas y código incrustado se ignoran. No sigue enlaces, ejecuta fórmulas ni instala Office.
- Excel: hasta 3 000 filas por hoja y 100 celdas por fila, sujeto al límite de texto. Se muestran identificadores de partes/hojas; no se acredita recalcular fórmulas ni interpretar todos los objetos gráficos.
- `.doc` y `.xls` antiguos necesitan conversión. El análisis de carpeta sigue siendo parcial y priorizado; una extracción fallida incrementa el contador de elementos omitidos.

Bibliotecas: [PDF.js](https://github.com/mozilla/pdf.js), [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser). El portable incluye sus recursos y licencias.

## Verificación de la rama de origen

Los resultados siguientes corresponden a la rama de origen antes de combinarla. La nueva verificación conjunta y su alcance están en [merge-20261002.md](merge-20261002.md).

- Build y **246 pruebas en 29 archivos**: extracción sintética PDF/DOCX/XLSX, fragmentos, redacción de secretos, raíces autorizadas, XML malicioso, ZIP demasiado grande, formatos rechazados y cancelación. Interrupción con transporte simulado: un envío por segmento, silencio de audio antiguo, reanudación por intervalo, reunión, micrófono y transporte conservados.
- [Interfaz Edge](evidence/capsule-improvements-ui.json): mini cápsula, estados concretos y preparación separada, medidor con señal Web Audio sintética y transporte simulado, silencio sin medidor, desplegar/recoger y controles dentro de 240×40. Streaming: 80 deltas, 7 pintados, cero cambios de cabecera o altura, texto literal y DOM conservados.
- [Windows/Electron](evidence/objective-current.json): páginas/archivos/Notepad, perfil, revisión y creación de un uso, resultados de reunión sin foco e invocación de voz sin foco. La medición compara el HWND nativo real antes/después. Cuando Windows no activa la ventana sintética solicitada por el test, usa el fondo existente estable, sin leer contenido ni guardar títulos de aplicaciones personales. Esto sustituye la precondición anterior basada solo en `BrowserWindow.isFocused()`.
- [API real y WebRTC](evidence/live-webrtc.json): JSON exacto, `session.started`, transcripciones literales, SOL delegado, búsqueda web completada, audio remoto medido y cierre confirmado. Audio de entrada sintético; no acredita micrófono físico ni interrupciones humanas. El [primer intento](evidence/live-webrtc-short-headline-attempt.json) tuvo respuesta válida de 19 palabras, pero una condición arbitraria del test exigía 20 y agotó tiempo. Se corrigió esa condición; se conservó el intento.
- [Portable verificado](evidence/portable-interface.json): `release/ZEN-20261002115323397/ZEN.exe`. Comprueba los tres lectores dentro de Electron empaquetado, mini interfaz, aislamiento, IPC, bandeja, streaming, adjuntos y arrastre sintético sobre el monitor real disponible en esta sesión. No necesita Node instalado. Conserva paquetes anteriores y no contiene credenciales.

## Pendiente físico y límites

Interrupciones hablando sobre ZEN con tus altavoces/micrófono, latencia/eco/ruido, Teams, selección de carpetas personales y cambio entre monitores con DPI distintos. Este entorno expone un monitor al smoke nativo actual; la geometría de varias pantallas tiene pruebas sintéticas e históricas, pero no se acredita una nueva prueba física en dos monitores. El objetivo general permanece incompleto.

Para probar: sal de ZEN anterior desde su bandeja y abre el único `ZEN.exe` del escritorio. Activa el micro para ver las barras. Pide una lectura o búsqueda, habla mientras responde, despliega para pegar una captura o elegir una carpeta. Las carpetas se analizan en Codex del escritorio: revisa y pulsa Enviar allí. Al mover entre pantallas, usa «Ver captura» para comprobar la referencia nueva. Detener mantiene su cancelación explícita y Ocultar conserva investigación.
