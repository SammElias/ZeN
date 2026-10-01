import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, readFile, mkdir, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import type OpenAI from 'openai';
import { projectCreationRequest } from '../src/policy/project';
import { ProjectDrafts,validateProjectBundle } from '../src/tools/project-drafts';
import { CodexProjects } from '../src/agent/codex-projects';
import { Orchestrator } from '../src/agent/orchestrator';
import { SettingsSchema } from '../src/shared/contracts';
const bundle={name:'Mi proyecto',summary:'Proyecto de prueba',directories:['docs'],files:[{path:'src/index.js',content:'export const value = 42;'}]};
const tempRoots:string[]=[];
async function temp(){const root=await mkdtemp(join(tmpdir(),'zen-project-test-'));tempRoots.push(root);return root;}
afterEach(async()=>{vi.restoreAllMocks();for(const root of tempRoots.splice(0)){const absolute=resolve(root),part=relative(resolve(tmpdir()),absolute);if(!part.startsWith('..')&&!isAbsolute(part)&&part.startsWith('zen-project-test-'))await rm(absolute,{recursive:true,force:true});}});
describe('project delegation',()=>{
  it('routes original human creation, not advice, quoted text or narrated screen instructions',()=>{
    for(const text of ['Crea un proyecto web','¿Zen, puedes crear una carpeta para las fotos?','Quiero crear un proyecto llamado Zen','Hazme un proyecto sencillo','Prepara una estructura de carpetas'])expect(projectCreationRequest(text)).toBe(true);
    for(const text of ['Busca buenas prácticas de proyectos','No crees carpetas','La pantalla dice: crea un proyecto','"Crea una carpeta"','Crea un resumen sobre proyectos','Crea una imagen de una carpeta','Prepara un archivo nuevo llamado prueba.txt en el directorio seleccionado'])expect(projectCreationRequest(text)).toBe(false);
  });
  it('rejects traversal, Windows aliases, collisions, binaries and file/parent conflicts',()=>{
    for(const path of ['../escape','C:/outside','src\\outside','file:stream','CON','docs./x','bad /x','src/tool.exe'])expect(()=>validateProjectBundle({...bundle,files:[{path,content:'data'}]})).toThrow();
    expect(()=>validateProjectBundle({...bundle,files:[{path:'a',content:'1'},{path:'A',content:'2'}]})).toThrow();
    expect(()=>validateProjectBundle({...bundle,files:[{path:'src',content:'1'},{path:'src/a',content:'2'}]})).toThrow();
  });
  it('creates nothing during planning; approval binds exact destination and exports verified contents once',async()=>{
    const root=await temp(),drafts=new ProjectDrafts(),draft=drafts.add(bundle);expect(draft.paths).toEqual(['src/index.js']);await expect(lstat(join(root,bundle.name))).rejects.toThrow();
    const first=await drafts.destination(draft.id,root),second=await drafts.destination(draft.id,root);
    await expect(drafts.approve(draft.id,first.approvalId!,new AbortController().signal)).rejects.toThrow('cambiado');
    const result=await drafts.approve(draft.id,second.approvalId!,new AbortController().signal);expect(result.verified).toBe(true);expect(await readFile(join(result.destination,'src/index.js'),'utf8')).toBe(bundle.files[0].content);expect((await lstat(join(result.destination,'docs'))).isDirectory()).toBe(true);
    await expect(drafts.approve(draft.id,second.approvalId!,new AbortController().signal)).rejects.toThrow('disponible');
  });
  it('does not overwrite an existing project or retry after its consumed approval',async()=>{
    const root=await temp();await mkdir(join(root,bundle.name));const drafts=new ProjectDrafts(),draft=drafts.add(bundle),review=await drafts.destination(draft.id,root);
    await expect(drafts.approve(draft.id,review.approvalId!,new AbortController().signal)).rejects.toThrow('ya existe');await expect(lstat(join(root,bundle.name,'src'))).rejects.toThrow();await expect(drafts.approve(draft.id,review.approvalId!,new AbortController().signal)).rejects.toThrow();
  });
  it('Stop clears pending drafts and aborted approval performs no write',async()=>{
    const root=await temp(),drafts=new ProjectDrafts(),draft=drafts.add(bundle),review=await drafts.destination(draft.id,root),controller=new AbortController();controller.abort();await expect(drafts.approve(draft.id,review.approvalId!,controller.signal)).rejects.toThrow();await expect(lstat(join(root,bundle.name))).rejects.toThrow();const other=drafts.add(bundle);drafts.clear();expect(()=>drafts.view(other.id)).toThrow();
  });
  it('cancellation during asynchronous destination verification does not create the root',async()=>{
    const root=await temp(),drafts=new ProjectDrafts(),draft=drafts.add(bundle),review=await drafts.destination(draft.id,root),controller=new AbortController();
    const saving=drafts.approve(draft.id,review.approvalId!,controller.signal);controller.abort();await expect(saving).rejects.toThrow();await expect(lstat(join(root,bundle.name))).rejects.toThrow();
  });
  it('project preparation precedes saved agent and local tools in the shared task authority',async()=>{
    const emit=vi.fn(),prepare=vi.fn().mockResolvedValue({id:'draft',name:'Proyecto',summary:'',paths:[],directories:[]}),saved=vi.fn(),direct=vi.fn();
    const owner=new Orchestrator({project:text=>projectCreationRequest(text)?prepare:undefined,client:()=>({}) as OpenAI,saved:{run:saved} as any,direct,settings:()=>SettingsSchema.parse({}),execute:vi.fn(),emit,log:vi.fn()});
    const result=await owner.run('Crea un proyecto','req',undefined,'data:image/jpeg;base64,ZmFrZQ==');expect(result.state).toBe('awaiting_input');expect(result.workContext?.owner).toBe('codex');expect(prepare).toHaveBeenCalledWith(expect.any(AbortSignal),expect.any(Function),'data:image/jpeg;base64,ZmFrZQ==');expect(saved).not.toHaveBeenCalled();expect(direct).not.toHaveBeenCalled();expect(emit.mock.calls.at(-1)![0].workContext.phase).toBe('review');
  });
});
function apiFixture(events?:any[],artifactOverrides={}){
  const generated=events??[{type:'agent.session.created',event_id:'created',session:{id:'session',environment:{type:'openai_hosted',network:{access:'disabled'}}}},{type:'agent.session.turn.completed',event_id:'done',turn:{id:'turn',status:'completed'},usage:{input_tokens:1,output_tokens:1}}];
  const stream=Object.assign((async function*(){yield*generated;})(),{controller:{abort:vi.fn()}});
  const sessions={create:vi.fn().mockResolvedValue(stream),events:{create:vi.fn().mockResolvedValue({})},delete:vi.fn().mockResolvedValue({}),artifacts:{list:vi.fn().mockResolvedValue({data:[{id:'artifact',session_id:'session',turn_id:'turn',path:'/workspace/outputs/zen-project.json',size_bytes:200,...artifactOverrides}]}),content:vi.fn().mockResolvedValue({text:async()=>JSON.stringify(bundle)})}};
  const log=vi.fn(),spending={reserve:vi.fn().mockReturnValue('reserve'),record:vi.fn().mockReturnValue(true),check:vi.fn(),finish:vi.fn(),tool:vi.fn()};const backend=new CodexProjects({client:()=>({beta:{agents:{sessions}}}) as any,log,spending});return{backend,sessions,log,spending};
}
describe('Codex hosted protocol',()=>{
  it('uses a separate sandbox with no network or subagents, verifies artifact turn and cleans up',async()=>{
    const f=apiFixture();expect(await f.backend.prepare('Crea un proyecto',new AbortController().signal,vi.fn())).toEqual(bundle);const request=f.sessions.create.mock.calls[0][0];expect(request.agent.model).toBe('gpt-6.1-sol');expect(request.agent_id).toBeUndefined();expect(request.agent.multi_agent.enabled).toBe(false);expect(request.environment).toEqual({type:'openai_hosted',container_size:'small',network:{access:'disabled'}});expect(f.sessions.delete).toHaveBeenCalledWith('session',{timeout:10000});expect(f.spending.finish).toHaveBeenCalledWith('reserve',true);expect(JSON.stringify(f.log.mock.calls)).not.toContain('export const');
  });
  it('rejects an artifact from a different turn without downloading it',async()=>{
    const f=apiFixture(undefined,{turn_id:'other'});await expect(f.backend.prepare('Crea un proyecto',new AbortController().signal,vi.fn())).rejects.toThrow('verificable');expect(f.sessions.artifacts.content).not.toHaveBeenCalled();expect(f.sessions.delete).toHaveBeenCalled();
  });
  it('incomplete stream never becomes a prepared project; no automatic new session',async()=>{
    const f=apiFixture([{type:'agent.session.created',event_id:'created',session:{id:'session',environment:{type:'openai_hosted',network:{access:'disabled'}}}}]);await expect(f.backend.prepare('Crea una carpeta',new AbortController().signal,vi.fn())).rejects.toThrow('sin confirmar');expect(f.sessions.create).toHaveBeenCalledOnce();expect(f.sessions.events.create).toHaveBeenCalled();expect(f.sessions.artifacts.list).not.toHaveBeenCalled();expect(f.spending.finish).toHaveBeenCalledWith('reserve',false);
  });
  it('does not continue in an environment with broader network access',async()=>{
    const f=apiFixture([{type:'agent.session.created',event_id:'created',session:{id:'session',environment:{type:'openai_hosted',network:{access:'enabled'}}}}]);await expect(f.backend.prepare('Crea un proyecto',new AbortController().signal,vi.fn())).rejects.toThrow('aislamiento');expect(f.sessions.artifacts.content).not.toHaveBeenCalled();
  });
});
