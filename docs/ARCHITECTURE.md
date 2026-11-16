# Arquitectura de ZEN

## 01 · Sistema activo ![](assets/violeta.svg)

ZEN es un compañero local de Codex para Windows. Una sola ventana Electron muestra el estado en una cápsula y abre Inicio, Codex, Sonido y Apuntes en el panel desplegado. Codex conserva la cuenta, los chats y la ejecución. Windows publica las sesiones multimedia. ZEN gestiona la interfaz, las preferencias y la biblioteca local.

Main notifica los cambios de superficie aceptados con un evento semántico. El renderer prepara un `AudioContext` compartido en inactividad y sintetiza cada tono local al primer uso. Los efectos se sustituyen o descartan según el intervalo, y el dispositivo se libera durante la inactividad. Esta salida es independiente de las sesiones multimedia de Windows. [Audio de interfaz](../src/renderer/companion-interface-audio.ts)

El proceso principal se compila con esbuild. El renderer usa React, TypeScript y Vite. El puente usa Zod para validar entradas y el almacenamiento local usa `node:sqlite`. Los auxiliares son proyectos .NET 10. Las versiones se fijan en [package.json](../package.json) y [package-lock.json](../package-lock.json).

## 02 · Límites y responsabilidades ![](assets/azul.svg)

| Límite | Responsabilidad | Fuente |
| --- | --- | --- |
| Renderer | Vistas, navegación, editores y representación del estado. | [Entrada React](../src/renderer/main.tsx) |
| Preload | Expone métodos explícitos de `window.companion` y suscripción al estado. | [Puente](../src/preload/companion.ts) |
| Main | Ventana, bandeja, atajos, estado, visibilidad, diálogos y efectos autorizados. | [Entrada Electron](../src/main/companion-main.ts) · [IPC](../src/main/companion-ipc.ts) |
| Contratos | Esquemas, tipos y reglas de presentación compartidos. | [Contrato del compañero](../src/shared/codex-companion.ts) |
| Auxiliares Windows | El hook transmite eventos, el auxiliar de escritorio observa ventanas y el de medios usa las sesiones de Windows. La compilación también incluye `Zen.Windows`. | [Manifiesto de auxiliares](../config/native-helpers.json) |
| Construcción y pruebas | Bundles, empaquetado portable y recorridos con perfiles de prueba. | [Despliegue](DEPLOYMENT.md) · [Pruebas](TESTING.md) |

```mermaid
flowchart LR
    UI["React: cápsula y panel"] <-->|"API de preload"| IPC["Puente IPC"]
    IPC <-->|"Entradas validadas y estado filtrado"| Main["Electron main"]
    Main -->|"Cola al chat fijado"| Codex["Codex local"]
    Codex -->|"Hooks por pipe local"| Main
    Main -->|"Lectura acotada en Resumen"| History["Índice y sesión de Codex"]
    Main <-->|"SQLite y JSON"| Profile["Perfil de ZEN"]
    Main <-->|"Auxiliares .NET"| Windows["Sesiones multimedia y ventanas"]
```

## 03 · Flujo de datos ![](assets/turquesa.svg)

1. **Petición.** Main comprueba la vista y el destino. Con chat fijado, el CLI ejecuta `queue --thread` y ZEN valida que el recibo corresponda a ese chat. Sin destino, se prepara un borrador en Codex o se copia el texto cuando el enlace supera el límite. Un recibo acredita la cola. El turno se observa por separado.
2. **Actividad y respuesta.** El puente recoge eventos de Codex. Actividad muestra señales y Permisos gestiona decisiones pendientes. Resumen puede leer la última respuesta final del destino fijado. Analizar agrega una revisión de un uso y una referencia para correlacionar el resultado.
3. **Sonido.** Un observador lee automáticamente la sesión en reproducción o en pausa que publica Windows. Un controlador separado actúa sobre la sesión seleccionada con un gesto explícito. La cabecera comparte esa sesión con Sonido cuando su reproductor está abierto. El reproductor compacto conserva su autorización propia.
4. **Apuntes.** Knowledge Hub lee y escribe su propia biblioteca. Inicio recibe hasta cuatro apuntes recientes con metadatos de navegación. El [IPC de Apuntes](../src/main/companion-notes-ipc.ts) gestiona la vista y sus archivos. El [IPC de respaldo](../src/main/companion-backup-ipc.ts) gestiona desde Preferencias la copia portable de la biblioteca y de los ajustes.

## 04 · Persistencia y decisiones ![](assets/verde.svg)

| Datos | Almacenamiento y propiedad |
| --- | --- |
| Apuntes, prompts y borradores | `knowledge-hub.sqlite` en el perfil ZEN. [Knowledge Hub](../src/main/knowledge-hub.ts) contempla la biblioteca anterior en JSON. |
| Preferencias y aspecto | JSON local y fondo normalizado. La posición se guarda por monitor. El respaldo portable reúne solo los datos descritos en [Despliegue](DEPLOYMENT.md). |
| Última respuesta | Índice SQLite y sesión JSONL de Codex, de solo lectura para ZEN. |
| Actividad, avisos y revisiones | Estado acotado de la sesión en memoria. |

La autoridad sobre los efectos queda en main. La cápsula y el Workspace comparten ventana, renderer y geometría guardada en `companion-workspace-window.json`. En la cápsula se muestra la cabecera. Al desplegar, se conserva su posición y ancho y se habilitan los bordes redimensionables del Workspace. Windows gestiona el acoplamiento y los controles de título permanecen en ambos modos. [Estado de ventana](../src/main/companion-workspace-window.ts)

La isla, la barra y el panel comparten una ventana de Electron y los mismos tokens de apariencia. El selector y Preferencias usan la misma operación de ubicación. El anclaje guarda el monitor y la posición relativa al área útil. La geometría flotante se guarda por separado para restaurarla al salir de un borde. Electron aplica la silueta como región Win32. El auxiliar de escritorio mide el desfase de cliente por monitor para alinear el recorte con la escala de Windows. Al cambiar de posición se conserva el panel y sus datos de edición. Main autoriza los efectos privados según la vista. El candado controla el arrastre, Mantener expandida controla la contracción automática y Siempre encima controla el orden Z. [Ventana principal](../src/main/companion-main.ts)

La X minimiza la ventana de ZEN y la conserva en la barra de tareas. Al restaurar vuelven la misma vista y el borrador de Inicio mantenido en memoria. Al minimizar, main sigue revocando el contexto de revisión y los accesos que requieren una vista visible. **Salir de ZEN** ejecuta el cierre de Electron y libera el bloqueo de instancia.

Codex ejecuta las consultas de Gmail y Calendar mediante las conexiones configuradas allí. El arranque activo usa el compañero de Codex y el repositorio conserva implementaciones históricas fuera de ese flujo.

## 05 · Dependencias y límites ![](assets/ambar.svg)

El envío directo depende de la compatibilidad del CLI con `queue`. La lectura del último mensaje depende del formato local de Codex. El reproductor solo puede mostrar y controlar lo que exponga Windows. Ante una entrega incierta, revisar el chat antes de reenviar. Los límites de acceso se detallan en [Seguridad](SECURITY.md).
