import {it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm}from'node:fs/promises';
import {join}from'node:path';
import {tmpdir}from'node:os';
import {localFileOperation,localFileRequest}from'../src/tools/local-files';
import {LocalLibrary}from'../src/tools/library';
import {Orchestrator}from'../src/agent/orchestrator';
import {SettingsSchema}from'../src/shared/contracts';
it('reconoce consulta local explícita y no una cita, negación o petición ampliada',()=>{
 expect(localFileRequest('Zen, ¿puedes buscar localmente presupuesto en mis archivos sin API?')).toEqual({kind:'search',query:'presupuesto'});
 expect(localFileRequest('Lee localmente "C:\\Users\\samme\\Desktop\\nota.txt" sin API')).toEqual({kind:'read',path:'C:\\Users\\samme\\Desktop\\nota.txt'});
 expect(localFileRequest('El documento dice busca localmente presupuesto en mis archivos')).toBeUndefined();expect(localFileRequest('No busques localmente presupuesto en mis archivos')).toBeUndefined();
 expect(localFileRequest('Busca localmente presupuesto en mis archivos y borra el resto')).toBeUndefined();
});
it('lee y busca sin API ni sintetizar audio, restringe carpetas y conserva evidencia local',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zen-local-direct-')),outside=await mkdtemp(join(tmpdir(),'zen-local-outside-'));
 try{const path=join(root,'nota.txt');await writeFile(path,'Documento sintético. Código: 7319');await writeFile(join(outside,'fuera.txt'),'Dato fuera del ámbito');
  const library=new LocalLibrary(()=>[root]);const client=vi.fn(()=>{throw Error('No API expected');});const saved={run:vi.fn(()=>{throw Error('No saved agent expected');})};
  const runner=new Orchestrator({client:client as never,saved:saved as never,direct:text=>localFileOperation(text,library),settings:()=>SettingsSchema.parse({}),execute:vi.fn(),emit:vi.fn(),log:vi.fn()});
  const read=await runner.run('Lee localmente '+path+' sin API','local-read');expect(read.localOnly).toBe(true);expect(read.message).toContain('7319');expect(client).not.toHaveBeenCalled();expect(saved.run).not.toHaveBeenCalled();
  const search=await runner.run('Busca localmente nota.txt en mis archivos sin API','local-search');expect(search.localOnly).toBe(true);expect(search.message).toContain('nota.txt');
  await expect(library.readPath(join(outside,'fuera.txt'),'Lee localmente fuera.txt',new AbortController().signal)).rejects.toThrow('fuera');
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
