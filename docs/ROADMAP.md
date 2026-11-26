# Hoja de ruta

**Contraseñas en HUB:** bóveda local KDBX cifrada con maestra, proyectos y cuentas, búsqueda aislada, bloqueo de sesión, revelado acotado y portapapeles privado de Windows. La aceptación automatizada con credenciales ficticias pasó con `scripts/vault-windows-smoke.mjs`; quedan separadas la prueba física de bloqueo de Windows y la inspección manual de Win+V. La bóveda queda fuera del respaldo general y se traslada como archivo cifrado.

## 01 · Implementado ![](assets/verde.svg)

| Funcionalidad | Dependencias | Evidencia y alcance |
| --- | --- | --- |
| Cápsula pequeña única y paneles directos | Electron y Windows | Recorrido aislado de las cuatro ubicaciones, foco, continuidad y regiones Win32. |
| Peticiones y atajos de correo y agenda, Actividad y avisos de permisos | CLI local, hooks y chat de Codex. Las consultas requieren sus conectores en Codex. | Destino, recibos, permisos y respuestas se verifican con fixtures. Las cuentas y conectores del usuario quedan fuera de ese recorrido. |
| Calendario local y retorno estructurado de Codex | Perfil local y chat fijado con conector de calendario | Fechas, creación local, reconciliación y creaciones externas con dobles. La conexión real requiere comprobación en el chat de destino. |
| Resumen diario de Home | Agenda ya sincronizada, preferencias locales y OpenWeather | Generación local y consulta de solo lectura. La generación automática con Codex requiere un flujo aislado sin herramientas. |
| Métricas de Oura | Aplicación OAuth propia en Oura y almacén seguro de Windows | Navegación, consulta automática y desconexión con datos sintéticos. Queda la comprobación con una cuenta y un anillo reales. |
| Sonido automático y controles por sesión | Sesiones publicadas por Windows | Observación, selección y comandos con sesiones simuladas. |
| Knowledge Hub, Markdown y copia de datos y preferencias | SQLite, perfil local y selector de archivos | Se verificaron exportación, cancelación, recuperación e importación en el portable del 12 de noviembre de 2026. [Pruebas](TESTING.md) |
| Perfil compartido entre equipos | Syncthing y Tailscale, almacén seguro de Windows, KDBX opcional | Pruebas con dos perfiles aislados para vinculación, conflictos y conservación de dos ediciones de una contraseña. [Instalación](PERSONAL_SYNC.md) |
| Apuntes rápidos en HUB | SQLite y perfil local | Hoja continua con autoguardado, scroll interno y recuperación de la posición de escritura. |
| Pizarra en HUB | Canvas y SQLite local | Lienzo persistente con pinceles, goma de tramo, Deshacer y reinicio con confirmación. |
| Officina | Cápsula, tablero local y puente de Codex | Cuatro diseños para los mismos siete despachos, zoom, desplazamiento y pantallas animadas, decisiones desde el despacho, Chat global, resultados en Markdown, traspasos versionados, QA y permisos de herramientas en Codex. ZEN revisa el trabajo y presenta propuestas que el usuario decide. La carpeta del proyecto se puede añadir desde Proyectos de Codex. |
| Traductor dentro de HUB | Azure Translator Global y almacén seguro de Windows | Traducción en ambos sentidos, copia y uso en ancho estrecho. La validación automatizada usa un servicio simulado. |
| Templates dentro de HUB | SQLite e imágenes administradas en el perfil | Treinta diseños empresariales en seis áreas de trabajo con imágenes en inglés y prompts para Power Apps Canvas y React, personalización local, favoritos y edición. El recorrido aislado comprueba galería, detalle, filtros, scroll y borradores; las pruebas de datos cubren persistencia y respaldo. |

## 02 · En curso ![](assets/azul.svg)

PENDIENTE DE DEFINIR.

## 03 · Siguiente ![](assets/turquesa.svg)

- **Instalación en otro equipo.** Verificar la descarga del portable, el arranque con .NET 10 y la importación con un perfil de Windows distinto.
- **Validación física al cambiar la cápsula.** Verificar arrastre, foco y escalado en los monitores afectados. Se completa con una observación reproducible en Windows.
- **Compatibilidad con Codex.** Al cambiar el CLI o los hooks, verificar cola en el chat esperado, recuperación ante entrega incierta y decisión de permiso en el destino correcto.
- **Calendario externo.** Verificar consulta y creación desde el chat fijado con su conector real. Las creaciones de prueba requieren un calendario de prueba expresamente configurado. Los eventos locales ya funcionan sin esa conexión.

## 04 · Futuro ![](assets/violeta.svg)

Evaluar si aporta valor consultar el mapa de arquitectura desde ZEN. La decisión requiere un caso de uso y un recorrido verificable.

## 05 · Bloqueado ![](assets/ambar.svg)

PENDIENTE DE DEFINIR.

## 06 · Aplazado ![](assets/rosa.svg)

Cliente directo de Gmail y Calendar, chat y modelos propios, y automatización autónoma de navegador desde ZEN quedan fuera del flujo actual. Cualquier reintroducción requiere alcance y permisos explícitos.
