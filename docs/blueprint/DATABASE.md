# Datos y persistencia

## Motor y propiedad

ZEN guarda las preferencias y la biblioteca de Apuntes en el perfil local `%APPDATA%\ZEN`. Lee de forma acotada el índice SQLite de **Codex**, con `readOnly: true` y `query_only`, y el JSONL de la sesión correspondiente. El esquema y las migraciones de esos archivos pertenecen a Codex.

| Dato | Propietario y validación | Vida útil |
| --- | --- | --- |
| `companion-target.json` | Perfil ZEN. `session`, `cwd` y `title` validados; sesión y carpeta deben coincidir. | Hasta que el usuario cambie el vínculo. |
| `companion-settings.json` y `companion-launcher.json` | Perfil ZEN. Preferencias y navegación tipadas. | Persiste entre arranques. |
| `companion-placement.json` | Anclaje de la cápsula por monitor; se guarda al terminar un movimiento. El panel hereda el anclaje. | Persiste entre arranques. |
| `companion-appearance.json` y `appearance/` | Opciones de tema y fondo, imagen local normalizada. | Persiste al guardar. |
| `knowledge-hub.sqlite` | Perfil ZEN. Notas, prompts, carpetas, imágenes adjuntas, tema y borradores. | Persiste entre arranques. |
| `codex-companion/bridge.json` | Identidad del pipe y token local. Solo para el puente. | Configuración privada de la instalación. |
| `state_5.sqlite` → `rollout_path` → JSONL | Índice de Codex. Consulta parametrizada por ID; ruta confinada al directorio de Codex y cabecera verificada. | Externo; ZEN no lo escribe. |
| Acciones, avisos, revisiones y resultados asociados | Estado acotado de la sesión; revalidación según vista y privacidad. | Memoria de ZEN. |

## Cambios, auditoría y fixtures

En **Apuntes → Respaldo y exportación**, **Exportar JSON** guarda la biblioteca y **Restaurar JSON** sustituye la biblioteca de destino. Conserva el archivo en una ubicación privada. El repositorio de GitHub contiene el código. Actualizarlo no modifica los datos del perfil de Windows.

Mantener compatibilidad al leer preferencias anteriores. Los cambios de escritura deben demostrar recuperación ante JSON inválido y no sobrescribir datos válidos sin una acción de guardado. No hay borrado lógico ni auditoría duradera propia; el historial de Codex no es un registro de ZEN. Las pruebas usan perfiles temporales y contenido sintético; no necesitan semillas de producción.

Fuentes: [arranque](../../src/main/companion-main.ts), [apariencia](../../src/main/companion-appearance.ts), [posición](../../src/storage/overlay-position.ts), [lector](../../src/main/companion-codex-reader.ts).
