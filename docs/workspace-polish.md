# Repaso de interfaz y herramientas compactas

Petición del 03/11/2026: aprovechar el modo aplicación con datos más claros, herramientas sencillas y superficies más opacas, tomando los controles táctiles de la referencia visual.

## Cambios

- Superficies de contenido más densas, controles elevados y campos hundidos, contraste uniforme, tipografía y espaciado consistentes. Nuevo valor inicial de opacidad 86 %. Los perfiles existentes conservan sus opciones e imagen: la composición aumenta la densidad del contenido sin reescribir el archivo personal; el deslizador sigue permitiendo ajustarla.
- Home: cuatro tarjetas de estado más compactas y acceso directo a Agenda y Preferencias. No obtiene eventos ni respuestas privadas de otras vistas.
- Codex / Actividad: buscar en acciones y comandos ya observados, Todo/Comandos/Archivos, recientes o antiguos primero, desplegar/plegar detalles y recuento. La clasificación utiliza las etiquetas observadas; el contador no afirma que las pruebas hayan pasado. Resumen añade Copiar respuesta; se conserva el texto inerte original y Abrir Codex.
- Gmail: Todos/Sin leer sobre las conversaciones **cargadas**, con recuento explícito de alcance. Buscar sigue siendo la consulta a Gmail. Navegación por teclado, paginación del lector, revisión de papelera y análisis de correo mantienen sus límites.
- Música: reproductor centrado, fuente reconocible, cambio explícito de reproductor y copia de título/artista/álbum disponibles. La posición sigue siendo informada por Windows; no añade búsqueda de audio, colas, volumen o controles que el reproductor no publique.
- Calendar: Día/Próximos y búsqueda por título o ubicación sobre eventos cargados. Próximos parte del día seleccionado, mantiene finales exclusivos de eventos de día completo y muestra la fecha de cada entrada. Calendario y detalle siguen siendo de solo lectura; las advertencias y carga de páginas adicionales permanecen.
- Avisos: Todos/Permisos/Errores y orden por fecha descendente. Preferencias conserva los controles de uso habitual y pliega el diagnóstico técnico de Codex.

## Límites conservados

Una ventana, cápsula 820×68 con cuatro bloques y sin recuadro exterior nativo, app redimensionable y geometría propia. Exactamente dos pestañas Codex, gobernadas por main: la última respuesta y el contexto solo pasan por IPC en Resumen visible. Los filtros no solicitan nuevas respuestas, reenvían trabajo ni cambian el chat fijado.

Las herramientas locales trabajan sobre datos ya entregados a su vista. No amplían OAuth, proveedores, permisos ni consultas ocultas; no persisten búsquedas, filtros, correos o eventos. Copiar es un clic explícito sobre contenido visible. Se conservan las revisiones de efectos, la retirada de datos al ocultar/pausar/Presentación y las sesiones de Google cifradas.

## Validación

Build y 809 pruebas en 67 archivos. El recorrido de Electron usa proveedores sintéticos y comprueba filtros con coincidencias/vacíos y mezcla de correos leídos/sin leer, búsqueda/restauración, detalles, copia exacta, Próximos/búsqueda sin peticiones adicionales, diagnóstico plegado, colores de acento y superficies más opacas.

Las siete vistas se recorren a anchos nativos 320, 760 y 1180 sin desbordamiento horizontal, además de las regresiones previas de geometría, privacidad, Gmail, Calendar, multimedia y permisos. Las capturas `docs/ui-preview/companion/polish-*.png` contienen datos sintéticos. No se acredita correo/calendario/reproducción reales ni gestos físicos/DPI nuevos, y no se llama a modelos.

Evidencias locales de compilación/recorrido en `docs/evidence/portable-shell.json`, `companion-native.json`, `single-executable.json` y entrega en `workspace-polish-deployment.json`. El ejecutable único se valida extraído antes de reemplazar el del escritorio; respaldo dentro de release y conservación de archivos protegidos comprobados al reiniciar solo ZEN. No se publica mediante este encargo.
