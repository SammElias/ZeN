# Isla superior · última intervención

Voz actual GPT-Live: [implementación y pruebas](live-status.md). Captions literales por intervalos; revisión de transcripción para herramientas propias. No se ha generado nuevo portable.

Diseño actualizado el 01/10/2026 conforme a la petición del usuario: contexto de ejecución y stream, sin configuración en la cápsula. La última intervención de Tú/ZEN sustituye a la anterior; no hay historial visible ni campo de escritura.

## Implementado

- Recogida **640×48 DIP**, expandida **1120×210 DIP**, ajustadas a pantallas pequeñas. Anclaje al borde superior del área útil. La altura aumenta cuando es necesario revisar aprobaciones concretas.
- Cabecera/personaje arrastrables hacia los lados y entre pantallas. El cursor selecciona el monitor y main calcula geometría y límites; no acepta coordenadas arbitrarias por IPC. Conserva posición al expandir, recoger, ocultar y reabrir; persistencia fuera del repositorio. Pérdida de foco, ocultar y timeout detienen el seguimiento.
- Una intervención con etiqueta **Tú** o **ZEN**: transcripción parcial autenticada, stream público del resultado y transcripción de la respuesta hablada. Sin tarjetas de tareas, pestañas, historial, composer ni «Te leo». Los eventos antiguos tras una interrupción no sustituyen el mensaje nuevo.
- Texto completo desplazable y fuentes accesibles; conserva fuentes y artefactos del resultado durante la lectura breve por voz. El stream es provisional hasta verificar el turno; no se muestran razonamiento interno, JSON bruto ni acciones narrativas.
- Clip para contexto opcional: elegir ventana, revisar texto/captura y adjuntarlo una vez a la siguiente petición hablada. Expira en dos minutos. También permite elegir carpeta para creación revisada y seleccionar un reproductor concreto. No captura automáticamente ni otorga permisos a documentos.
- Aprobaciones pendientes con destino/contenido inmutables, de un uso. Aunque llegue otra intervención, la creación no se ejecuta sin esa aprobación.
- Micrófono visible, push-to-talk, reunión, silencio de salida y Detener. Detener cancela tareas, voz y nuevas capturas/herramientas; no revierte efectos existentes. Ocultar desconecta voz y conserva investigación/resultados; recoger mantiene tareas y voz.
- Compañero original, sonidos locales y movimiento reducido. Preferencias, perfil, biblioteca local y MCP se gestionan fuera de la cápsula desde la bandeja. Secretos protegidos en main, renderer aislado e IPC validado.

## Probado

188 pruebas en 19 archivos y build completados. [Edge headless](evidence/latest-ui.json): 28 comprobaciones de última intervención, stream, interrupciones, fuentes, anchos, movimiento del puntero, silencio de sonidos, preferencias, aprobaciones simuladas, scroll, ocultar sin Stop y pantalla pequeña. La vista web es una simulación.

[Electron/Windows](evidence/latest-electron.json): 640×48 y 1120×210 DIP, última intervención, interrupciones, aislamiento, bloqueo de IPC inválido, preferencias y secretos ficticios DPAPI. Movimiento nativo sobre dos monitores reales con cursor sintético, siempre arriba y posición guardada. Lectura de archivo propio de prueba sin clave API. No acredita movimiento físico del ratón, voz física ni cambios de DPI.

El paquete anterior a la instrucción de no crear más ejecutables pasó únicamente la comprobación de interfaz: [evidencia](evidence/portable-interface.json). **No generar nuevos .exe hasta que el usuario lo indique.**

## Pendiente

El [recorrido completo actual](evidence/objective-current.json) falló al conservar foco al abrir página/archivo y al establecer el foco en segundo plano de reunión. Pendientes arrastre manual, DPI variados, desconexión de monitor, micrófono/altavoces y Teams reales. [Objetivo y requisitos](objective-verification.md), [herramientas y límites](toolkit-status.md) y [orden de GPT-Live](handoffs/order.md).
