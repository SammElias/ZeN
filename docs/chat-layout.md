# Ajuste del chat · 01/10/2026

La captura del usuario mostraba una franja de conversación recortada, flechas de desplazamiento sin texto visible y un campo de escritura demasiado alto. Se corrigieron tres causas:

- El cambio de contexto visual de `idle` a una ficha visible no renovaba siempre la medición de los controles. Ahora se mide al cambiar el estado de la captura.
- El textarea conservaba la altura calculada mientras la ventana aún tenía el ancho de la cápsula. Ahora observa el ancho, parte de una línea cuando está vacío y adapta el texto escrito al ensancharse.
- La altura del mensaje excluía su espaciado y no se actualizaba al cambiar el ancho. Ahora el contenido contiene sus márgenes y se mide con el relleno de la zona de lectura, únicamente cuando el texto está asentado.

La apertura vacía presenta una bienvenida breve. Mensaje, ficha, campo de escritura y micrófono comparten alineación; la disponibilidad/hora de la captura permanece visible a 640 DIP. El campo tiene 36 DIP de alto vacío, con clip y envío centrados. El último mensaje y el stream siguen siendo los únicos mensajes visibles.

Validado con build TypeScript/Vite, Edge con puente simulado y Electron real. El caso de regresión monta el compositor a 240×40, ensancha a 640, añade contexto después de `idle`, comprueba que la ventana reserva 34 DIP adicionales y que no aparece scroll en el saludo, y verifica texto a varios anchos. Incluye captura de 390 DIP. La prueba de stream mantiene 424 DIP, cero layouts por delta y texto literal.

Evidencia: `docs/evidence/chat-layout-ui.json`, `docs/evidence/chat-layout-electron.json`; capturas indicadas en el informe UI. Entrega y hash del ejecutable en `docs/evidence/single-executable-deployment.json`. No se hicieron llamadas nuevas a modelos ni se cambió el agente o el JSON Live. Las pruebas de control físico del equipo pendientes siguen descritas en `docs/objective-verification.md`.

El EXE del escritorio fue sustituido y la nueva instancia arrancó. La activación física para expandirla mediante Computer Use devolvió `failed to activate captured window`, también después de recuperar la ventana; se detuvo ese intento. La captura visual de la nueva distribución corresponde al renderer con puente simulado, no a una comprobación física del chat abierto en la sesión del usuario.
