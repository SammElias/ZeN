# Reglas de trabajo de ZEN

## 01 · Antes de cambiar el proyecto ![](docs/assets/violeta.svg)

| Si el cambio afecta a | Lee primero |
| --- | --- |
| Arquitectura, servicios, datos o dependencias | [Arquitectura](docs/ARCHITECTURE.md) |
| Pantallas, navegación o interacciones | [Flujos](docs/UX_FLOWS.md) |
| Prioridades o estado de las funciones | [Hoja de ruta](docs/ROADMAP.md) |
| Instalación, configuración o distribución | [Despliegue](docs/DEPLOYMENT.md) |
| Datos privados, permisos o integraciones | [Seguridad](docs/SECURITY.md) |
| Pruebas y evidencias | [Pruebas](docs/TESTING.md) |
| Componentes y apariencia | [Sistema de diseño](docs/DESIGN_SYSTEM.md) |

## 02 · Método de trabajo ![](docs/assets/azul.svg)

**Analizar → Planificar → Implementar → Validar → Documentar**

1. Revisa la documentación relevante y comprueba los puntos de entrada activos. Si el código y los documentos difieren, contrasta ambos con la decisión vigente y la evidencia.
2. Antes de cambios importantes, identifica archivos, riesgos y dependencias. Explica las decisiones relevantes y plantea las pendientes antes de un cambio de alto impacto.
3. Respeta las convenciones, reutiliza componentes, mantén el código modular y añade comentarios cuando expliquen un comportamiento poco evidente. Limita los cambios y dependencias al alcance solicitado. Conserva el trabajo local ajeno. Delega solo cuando el usuario lo solicite.
4. Valida el flujo habitual y sus regresiones. Distingue entre implementación, prueba con fixtures y comprobación física. Comunica lo que quede pendiente.
5. **Después de cada implementación, modificación funcional o cambio arquitectónico, revisar si los documentos del proyecto necesitan actualizarse.** Actualiza únicamente los afectados.

## 03 · Límites del compañero ![](docs/assets/verde.svg)

- Mantén en Codex la identidad, las conversaciones, los modelos y los conectores. Conserva una sola ventana ZEN, con cápsula y panel, y las dos pestañas de Codex **Actividad** y **Resumen**.
- Main autoriza las acciones y filtra los datos antes de IPC. Comprueba destino, vista y estado actual antes de efectos, y respeta Pausa y Presentación. Los permisos revisados son específicos y de un uso. Ver [Seguridad](docs/SECURITY.md).
- Conserva perfiles, cuentas, historial, hooks, confianza y configuración local al probar y actualizar. Usa perfiles temporales con datos sintéticos. Requiere autorización para operaciones destructivas y para modificar configuraciones externas o recursos fuera del alcance.

## 04 · Entrega ![](docs/assets/ambar.svg)

- Si el usuario pide instalar en el escritorio, entrega únicamente `ZEN.exe` en su raíz. Guarda respaldos y evidencias dentro de `release/` o en el perfil local correspondiente. No detengas Codex para reemplazar ZEN.
- Para una publicación autorizada, revisa una lista explícita de fuentes, pruebas, licencias y documentación. Deja fuera del código publicado los ejecutables, capturas, perfiles, credenciales, respaldos, fondos personales y recursos con licencia separada. Valida una copia limpia y verifica la revisión publicada. El procedimiento de instalación está en [Despliegue](docs/DEPLOYMENT.md).
