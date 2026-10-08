import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm,writeFile,readFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ShortcutSet} from '../src/main/shortcuts';
import {ProjectContextsSchema,initialProjectContexts,projectContextText} from '../src/shared/project-context';
import {PersonalStore} from '../src/storage/personal';
import {Approvals} from '../src/policy/approvals';
import {taskStatus} from '../src/shared/workspace';
const folders:string[]=[];
async function temp(){const path=await mkdtemp(join(tmpdir(),'zen-daily-'));folders.push(path);return path;}
afterEach(async()=>{vi.useRealTimers();for(const path of folders.splice(0))await rm(path,{recursive:true,force:true});});
describe('Daily workspace',()=>{
 it('keeps previous shortcuts if any new shortcut is occupied or invalid',()=>{
   const keys=new Map<string,()=>void>(),invoke=vi.fn(),region=vi.fn();
   const manager=new ShortcutSet({register:(key,cb)=>{if(key==='bad')throw Error();if(key==='taken'||keys.has(key))return false;keys.set(key,cb);return true;},unregister:key=>{keys.delete(key);}},{invoke,region});
   expect(manager.apply({invoke:'Control+Alt+Z',region:'Control+Alt+R'})).toBe(true);
   expect(manager.apply({invoke:'Control+Shift+Z',region:'taken'})).toBe(false);
   expect([...keys.keys()]).toEqual(['Control+Alt+Z','Control+Alt+R']);
   expect(manager.apply({invoke:'Control+Shift+Z',region:'bad'})).toBe(false);
   expect(manager.apply({invoke:'Ctrl+Alt+Z',region:'Alt+Control+Z'})).toBe(false);
   keys.get('Control+Alt+R')!();expect(region).toHaveBeenCalledOnce();expect(invoke).not.toHaveBeenCalled();
 });
 it('migrates an empty local store and preserves selected project and editable references',async()=>{
   const directory=await temp(),store=new PersonalStore(directory),state=store.projectContexts();
   expect(state).toEqual(initialProjectContexts);state.activeId=state.projects[1].id;
   state.projects[1].preferences='Respuesta breve';state.projects[1].documents=[{id:randomUUID(),name:'revisión.md',content:'Dato explícito',enabled:false,importedAt:new Date().toISOString()}];store.saveProjectContexts(state);
   expect(new PersonalStore(directory).projectContexts()).toEqual(state);
   expect(projectContextText(state.projects[1],'Dato',4000)).not.toContain('Dato explícito');
   state.projects[1].documents[0].enabled=true;expect(projectContextText(state.projects[1],'Dato',4000)).toContain('Dato explícito');
   expect(projectContextText(state.projects[0],'Dato',4000)).not.toContain('Dato explícito');
 });
 it('rejects foreign active projects and duplicate references, and bounds context',()=>{
   const state=structuredClone(initialProjectContexts);expect(()=>ProjectContextsSchema.parse({...state,activeId:randomUUID()})).toThrow();
   const reference={id:randomUUID(),name:'doc',content:'Contexto '.repeat(1400),enabled:true,importedAt:new Date().toISOString()};state.projects[0].documents=[reference,reference];expect(()=>ProjectContextsSchema.parse(state)).toThrow();
   state.projects[0].documents=[reference];expect(projectContextText(state.projects[0],'Contexto',1000).length).toBeLessThanOrEqual(1000);
 });
 it('preserves task identity and scope when completion contains only result fields',async()=>{
   const store=new PersonalStore(await temp());store.task({id:'task',projectContextId:initialProjectContexts.projects[0].id,request:'Crear archivo',state:'executing',message:'Creando'});store.task({id:'task',state:'completed',message:'Creado',undoAvailable:true});
   expect(store.tasks()[0]).toMatchObject({request:'Crear archivo',projectContextId:initialProjectContexts.projects[0].id,undoAvailable:true});store.recover();expect(store.tasks()[0].undoAvailable).toBe(false);
 });
 it('reports external handoff as waiting for send, never completed or running',()=>{
   expect(taskStatus({id:'a',state:'awaiting_input',message:'',workContext:{owner:'codex',phase:'external'}})).toBe('Esperando envío en Codex');
   expect(taskStatus({id:'a',state:'awaiting_approval',message:''})).toBe('Necesita permiso');
   expect(taskStatus({id:'a',state:'queued',message:''})).toBe('En cola');
   expect(taskStatus({id:'a',state:'completed',message:''})).toBe('Terminada');
 });
 it('undoes only its own unchanged new file once, through the supplied recycle operation',async()=>{
   const directory=await temp(),manager=new Approvals(),grant=await manager.grant(directory),signal=new AbortController().signal;
   const proposal=manager.prepare({grantId:grant.grantId,kind:'create-file',name:'nuevo.txt',content:'Contenido revisado'});expect((await manager.approve(proposal.id,signal)).undoAvailable).toBe(true);
   const recycle=vi.fn(async(path:string)=>{expect(path).toBe(join(directory,'nuevo.txt'));await unlink(path);});
   expect(manager.undoPreview(proposal.id).destination).toBe(join(directory,'nuevo.txt'));await manager.undo(proposal.id,signal,recycle);await expect(manager.undo(proposal.id,signal,recycle)).rejects.toThrow();expect(recycle).toHaveBeenCalledOnce();
 });
 it('preserves externally edited files and refuses undo after cancellation or expiry',async()=>{
   const directory=await temp(),manager=new Approvals(),grant=await manager.grant(directory),controller=new AbortController();
   const proposal=manager.prepare({grantId:grant.grantId,kind:'create-file',name:'editado.txt',content:'Original'});await manager.approve(proposal.id,controller.signal);await writeFile(proposal.destination,'Cambio humano');const recycle=vi.fn();
   await expect(manager.undo(proposal.id,controller.signal,recycle)).rejects.toThrow('camb');expect(await readFile(proposal.destination,'utf8')).toBe('Cambio humano');expect(recycle).not.toHaveBeenCalled();
   const other=manager.prepare({grantId:grant.grantId,kind:'create-file',name:'otro.txt',content:'Sin cambios'});await manager.approve(other.id,controller.signal);controller.abort();await expect(manager.undo(other.id,controller.signal,recycle)).rejects.toThrow();expect(recycle).not.toHaveBeenCalled();
   vi.useFakeTimers();vi.setSystemTime(Date.now()+1800001);expect(()=>manager.undoPreview(other.id)).toThrow('ya no');
 });
});
