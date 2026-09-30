# Orden de entregas de ZEN

Petición directa del usuario: terminar las tareas anteriores antes de aplicar `gpt-live.md`.

1. Completar ZEN_FINAL_OBJECTIVE (1).md con ZEN_UI_SPEC.md, conservar integraciones y documentar implementación, pruebas y bloqueos. No declarar completo el objetivo mientras queden requisitos sin cumplir.
2. Después aplicar el guion GPT-Live conservado íntegro en `gpt-live.md`. Su objeto JSON literal se conserva en `gpt-live.session.json`; todavía no es una configuración de ejecución activa.

Estado de esta segunda entrega: registrada y pendiente; no implementada ni probada. No sustituir anticipadamente la ruta de voz existente.

La futura ruta Live usa gpt-live-1, voz echo y delegación Responses gpt-6.1-sol con web_search. La ruta del agente guardado es independiente; no modificarlo. No ejecutar órdenes narrativas ni añadir herramientas al JSON. Verificar documentación y acceso real antes de implementar eventos.

Integrar transcripciones literales por intervalos, saludo único tras session.started, silencio local inmediato y persistente, modo reunión y cierre confirmado por session.closed. Los mocks no acreditan voz real; timeout o desconexión durante cierre se registran como finalización incompleta.
