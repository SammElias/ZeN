# Decisiones de arquitectura

| Decisión | Motivo | Consecuencia |
| --- | --- | --- |
| D01 · Codex es dueño de los chats y la ejecución | Aprovechar la cuenta y el flujo ya utilizados | ZEN muestra estado, prepara peticiones y abre el destino; no ejecuta modelos ni duplica conectores de correo/agenda. |
| D02 · Una cápsula con panel desplegable | Mantener navegación y preferencias con poco espacio de trabajo | La ventana conserva la cabecera y el anclaje al mostrar las integraciones debajo. |
| D03 · Autoridad en main | El renderer no debe decidir si una lectura o efecto está autorizado | Validar origen, contrato, vista y destino en la frontera; reenviar solo el estado permitido. |
| D04 · Dos vistas de Codex | Actividad y respuesta final tienen usos distintos | Actividad contiene eventos/permisos; Resumen lee el resultado. El texto final no viaja a las demás vistas. |
| D05 · Sonido usa Windows y separa lecturas de acciones | Ver contenido de Spotify, navegadores y otras fuentes sin credenciales propias | Metadatos automáticos; controles por sesión elegida y gesto. No capturar audio. |
| D06 · Mapa HTML separado para documentación | Explicar el código sin alterar el producto ni sus permisos | Usar Archify y una captura local de fuentes para validar las referencias. Una vista integrada sigue siendo una propuesta. |

Estado: D01–D05 describen la implementación activa. D06 describe esta entrega de documentación. Revisar [arquitectura](ARCHITECTURE.md) y [hoja de ruta](ROADMAP.md) si alguna decisión cambia.
