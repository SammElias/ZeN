# Google Calendar en ZEN

La integración Agenda añade un quinto acceso a la cabecera, dentro de la misma cápsula de 760 × 56 DIP. Conserva los cuatro bloques de estado de Codex, navegación, multimedia y controles; Avisos sigue en la campana. Otro icono cambia de sección sin recogerla y repetir el activo la recoge. Los órdenes anteriores se migran en memoria sin reescribir preferencias al arrancar.

## Uso

Abre Agenda y pulsa **Conectar con Google**. ZEN reutiliza el cliente OAuth de tipo Aplicación de escritorio que ya está configurado para Google, pero pide un consentimiento propio de Calendar. La cuenta y los permisos de Gmail se conservan. Si no hay cliente configurado, Configurar Google lleva a los ajustes existentes de Gmail. Si Calendar API está deshabilitada, se ofrece un enlace explícito a su página de Google Cloud; ZEN no cambia el proyecto ni la facturación.

El selector muestra los calendarios disponibles. El mes empieza en lunes, marca los días con eventos y permite navegar con flechas del teclado. Seleccionar un día muestra su agenda; Hoy vuelve al día actual. Abrir un evento muestra fecha, horario local, ubicación, descripción y participantes disponibles. Google Calendar y Abrir en Google son enlaces externos explícitos.

Actualizar relee calendarios y eventos. La agenda se refresca cada minuto mientras la pestaña está visible, sin detalle abierto. No se consulta estando recogida, oculta, en otra sección, en pausa o en Presentación. La información privada desaparece de la vista al salir; al volver se carga de nuevo. Desconectar Calendar de este PC retira solo su conexión local.

## Autorización y datos

Se usa la [API de Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), sin API de modelos ni credenciales del conector de Codex. Los únicos ámbitos solicitados son [calendar.calendarlist.readonly y calendar.events.readonly](https://developers.google.com/workspace/calendar/api/auth). La integración no crea, cambia, elimina ni responde a eventos y no añade recordatorios locales.

El [flujo de aplicación instalada](https://developers.google.com/identity/protocols/oauth2/native-app) abre Google en el navegador externo con PKCE, state aleatorio y receptor loopback temporal. La autorización explícita puede completarse durante cinco minutos aunque se recoja, oculte o cambie de pestaña. Cancelar, pausar, Presentación, cambiar cliente, desconectar y salir la invalidan. El código se canjea una sola vez; la página final local no conserva código ni state en su URL. Un consentimiento nuevo no hereda el refresh token de otra cuenta.

Los tokens de Calendar quedan cifrados por Windows en `calendar-oauth.bin`, fuera del repositorio y separados de Gmail. El secreto Desktop existente solo se usa en el cuerpo de los POST fijos de tokens; no se transmite al renderer. No se toman tokens de Gmail ni de los conectores de Codex. Los cambios de cliente/cuenta invalidan los identificadores de calendarios, eventos y páginas anteriores.

El transporte privado de Chromium omite cookies, caché, referrer y redirects. Solo admite el endpoint fijo de tokens y GET de calendarios/eventos con parámetros y campos permitidos. No permite endpoints de escritura. Los errores mostrados son locales y acotados; no incluyen respuestas del proveedor, tokens, códigos ni URLs de autorización.

## Límites de lectura

- Hasta 100 calendarios legibles; la lista usa [CalendarList.list](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list). Se indica si quedan otros fuera.
- El mes presenta 42 días. La consulta de IPC admite como máximo 43 días para cubrir cambios de horario; la petición al proveedor añade dos días a cada extremo para los límites de zona horaria de eventos de todo el día. Solo se muestran los días seleccionados.
- Eventos ordenados por inicio, instancias recurrentes expandidas, cancelados excluidos y duplicados retirados. Hasta 100 eventos por página y cinco páginas, con Cargar más eventos y aviso de agenda parcial cuando corresponde. Los registros omitidos por formato no se presentan como una agenda completa.
- Los eventos de todo el día respetan la fecha final exclusiva de Google; los que cruzan medianoche aparecen en los días afectados. Las horas se muestran en la zona local de Windows.
- El detalle se obtiene solo para un evento de la agenda actual. Descripciones como texto inerte, hasta 16.000 caracteres tras conversión acotada; hasta 20 participantes y recuento de los omitidos. Se indica contenido parcial. No se carga HTML activo, imágenes ni adjuntos.
- Respuestas HTTP acotadas: tokens 64 KiB, calendarios 500 KB, eventos 1,5 MB y detalle 250 KB; tiempo de red de 15 segundos. Los errores no generan reintentos de canje ni escrituras.

Los IDs reales, eventos y enlaces permanecen en RAM en main; el renderer recibe identificadores opacos de la vista actual. Las lecturas se validan antes y después de cada espera. Cambiar rango, calendario, cuenta o visibilidad invalida resultados tardíos. Cerrar una vista antigua no puede cerrar la nueva. El estado global, los avisos, el historial y los logs no reciben títulos, participantes ni descripciones.

## Validación del 3 de noviembre de 2026

Build de producción y 792 pruebas en 66 archivos pasan. Las pruebas de Calendar cubren loopback HTTP real con Google simulado, PKCE, caducidad, privacidad, cuentas independientes, tokens cifrados, límites de respuesta, fuentes opacas, paginación, cancelados, recurrencias, días completos, medianoche y cambios de horario. Los endpoints de escritura están rechazados por pruebas del transporte.

El recorrido Electron nativo comprueba conexión simulada, mes/agenda, selector, detalle inerte, enlaces explícitos, actualización, autorización que sobrevive a navegación, revocación de vistas, ausencia de lectura oculta y anchos nativos 320/380/760. Conserva las regresiones de Gmail, música, Home, permisos y las dos vistas de Codex. Evidencia local en `docs/evidence/companion-native.json` y capturas sintéticas en `docs/ui-preview/companion/calendar-*.png`.

El EXE portable extraído pasa el mismo recorrido con salida cero. `Desktop/ZEN.exe` se sustituye por esa copia con hash idéntico, respaldo dentro de `release/desktop-backups`, arranque normal del bundle probado y un único observador nativo vinculado. Los archivos de cuentas, preferencias, históricos, hooks, confianza y relay permanecen intactos. No se detiene Codex ni se publica el proyecto. Evidencia local en `docs/evidence/single-executable.json` y `docs/evidence/calendar-deployment.json`.

No se ha autorizado Google por el usuario, consultado su calendario real ni cambiado Google Cloud para esta entrega. La primera conexión real requiere pulsar Conectar con Google. Los límites físicos previos de foco, DPI, notificaciones y control del navegador siguen vigentes; las pruebas sintéticas no los acreditan.
