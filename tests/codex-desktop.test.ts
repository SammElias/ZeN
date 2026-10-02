import {describe,it,expect,vi} from 'vitest';
import {CodexDesktop,codexFolderLink,folderAnalysisRequest} from '../src/main/codex-desktop';
describe('Carpetas con Codex del escritorio',()=>{
  it('encodes exact local path and request, passes no file contents and asks for bounded read-only analysis',()=>{
    const path='C:\\Proyecto & diseño\\prueba #1',request='Analiza la estructura & los fallos. ñ';
    const url=new URL(codexFolderLink(path,request));expect(url.protocol).toBe('codex:');expect(url.hostname).toBe('new');expect(url.searchParams.get('path')).toBe(path);expect(url.searchParams.get('prompt')).toContain(request);expect(url.searchParams.get('prompt')).toContain('Solo lectura');expect(url.searchParams.get('prompt')).toContain('Sin subagentes');expect(url.searchParams.get('prompt')).toContain('archivos pertinentes');
    expect(()=>codexFolderLink('relative','Analiza')).toThrow();expect(()=>codexFolderLink(path,'')).toThrow();
  });
  it('opens only the official link and reports prepared rather than analyzed',async()=>{
    const open=vi.fn(async()=>{}),desktop=new CodexDesktop({open});
    const result=await desktop.openFolder('C:\\Proyecto','Analiza',new AbortController().signal);expect(open).toHaveBeenCalledWith(expect.stringMatching(/^codex:\/\/new\?/));expect(result).toContain('Pulsa Enviar');expect(result).toContain('no ha enviado');
  });
  it('never falls back to paid API or starts after stop/missing application',async()=>{
    const open=vi.fn(async()=>{throw Error('missing');}),desktop=new CodexDesktop({open});
    await expect(desktop.openFolder('C:\\Proyecto','Analiza',new AbortController().signal)).rejects.toThrow('No se usará la API');expect(open).toHaveBeenCalledOnce();
    const controller=new AbortController();controller.abort();await expect(desktop.openFolder('C:\\Proyecto','Analiza',controller.signal)).rejects.toThrow();expect(open).toHaveBeenCalledOnce();
  });
  it('routes folder analysis requests rather than general conversation or folder creation',()=>{
    for(const text of ['Analiza esta carpeta','Revisa el repositorio','Explícame la estructura del proyecto','Audita las carpetas'])expect(folderAnalysisRequest(text)).toBe(true);
    for(const text of ['Hola','Crea una carpeta','Analiza esta imagen'])expect(folderAnalysisRequest(text)).toBe(false);
  });
});
