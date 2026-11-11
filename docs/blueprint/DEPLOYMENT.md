# Construcción y entrega

## Preparar y verificar

En Windows, con las herramientas de [Entorno](ENVIRONMENT.md):

```powershell
npm ci
npm run build:native
npm run build
npx vitest run --maxWorkers=4
npm run test:electron
```

Para un portable local:

```powershell
npm run package:win
npm run package:single -- release/ZEN-<identificador-del-paquete>
```

`package:win` reconstruye auxiliares y bundles; usar el directorio real que emite antes de empaquetar. Probar el paquete extraído en un perfil aislado y comprobar la identidad del artefacto. Si se ha pedido instalarlo, respaldar el ejecutable previo en `release/`, sustituir solo el `ZEN.exe` del escritorio y verificar el hash y el arranque. Conservar el perfil, Codex y las aplicaciones ajenas.

Los informes de empaquetado se generan en `docs/evidence/` al ejecutar las pruebas correspondientes. Son salidas locales ignoradas por Git; la documentación de referencia está en el Blueprint.

## Reversión y publicación

Si el arranque de la entrega falla, restaurar el ejecutable respaldado con ZEN cerrado. No reemplazar preferencias ni cuentas por una copia de pruebas. Una publicación de fuentes se prepara aparte y requiere una revisión del conjunto a publicar; dejar fuera binarios, perfiles, capturas privadas y material con licencia separada. Ver [reglas del repositorio](../../AGENTS.md).
