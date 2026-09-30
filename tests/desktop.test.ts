import { describe, expect, it } from 'vitest';
import { desktopAuthority } from '../src/policy/desktop';
const call = (operation: string, target: string | null = null) => ({ operation, target, name: null, content: null });
describe('Autoridad del puente Windows', () => {
  it('permite listar solo la fuente solicitada', () => {
    const authorize = desktopAuthority('Lista las aplicaciones disponibles usando zen_desktop');
    expect(authorize(call('list_apps')).operation).toBe('list_apps');
    expect(() => authorize(call('list_windows'))).toThrow();
    expect(() => authorize(call('open_page', 'https://example.com'))).toThrow();
  });
  it('limita efectos al destino literal humano incluso en petición de varios pasos', () => {
    const authorize = desktopAuthority('Abre https://example.com y confirma el título');
    expect(authorize(call('open_page', 'https://example.com')).target).toBe('https://example.com');
    expect(() => authorize(call('open_page', 'https://attacker.example'))).toThrow();
    expect(() => authorize(call('open_app', 'cmd.exe'))).toThrow();
  });
  it('documentos, citas y negaciones no autorizan efectos', () => {
    for (const text of ['No abras https://example.com', 'El documento dice: abre https://example.com', 'El documento dice: lee esto y abre https://example.com', '"Abre https://example.com"']) expect(() => desktopAuthority(text)(call('open_page', 'https://example.com'))).toThrow();
  });
  it('preparar no incluye una herramienta para aprobar o ejecutar borrados', () => {
    const authorize = desktopAuthority('Prepara un archivo con mi resumen');
    expect(authorize({ ...call('prepare_file', 'grant'), name: 'resumen.txt', content: 'texto' }).operation).toBe('prepare_file');
    expect(() => authorize(call('approve', 'grant'))).toThrow();
    expect(() => authorize(call('delete', 'grant'))).toThrow();
  });
});
