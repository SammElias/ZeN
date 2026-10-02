import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PauseGate} from '../src/agent/pause-gate';
import {PersonalStore} from '../src/storage/personal';
import {Spending} from '../src/storage/spending';
import {SettingsSchema} from '../src/shared/contracts';
import {requestRoute} from '../src/shared/workspace';
import {exportResult} from '../src/main/result-export';
import {generatedFiles} from '../src/tools/generated-files';
import {Artifacts} from '../src/tools/artifacts';
const directories:string[]=[];
async function directory(){const p=await mkdtemp(join(tmpdir(),'zen-workspace-'));directories.push(p);return p;}
afterEach(async()=>{for(const path of directories.splice(0))await rm(path,{recursive:true,force:true});});
describe('Workspace operations',()=>{
 it('pauses new effects, resumes once and never replays aborted work',async()=>{
  const gate=new PauseGate(),controller=new AbortController(),effect=vi.fn();gate.pause();
  const a=gate.wait(controller.signal).then(effect);await Promise.resolve();expect(effect).not.toHaveBeenCalled();gate.resume();await a;expect(effect).toHaveBeenCalledOnce();
  gate.pause();const b=gate.wait(controller.signal).then(effect);const rejected=expect(b).rejects.toThrow();controller.abort();gate.resume();await rejected;expect(effect).toHaveBeenCalledOnce();
 });
 it('persists editable favorites and recovers checkpoints without replay',async()=>{
  const path=await directory(),store=new PersonalStore(path),favorite={id:randomUUID(),label:'Mi revisión',prompt:'Explica el texto seleccionado'};store.saveFavorites([favorite]);
  store.task({id:'task',request:'Completar formulario',state:'executing',message:'Campo escrito',checkpoint:'Escrito en formulario',paused:true});
  const restarted=new PersonalStore(path);restarted.recover();expect(restarted.favorites()).toEqual([favorite]);expect(restarted.tasks()[0]).toMatchObject({state:'failed',paused:false,checkpoint:'Escrito en formulario'});expect(()=>store.saveFavorites([favorite,favorite])).toThrow('duplicados');
 });
 it('attributes concurrent task receipts separately and blocks more calls after budget',async()=>{
  const spend=new Spending(await directory(),()=>SettingsSchema.parse({}));
  await Promise.all(['a','b'].map((id,index)=>spend.scope(id,.05,async()=>{await Promise.resolve();const receipt=spend.reserve('agent','gpt-6.1-sol',.5);spend.record(receipt,id,'gpt-6.1-sol',{input_tokens:1000,output_tokens:index?100:5000});spend.finish(receipt,true);if(!index)expect(()=>spend.check(receipt)).toThrow('presupuesto');})));
  expect(spend.task('a')).toMatchObject({inputTokens:1000,outputTokens:5000,budgetEur:.05,uncertain:false});expect(spend.task('b')?.estimatedEur).toBeCloseTo(.0035);
  expect(()=>spend.scope('a',.05,()=>spend.reserve('agent','gpt-6.1-sol',.5))).toThrow();expect(spend.task('local')).toBeUndefined();
 });
 it('saves Unicode results without overwriting or changing extension',async()=>{
  const path=join(await directory(),'resultado.md');await exportResult(path,Buffer.from('Prueba ñ'),'.md');expect(await readFile(path,'utf8')).toBe('Prueba ñ');await expect(exportResult(path,Buffer.from('otra'),'.md')).rejects.toThrow('existe');expect(await readFile(path,'utf8')).toBe('Prueba ñ');await expect(exportResult(path+'.exe',Buffer.from('x'),'.md')).rejects.toThrow('extensión');
 });
 it('previews local, desktop Codex and paid routes without sending context',()=>{
  expect(requestRoute('Copia la respuesta')).toBe('local');expect(requestRoute('Lee localmente C:\\Demo\\file.txt sin API')).toBe('local');expect(requestRoute('Analiza la carpeta adjunta')).toBe('codex');expect(requestRoute('Explica este error')).toBe('api');
 });
 it('downloads only cited files from observed containers and deduplicates citations',async()=>{
  const retrieve=vi.fn(async()=>new Response('a,b\n1,2',{headers:{'content-type':'text/csv'}})),store=new Artifacts();
  const ref={type:'container_file_citation',container_id:'allowed',file_id:'file',filename:'/mnt/data/resultado.csv'};
  const response={output:[{type:'message',content:[{type:'output_text',annotations:[ref,ref,{...ref,file_id:'foreign',container_id:'other'},{...ref,file_id:'exe',filename:'run.exe'}]}]}]} as any;
  const result=await generatedFiles({containers:{files:{content:{retrieve}}}} as any,response,new Set(['allowed']),store,new AbortController().signal);expect(result).toHaveLength(1);expect(retrieve).toHaveBeenCalledOnce();expect(store.get(result[0].id).data.toString()).toBe('a,b\n1,2');
  retrieve.mockImplementation(async()=>new Response('x',{headers:{'content-length':'10000001'}}));await expect(generatedFiles({containers:{files:{content:{retrieve}}}} as any,response,new Set(['allowed']),store,new AbortController().signal)).rejects.toThrow('10 MB');
 });
});
