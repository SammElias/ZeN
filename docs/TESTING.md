# Pruebas de ZEN

## 01 · Capas de verificación ![](assets/violeta.svg)

| Capa | Comando | Alcance |
| --- | --- | --- |
| Unitarias | `npm test -- --maxWorkers=4` | Esquemas, reglas de visibilidad, peticiones, almacenamiento y casos de error. |
| Tipos y producción | `npm run build` | Ejecuta TypeScript sin emitir y construye main, preload y renderer. |
| Auxiliares | `npm run build:native` | Compila los cuatro proyectos del manifiesto de Windows. |
| Electron | `npm run test:electron` | Recorrido de la ventana, IPC y funciones del compañero con un perfil temporal. Requiere bundles y auxiliares compilados. |
| Portable | `node scripts/single-file-smoke.mjs release/single-file/ZEN.exe` | Comprueba extracción, arranque y recorrido del ejecutable concreto. |

El repositorio carece de un script de lint separado. Los comandos históricos de API y agente tienen otro alcance. Para la entrega del compañero usa el recorrido de Electron y el portable según [Despliegue](DEPLOYMENT.md).

## 02 · Regresiones prioritarias ![](assets/azul.svg)

- **Peticiones.** Recibo del chat correcto, rechazo de otro destino, conservación de borrador y ausencia de reenvío automático tras un timeout. [Pruebas de petición](../tests/companion-request.test.ts)
- **Datos de Codex.** Respuesta final disponible solo en Resumen. Probar ausencia, respuesta tardía, destino cambiado y permisos de un uso. [Pruebas del lector](../tests/companion-reader.test.ts)
- **Sonido.** Observación automática, selección de fuente y ejecución solo desde un control explícito. Al ocultar detalles, comprobar que no se envíen controles. [Pruebas de medios](../tests/companion-media.test.ts)
- **Apuntes y respaldo.** Guardado de prompts, Markdown, apertura desde Inicio, exportación, cancelación, restauración de datos y copia de recuperación. Probar un respaldo inválido y un fallo durante la sustitución. [Pruebas de respaldo](../tests/companion-backup.test.ts)
- **Cápsula.** Una ventana, controles accesibles, ajustes persistentes y privacidad. Revisar cabecera y contenido a 320, 380 y 760 DIP, además del ancho nominal.

## 03 · Evidencia y límites ![](assets/verde.svg)

En la entrega del respaldo del **12 de noviembre de 2026** pasaron el build, 564 pruebas en 61 archivos y el recorrido del portable extraído. El recorrido aislado confirmó exportación, cancelación, copia anterior y restauración. La regeneración de estos documentos se valida aparte con enlaces, coherencia y comparación del código.

La ejecución de un portable y las sesiones sintéticas acreditan los casos descritos. El foco sobre aplicaciones reales, el arrastre físico, los cambios de DPI, los avisos de Windows y las conexiones reales de Codex requieren su propia comprobación cuando resulten afectados.

## 04 · Criterio de cierre ![](assets/ambar.svg)

- [ ] Reproducir la acción normal y el caso de error pertinente.
- [ ] Probar con datos sintéticos y preservar perfiles reales.
- [ ] Registrar comando, resultado, artefacto cuando aplique y aspectos pendientes.
- [ ] Actualizar únicamente la documentación afectada. Si solo cambia Markdown, comprobar enlaces y contrastar los comandos con el repositorio.
