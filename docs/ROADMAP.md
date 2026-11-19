# Hoja de ruta

## 01 · Implementado ![](assets/verde.svg)

| Funcionalidad | Dependencias | Evidencia y alcance |
| --- | --- | --- |
| Cápsula pequeña única y paneles directos | Electron y Windows | Recorrido aislado de las cuatro ubicaciones, foco, continuidad y regiones Win32. |
| Peticiones y atajos de correo y agenda, Actividad, Resumen y avisos | CLI local, hooks y chat de Codex. Las consultas requieren sus conectores en Codex. | Destino, recibos, permisos y respuestas se verifican con fixtures. Las cuentas y conectores del usuario quedan fuera de ese recorrido. |
| Calendario local y retorno estructurado de Codex | Perfil local y chat fijado con conector de calendario | Fechas, creación local, reconciliación y creaciones externas con dobles. La conexión real requiere comprobación en el chat de destino. |
| Sonido automático y controles por sesión | Sesiones publicadas por Windows | Observación, selección y comandos con sesiones simuladas. |
| Knowledge Hub, Markdown y copia de datos y preferencias | SQLite, perfil local y selector de archivos | Se verificaron exportación, cancelación, recuperación e importación en el portable del 12 de noviembre de 2026. [Pruebas](TESTING.md) |
| Templates dentro de HUB | SQLite e imágenes administradas en el perfil | Ocho referencias con prompts diferenciados, personalización local, favoritos y edición. El recorrido aislado comprueba galería, detalle, filtros, scroll y borradores; las pruebas de datos cubren persistencia y respaldo. |

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
