# Retorno a la aplicación — 24/10/2026

El usuario observa que al pulsar Volver desde ChatGPT, después de usar Chrome, no cambia de aplicación. La inspección de accesibilidad de la cápsula confirmó «Volver a ChatGPT». El paquete instalado se identifica como OpenAI.Codex, pero sus ventanas se ejecutan con el nombre de proceso `ChatGPT.exe`. El observador anterior descartaba `codex`, por lo que sobrescribía Chrome con la propia aplicación de revisión.

El historial nativo ahora descarta tanto `Codex` como `ChatGPT`, sin distinguir mayúsculas, y conserva el identificador concreto de la ventana de trabajo anterior. No se leen títulos, páginas ni pestañas para decidir el destino. Una regresión nativa ejecuta la secuencia Chrome → ChatGPT → Codex y verifica que se conserva Chrome; también comprueba dos ventanas distintas del mismo navegador y que los nombres parecidos de otras aplicaciones no se excluyen.

La cápsula muestra el nombre del destino junto a la flecha curva. Si Windows rechaza el cambio de foco, el error queda visible y no se borra por un evento de ventana ajeno al resultado. Se mantienen la validación de HWND/PID/inicio de proceso y la prohibición de simular teclas, elevar permisos o forzar ventanas sin un clic.

Uso: trabajar en una ventana de Chrome, entrar en ChatGPT/Codex y pulsar la flecha curva «Google Chrome» de ZEN. La flecha recta continúa abriendo el chat fijado de Codex. El retorno funciona por ventana; no vuelve a una pestaña previa si ChatGPT y el trabajo están dentro de la misma ventana de Chrome. La ventana debe haberse usado mientras ZEN estaba abierto y seguir disponible.

La petición de primer plano sigue las restricciones de Windows: [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow). No se cambian políticas del sistema ni se concede acceso global a otros procesos.

Validación: build, 455 pruebas y recorrido Electron con regresión nativa. La comprobación física con Chrome se detuvo cuando Computer Use indicó que no podía determinar la URL actual con suficiente confianza para aplicar su política. No se continuó con entradas ni se utilizó un controlador alternativo para conducir el navegador. Por tanto, no se presenta el retorno físico a Chrome como validado. Evidencia local y entrega en `docs/evidence/return-app-fix-deployment.json`.
