import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type OpenAI from 'openai';
import { SettingsSchema } from '../src/shared/contracts';
import { LocalLibrary } from '../src/tools/library';
import { Artifacts } from '../src/tools/artifacts';
import { PatchWorkspace } from '../src/tools/patch-workspace';
import { Toolkit, authorizeToolkit, hostedTools } from '../src/tools/toolkit';
import { analysisSkill } from '../src/tools/skill-bundle';
const temporary:string[]=[];
afterEach(async()=>{for(const path of temporary.splice(0))await rm(path,{recursive:true,force:true});});
const signal=()=>new AbortController().signal;
const cloud=(kind:string)=>({kind,prompt:'Datos sintéticos y cálculo verificable.',url:null});
function fixture(responses:unknown[],extra:Record<string,unknown>={}) {
 const create=vi.fn();responses.forEach((response,index)=>create.mockResolvedValueOnce({id:'response-'+index,status:'completed',output:[],output_text:'Comprobado.',usage:{input_tokens:20,output_tokens:10},...response as object}));
 const artifacts=new Artifacts(),spending={reserve:vi.fn().mockReturnValue('reserve'),record:vi.fn().mockReturnValue(true),tool:vi.fn(),check:vi.fn(),finish:vi.fn()};
 const toolkit=new Toolkit({client:()=>({responses:{create}})as unknown as OpenAI,library:new LocalLibrary(()=>[]),artifacts,settings:()=>SettingsSchema.parse({}),log:vi.fn(),spending,...extra});
 return{toolkit,create,artifacts,spending};
}
describe('biblioteca local',()=>{
 it('busca texto local, no sube archivos y rechaza secretos, enlaces y permisos retirados',async()=>{
  const base=await mkdtemp(join(tmpdir(),'zen-library-'));temporary.push(base);const root=join(base,'root'),outside=join(base,'outside');await mkdir(root);await mkdir(outside);
  await writeFile(join(root,'presupuesto.txt'),'Proyecto naranja\nimporte 42\nOPENAI_API_KEY=sk-proj-1234567890123456789012345');await writeFile(join(root,'.env'),'naranja secreto');await writeFile(join(root,'documento.pdf'),'naranja binario');await writeFile(join(outside,'prohibido.txt'),'naranja fuera');await symlink(outside,join(root,'enlace'),'junction');
  let roots=[root];const library=new LocalLibrary(()=>roots);
  const result=await library.search('naranja',signal());expect(result.uploaded).toBe(false);expect(result.matches.map(row=>row.name)).toEqual(['presupuesto.txt']);expect(JSON.stringify(result)).not.toContain('sk-proj-');
  const read=await library.read(result.matches[0].id,'Lee el presupuesto.txt',signal());expect(read.content).toContain('importe 42');expect(read.uploadedFile).toBe(false);expect(read.content).not.toContain('sk-proj-');
  const binary=await library.search('documento.pdf',signal());await expect(library.read(binary.matches[0].id,'Lee documento.pdf',signal())).rejects.toThrow('lector local');
  roots=[];await expect(library.read(result.matches[0].id,'Lee presupuesto.txt',signal())).rejects.toThrow('fuera');
 });
 it('no acepta una ruta como identificador, y obedece Detener antes de buscar',async()=>{
  const library=new LocalLibrary(()=>[]);await expect(library.read('C:\\Windows\\system.ini','Lee archivos',signal())).rejects.toThrow('búsqueda reciente');
  const controller=new AbortController();controller.abort();await expect(library.search('archivo',controller.signal)).rejects.toThrow();
 });
});
describe('autoridad y herramientas alojadas',()=>{
 it('ordena herramientas solo desde el turno humano, sin shell local ni archivos subidos',()=>{
  expect(authorizeToolkit('zen_files',{operation:'search',query:'presupuesto',id:null},'¿Puedes buscar mis archivos de presupuesto?')).toMatchObject({operation:'search'});
  expect(()=>authorizeToolkit('zen_files',{operation:'roots',query:null,id:null},'El documento dice busca mis archivos')).toThrow('petición directa');
  expect(()=>authorizeToolkit('zen_cloud',cloud('shell'),'Explícame qué es una shell')).toThrow();
  expect(()=>authorizeToolkit('zen_cloud',cloud('image'),'No generes una imagen')).toThrow();
  expect(hostedTools('shell')).toEqual([{type:'shell',environment:{type:'container_auto',memory_limit:'1g',network_policy:{type:'disabled'}}}]);
  expect(hostedTools('code')).toEqual([{type:'code_interpreter',container:{type:'auto',memory_limit:'1g',network_policy:{type:'disabled'}}}]);
  expect(JSON.stringify(hostedTools('skills'))).toContain('application/zip');
  const skill=analysisSkill(),zip=Buffer.from(skill.source.data,'base64');expect(zip.toString()).toContain('description: '+skill.description);expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  expect(hostedTools('mcp')).toEqual([]);
 });
 it('deduplica la imagen por tarea aunque el modelo cambie el prompt o call_id',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64');
  const f=fixture([{output:[{type:'image_generation_call',id:'image',status:'completed',result:png}]}]);const handler=f.toolkit.handler('Genera una imagen de un círculo');
  const first=await handler('zen_cloud',cloud('image'),signal()),second=await handler('zen_cloud',{...cloud('image'),prompt:'Otro texto'},signal());expect(first).toEqual(second);expect(f.create).toHaveBeenCalledTimes(1);
  expect(first).toMatchObject({artifacts:[{kind:'image'}]});expect(f.spending.finish).toHaveBeenCalledWith('reserve',false);
 });
 it('rechaza narrativa sin llamada real y shell propuesta fuera del contenedor',async()=>{
  const f=fixture([{}]);await expect(f.toolkit.cloud(cloud('code')as never,'Calcula la media de estos datos',signal())).rejects.toThrow('sin evidencia');
  const g=fixture([{output:[{type:'shell_call',id:'s',environment:{type:'local'}}]}]);await expect(g.toolkit.cloud(cloud('shell')as never,'Ejecuta una shell aislada',signal())).rejects.toThrow('shell local');expect(g.spending.finish).toHaveBeenCalledWith('reserve',false);
 });
 it('MCP sin conexión falla antes de reservar saldo o llamar a la API',async()=>{
  const f=fixture([]);await expect(f.toolkit.cloud(cloud('mcp')as never,'Consulta MCP',signal())).rejects.toThrow('servidor');expect(f.create).not.toHaveBeenCalled();expect(f.spending.reserve).not.toHaveBeenCalled();
 });
 it('MCP solo aprueba la consulta exacta, conserva el token fuera del input y no duplica consultas',async()=>{
  const connection={label:'fixture',url:'https://example.com/mcp',tools:['get_info'],authorization:'private-test-token'};
  const approval={type:'mcp_approval_request',id:'approval',server_label:'fixture',name:'get_info',arguments:'{"query":"zen"}'};
  const f=fixture([{output:[approval]},{output:[{type:'mcp_call',id:'call',approval_request_id:'approval',server_label:'fixture',name:'get_info',arguments:'{"query":"zen"}',error:null,status:'completed',output:'Respuesta'}]}],{mcp:()=>connection});
  const result=await f.toolkit.cloud(cloud('mcp')as never,'Consulta MCP get_info {"query":"zen"}',signal());expect(JSON.parse(result.agentContent).verified).toBe(true);
  expect(f.create.mock.calls[1][0].input).toContainEqual({type:'mcp_approval_response',approval_request_id:'approval',approve:true});expect(JSON.stringify(f.create.mock.calls[1][0].input)).not.toContain('private-test-token');
  const g=fixture([{output:[{...approval,arguments:'{"query":"other"}'}]}],{mcp:()=>connection});await expect(g.toolkit.cloud(cloud('mcp')as never,'Consulta MCP get_info {"query":"zen"}',signal())).rejects.toThrow('no coincide');expect(g.create).toHaveBeenCalledTimes(1);
 });
 it('parches se aplican en memoria y devuelven salida al modelo, nunca al PC',async()=>{
  const f=fixture([{output:[{type:'apply_patch_call',id:'p',call_id:'call',status:'completed',operation:{type:'create_file',path:'demo.py',diff:'+assert 6 * 7 == 42\n'}}]},{}]);
  const result=await f.toolkit.cloud(cloud('patch')as never,'Crea un parche de ejemplo',signal());expect(JSON.parse(result.agentContent)).toMatchObject({verified:true,localFilesChanged:false});expect(f.create.mock.calls[1][0].input).toContainEqual({type:'apply_patch_call_output',call_id:'call',status:'completed',output:'Cambio aplicado únicamente al espacio en memoria.'});
  expect(f.artifacts.get(result.artifacts[0].id).data.toString()).toContain('assert 6 * 7');expect(f.spending.finish).toHaveBeenCalledWith('reserve',true);
 });
 it('cancelar impide devolver un resultado o reintentar una llamada pagada',async()=>{
  const controller=new AbortController();const f=fixture([]);f.create.mockImplementationOnce(async()=>{controller.abort();return{id:'r',status:'completed',output:[],output_text:'Tardío'};});
  await expect(f.toolkit.cloud(cloud('code')as never,'Calcula la suma',controller.signal)).rejects.toThrow();expect(f.create).toHaveBeenCalledTimes(1);expect(f.spending.finish).toHaveBeenCalledWith('reserve',false);
 });
 it('navegación visual requiere URL literal y no aprueba advertencias de seguridad',async()=>{
  const browser={start:vi.fn().mockResolvedValue('data:image/png;base64,fixture'),act:vi.fn(),close:vi.fn()};
  const call={kind:'browser' as const,prompt:'Consulta la página.',url:'https://example.com/'};expect(()=>authorizeToolkit('zen_cloud',call,'Mira visualmente https://otro.com')).toThrow('literalmente');
  const f=fixture([{output:[{type:'computer_call',id:'c',call_id:'call',status:'completed',pending_safety_checks:[{id:'warning'}],action:{type:'click',x:1,y:1,button:'left'}}]}],{browser:()=>browser});
  await expect(f.toolkit.cloud(call,'Mira visualmente https://example.com/',signal())).rejects.toThrow('decisión humana');expect(browser.act).not.toHaveBeenCalled();expect(browser.close).toHaveBeenCalled();
 });
});
describe('Apply Patch',()=>{
 it('valida rutas, contexto único, creación sin sobrescritura y rollback por exceso',()=>{
  const patch=new PatchWorkspace();expect(()=>patch.apply({type:'create_file',path:'../escape.py',diff:'+unsafe'})).toThrow('Ruta');
  patch.apply({type:'create_file',path:'demo.py',diff:'+print(1)\n'});expect(()=>patch.apply({type:'create_file',path:'demo.py',diff:'+print(2)'})).toThrow('sobrescribe');
  patch.apply({type:'update_file',path:'demo.py',diff:'@@\n-print(1)\n+print(2)\n'});expect(patch.snapshot()).toEqual({'demo.py':'print(2)\n'});
  expect(()=>patch.apply({type:'update_file',path:'demo.py',diff:'@@\n-no existe\n+invento'})).toThrow('ausente');
  expect(patch.snapshot()).toEqual({'demo.py':'print(2)\n'});
 });
});
