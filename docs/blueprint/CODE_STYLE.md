# Convenciones de código

- Mantener tipos y esquemas de IPC en `src/shared`; colocar estado, ventanas y operaciones del sistema en `src/main`; usar `src/preload` como frontera tipada y `src/renderer` para interacción y presentación.
- Seguir el estilo cercano: PascalCase para componentes y tipos, camelCase para funciones y datos, y archivos `companion-*.ts` para servicios. Mantener imports explícitos y tipos con `import type` donde proceda.
- Escribir funciones alrededor de una responsabilidad real. Reusar los validadores, componentes y tokens existentes; extraer una abstracción cuando elimine una duplicación significativa.
- Manejar errores de usuario con texto breve y próximo a la acción. Conservar las diferencias entre cancelación, rechazo y resultado no confirmado. Revalidar tras esperas si puede cambiar la autorización.
- Los comentarios deben explicar invariantes poco obvias: caducidad, revalidación, aislamiento o una API nativa peculiar. No describir línea a línea el código.
- No poner lectura de archivos, ejecución o decisiones de permisos en React. No ampliar IPC con canales genéricos ni cambiar contratos históricos para un flujo que no los usa. No imprimir payloads, secretos o historiales.
- Ajustar el formato al archivo que se toca. `npm run build` ejecuta `tsc --noEmit`; el manifiesto no define un script `lint`. Evitar reformatear módulos ajenos al cambio.

Ver [manifiesto](../../package.json), [contratos](API.md) y [pruebas](TESTING.md).
