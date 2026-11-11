# Pruebas

## Objetivo y niveles

| Nivel | Herramienta | Qué acredita |
| --- | --- | --- |
| Unitario | Vitest | Esquemas y política, selección del chat/fuente, límite de revisiones, recuperación y casos de error. |
| Integración aislada | `npm run test:electron` | Renderer, IPC, ventana y auxiliares en el flujo activo con un perfil y datos de prueba. |
| Construcción | `npm run build:native` y `npm run build` | Auxiliares nativos, tipos y bundles de producción. |
| Entrega local | Paquete portable extraído y recorrido aislado | Arranque, bundle y comportamiento del artefacto que se va a entregar. |
| Físico | Sesión Windows y equipo real | Comportamiento de foco, DPI, avisos y reproducción en condiciones reales cuando el alcance lo requiere. |

## Casos prioritarios

- Petición corta aceptada en el chat fijado; destino no válido, error del CLI y recibo de otro chat rechazados. No repetir tras un timeout.
- Respuesta final válida en Resumen; ausencia y datos tardíos tratados sin filtrar contenido privado.
- Eventos observados separados de resultados y permisos pendientes con acción explícita.
- Sonido aparece y cambia automáticamente con sesiones sintéticas. Cambio de fuente, cierre, Pausa y Presentación no disparan controles.
- Alternar modo ventana, navegar y guardar apariencia sin tocar cuenta ni perfil real. Validar tamaño compacto y textos largos.

Los tests están en [tests/](../../tests/), con casos concretos en [peticiones](../../tests/companion-request.test.ts), [historial](../../tests/companion-reader.test.ts) y [multimedia](../../tests/companion-media.test.ts). Usar fixtures legibles: condición inicial, acción, resultado observable. No dar por probado un gesto físico a partir de datos simulados.

Para un cambio de documentación, comprobar referencias locales, consistencia con el código y el HTML generado. Consultar [README](../../README.md) y [entrega](DEPLOYMENT.md) para compilar o empaquetar.
