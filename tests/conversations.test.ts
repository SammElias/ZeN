import {describe,it,expect,afterEach,vi} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ConversationStore} from '../src/storage/conversations';
import {ConversationProvider} from '../src/agent/conversation-provider';
import {DropContext} from '../src/main/drop-context';
import {SettingsSchema} from '../src/shared/contracts';
import {TaskManager} from '../src/agent/tasks';
import {Artifacts} from '../src/tools/artifacts';
import {PersonalStore} from '../src/storage/personal';
import {HumanConfirmations} from '../src/policy/human-confirmations';
import {installConversations} from '../src/main/conversations';
import {diagnose,errorMetadata} from '../src/shared/errors';
import {contextTokens,type ConversationCommand,type ConversationReply} from '../src/shared/conversations';
const dirs:string[]=[],stores:ConversationStore[]=[];
function setup(){const dir=mkdtempSync(join(tmpdir(),'zen-chat-test-'));dirs.push(dir);const store=new ConversationStore(dir);stores.push(store);return{dir,store};}
afterEach(()=>{for(const s of stores.splice(0))try{s.close();}catch{}for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const response=(text='Respuesta',extra:any[]=[])=>({id:'resp_'+randomUUID(),model:'gpt-6.1-sol',status:'completed',output:[...extra,{id:'msg_'+randomUUID(),type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({result:text,clarifications_requested:[]}),annotations:[]}]}]});
function api(replies:any[]){const inputs:any[]=[];return{inputs,responses:{create:vi.fn(async(params:any)=>{inputs.push(structuredClone(params));const next=replies.shift();if(next instanceof Error)throw next;return(async function*(){yield{type:'response.created',response:next};yield{type:'response.output_text.delta',delta:JSON.stringify({result:'Parcial',clarifications_requested:[]})};yield{type:next.status==='incomplete'?'response.incomplete':'response.completed',response:next};})();}),inputTokens:{count:vi.fn(async({input}:any)=>({input_tokens:contextTokens(input)}))},compact:vi.fn(),retrieve:vi.fn(),delete:vi.fn()}};}
function provider(store:ConversationStore,client:any,overrides={}){return new ConversationProvider({store,client:()=>client,settings:()=>SettingsSchema.parse(overrides)});}
const signal=()=>new AbortController().signal;
describe('durable conversations',()=>{
 it('preserves failed response IDs and safe stream codes without executing tools or resending',async()=>{
  const {store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Prueba local');
  const failed={...response('Parcial',[{type:'function_call',call_id:'blocked',name:'zen_desktop',arguments:'{}'}]),status:'failed',error:{code:'server_error',message:'private upstream body'}};
  const client=api([failed]),p=provider(store,client),desktop=vi.fn();
  let failure:unknown;try{await p.run(chat.id,run,'Prueba local',signal(),()=>{},undefined,undefined,desktop);}catch(e){failure=e;}
  expect(diagnose(failure)).toContain('temporalmente');expect(errorMetadata(failure).code).toBe('server_error');
  expect(store.run(run)?.response).toBe(failed.id);expect(p.uncertain(run)).toBe(true);
  expect(client.responses.create).toHaveBeenCalledTimes(1);expect(desktop).not.toHaveBeenCalled();
  expect(JSON.stringify(errorMetadata(failure))).not.toContain('private upstream body');
 });
 it('handles an explicit error event before a response exists without pretending completion',async()=>{
  const {store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Prueba local');
  const client=api([]);client.responses.create.mockImplementation(async()=> (async function*(){yield {type:'error',code:'rate_limit_exceeded',message:'private body'};})() as any);
  const p=provider(store,client);let failure:unknown;try{await p.run(chat.id,run,'Prueba local',signal(),()=>{});}catch(e){failure=e;}
  expect(diagnose(failure)).toContain('Límite de solicitudes');expect(p.uncertain(run)).toBe(false);expect(client.responses.create).toHaveBeenCalledTimes(1);
 });
 function deletionHarness(){const {store}=setup(),confirmations=new HumanConfirmations(()=>{}),cleanup=vi.fn(async()=>0),removed=vi.fn();let command!:(c:ConversationCommand)=>Promise<ConversationReply>;installConversations({store,confirmations,provider:{cleanup} as unknown as ConversationProvider,handle:(_n,_s,fn)=>{command=async c=>await fn(c) as ConversationReply;},project:()=>null,validProject:()=>true,drop:()=>new DropContext(x=>x),select:async()=>{},cancel:()=>{},changed:()=>{},removed});return{store,confirmations,command,cleanup,removed};}
 it('cancelling a delete proposal revokes that code without deleting the chat',async()=>{
  const {store,command,confirmations}=deletionHarness(),chat=store.create(null,'Conservar');const preview=await command({action:'delete-preview',id:chat.id});
  expect(preview.deletion?.title).toBe('Conservar');const code=preview.code!;
  await command({action:'delete-cancel',id:chat.id,code:code==='1111'?'2222':'1111'});expect(confirmations.list()).toHaveLength(1);
  await command({action:'delete-cancel',id:chat.id,code});expect(confirmations.list()).toHaveLength(0);
  await expect(command({action:'delete-confirm',id:chat.id,code})).rejects.toThrow();expect(store.chat(chat.id).title).toBe('Conservar');
 });
 it('deletion is bound to the reviewed chat and version, and cannot be reused',async()=>{
  const {store,command,removed,cleanup}=deletionHarness(),a=store.create(null,'A'),b=store.create(null,'B');
  const first=await command({action:'delete-preview',id:a.id}),second=await command({action:'delete-preview',id:b.id});
  await expect(command({action:'delete-confirm',id:a.id,code:first.code!})).rejects.toThrow();
  store.update(b.id,{title:'B revisado'});await expect(command({action:'delete-confirm',id:b.id,code:second.code!})).rejects.toThrow('cambió');
  const latest=await command({action:'delete-preview',id:b.id});await command({action:'delete-confirm',id:b.id,code:latest.code!});
  expect(()=>store.chat(b.id)).toThrow();expect(store.chat(a.id).title).toBe('A');expect(removed).toHaveBeenCalledWith(b.id,[]);expect(cleanup).toHaveBeenCalledTimes(1);
  await expect(command({action:'delete-confirm',id:b.id,code:latest.code!})).rejects.toThrow();
 });

 it('lists every chat by recency across pages without promoting pinned chats or losing archives',()=>{
  const {store}=setup(),created:string[]=[];let time=1000;const clock=vi.spyOn(Date,'now').mockImplementation(()=>time);
  try{
   for(let i=0;i<85;i++){time+=1000;created.push(store.create(null,'Chat '+i).id);}
   store.update(created[0],{pinned:true});store.update(created[40],{archived:true});
   store.create(randomUUID(),'Otro proyecto');
   const pages=[store.list(null,'all','',0),store.list(null,'all','',40),store.list(null,'all','',80)];
   expect(pages.map(page=>page.length)).toEqual([40,40,5]);
   expect(pages.flat().map(row=>row.id)).toEqual([...created].reverse());
   expect(store.list(null,'all','',120)).toEqual([]);
   expect(store.list(null,'recent').every(row=>!row.archived)).toBe(true);
  }finally{clock.mockRestore();}
 });

 it('keeps voice fragments verbatim without inferring a completed turn or tool authority',()=>{const{store}=setup(),chat=store.create(null);store.caption(chat.id,'session:one',{id:'one',speaker:'user',phase:'start',text:'Abre'});store.caption(chat.id,'session:one',{id:'one',speaker:'user',phase:'delta',text:'Abre el documento'});expect(store.messages(chat.id)).toHaveLength(1);expect(store.messages(chat.id)[0]).toMatchObject({text:'Abre el documento',partial:true,state:'incomplete'});expect(store.context(chat.id).messages).toEqual([]);store.caption(chat.id,'other-session:one',{id:'one',speaker:'user',phase:'start',text:'Otro fragmento'});expect(store.messages(chat.id)).toHaveLength(2);});
 it('preserves generated results across restart and deletes only the owning copy',()=>{const{store}=setup(),a=store.create(null),b=store.create(null),id=randomUUID(),item={meta:{id,title:'Resultado.txt',kind:'text' as const},data:Buffer.from('Durable output'),mime:'text/plain'};store.putArtifact(a.id,item);store.putArtifact(b.id,item);const artifacts=new Artifacts(key=>store.artifact(key));expect(artifacts.get(id).data.toString()).toBe('Durable output');store.delete(a.id);expect(artifacts.get(id).data.toString()).toBe('Durable output');store.delete(b.id);expect(()=>artifacts.get(id)).toThrow();});
 it('sends only attachment metadata when a historical image is not selected',()=>{const{store}=setup(),chat=store.create(null),id=randomUUID();store.putAttachment(chat.id,{item:{id,kind:'image',name:'Image',detail:'Local',preview:'data:image/png;base64,AAAA'},image:'data:image/png;base64,AAAA',at:Date.now()});expect(store.attachmentReferences(chat.id,[])[0].item.preview).toBeUndefined();expect(store.attachmentReferences(chat.id,[id])[0].item.preview).toContain('AAAA');expect(store.attachmentReferences(chat.id,[id])[0].image).toBeUndefined();});
 it('recovers active chat, drafts and original roles on restart; marks uncertain work without replay',()=>{let{dir,store}=setup();const a=store.create(null),b=store.create(null),id=randomUUID();store.setActive(a.id);store.saveDraft(a.id,{text:'Borrador',attachmentIds:[],scrollTop:120});store.begin(a.id,id,'Dato exclusivo A');store.accept({id:'taskA',requestId:id,state:'thinking',message:'',streamText:'Parcial A'});store.close();store=new ConversationStore(dir);stores.push(store);store.recover();expect(store.active(null).id).toBe(a.id);expect(store.draft(a.id).text).toBe('Borrador');expect(store.messages(a.id).map(m=>[m.role,m.text])).toEqual([['user','Dato exclusivo A'],['assistant','Parcial A']]);expect(store.messages(a.id)[1].state).toBe('interrupted');expect(store.context(b.id).messages).toEqual([]);expect(store.begin(a.id,id,'Repeated')).toBe(false);expect(()=>store.begin(b.id,id,'Other')).toThrow();});
 it('retains streamed text across progress, failure and keeps output on originating chat',()=>{const{store}=setup(),a=store.create(null),b=store.create(null),id=randomUUID();store.begin(a.id,id,'Solicitud');store.accept({id:'t',requestId:id,state:'thinking',message:'',streamText:'Texto parcial'});store.setActive(b.id);store.accept({id:'t',state:'executing',message:'Herramienta'});store.accept({id:'t',state:'failed',message:'Conexión interrumpida'});expect(store.messages(a.id)[1].text).toContain('Texto parcial');expect(store.messages(b.id)).toEqual([]);});
 it('replaces the streamed answer when a completed response asks a question',async()=>{
  const{store}=setup(),chat=store.create(null),id=randomUUID();store.begin(chat.id,id,'Pregunta');
  const result={message:'Respuesta completa.\n\n¿Qué prefieres?',needsInput:true,artifacts:[]};
  const manager=new TaskManager({client:()=>({responses:{}}) as any,settings:()=>SettingsSchema.parse({}),execute:async()=>({}) as any,emit:e=>{store.accept(e);},log:()=>{},conversations:{run:async(_chat:string,_id:string,_text:string,_signal:AbortSignal,progress:any)=>{progress('Respondiendo','Respuesta completa.');return result;}} as any},()=>1);
  const returned=await manager.run('Pregunta',id,undefined,undefined,undefined,2,undefined,undefined,false,chat.id);
  expect(returned).toMatchObject({state:'awaiting_input',responseComplete:true});
  expect(store.messages(chat.id)[1]).toMatchObject({text:result.message,state:'completed',partial:false});
  store.finish(id,returned);expect(store.messages(chat.id)[1].text).toBe(result.message);expect(store.pending(chat.id)).toEqual([]);
 });
 it('preserves partial output on repeated uncertain terminal events',()=>{
  const{store}=setup(),chat=store.create(null),id=randomUUID();store.begin(chat.id,id,'Pregunta');
  store.accept({id,requestId:id,state:'thinking',message:'',streamText:'Parte recibida'});
  const event={id,requestId:id,state:'awaiting_input' as const,message:'Conexión interrumpida'};
  store.accept(event);store.accept(event);
  expect(store.messages(chat.id)[1]).toMatchObject({text:'Parte recibida\n\nConexión interrumpida',partial:true,state:'incomplete'});
 });
 it('persists message images after failure and restart without including pixels in history updates or model context',()=>{
  let{store,dir}=setup();const chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Mira esto');
  const image={name:'Captura.png',width:320,height:180,thumbnail:'data:image/jpeg;base64,dGh1bWI=',data:'data:image/png;base64,cGl4ZWxz'};
  store.putMessageImage(chat.id,run,image);store.putMessageImage(chat.id,run,image);
  store.finish(run,{id:run,state:'failed',message:'Sin conexión'});store.close();store=new ConversationStore(dir);stores.push(store);
  const message=store.messages(chat.id)[0];expect(message.images).toHaveLength(1);
  expect(JSON.stringify(store.messages(chat.id))).not.toContain('data:image');
  expect(store.messageImage(chat.id,message.id,message.images![0].id,'full').data).toBe(image.data);
  expect(store.context(chat.id).messages[0].text).toBe('Mira esto');
 });
 it('scopes image retrieval by chat and message, and deletes the saved pixels with the conversation',async()=>{
  const{store,command}=deletionHarness(),a=store.create(null),b=store.create(null),run=randomUUID();store.begin(a.id,run,'imagen');store.begin(b.id,randomUUID(),'otro');
  store.putMessageImage(a.id,run,{name:'Imagen',width:1,height:1,thumbnail:'data:image/png;base64,QQ==',data:'data:image/png;base64,Qg=='});
  const m=store.messages(a.id)[0],image=m.images![0],query={action:'message-image' as const,id:a.id,messageId:m.id,imageId:image.id,size:'thumbnail' as const};
  expect((await command(query)).image?.data).toBe('data:image/png;base64,QQ==');
  await expect(command({...query,id:b.id})).rejects.toThrow('no disponible');
  await expect(command({...query,messageId:store.messages(a.id)[1].id})).rejects.toThrow('no disponible');
  expect(()=>store.putMessageImage(b.id,run,{name:'Invalid',width:1,height:1,thumbnail:'data:image/png;base64,QQ==',data:'data:image/png;base64,Qg=='})).toThrow('ajena');
  store.delete(a.id);expect(store.db.prepare('SELECT count(*) n FROM message_images').get()?.n).toBe(0);
 });
 it('recovers legacy image associations only when the whole ordered user transcript matches',()=>{
  const{store}=setup(),chat=store.create(null),one=randomUUID(),two=randomUUID();store.begin(chat.id,one,'Revisa');store.begin(chat.id,two,'Revisa');
  const input=[{role:'user',content:[{type:'input_text',text:'Revisa'},{type:'input_image',image_url:'data:image/png;base64,QQ=='}]},{role:'assistant',content:'Respuesta'},{role:'user',content:[{type:'input_text',text:'Revisa'},{type:'input_image',image_url:'data:image/png;base64,Qg=='}]}];
  store.saveContext(chat.id,store.runSeq(two),input);expect(store.recoverableImages(chat.id)).toEqual([{runId:one,data:'data:image/png;base64,QQ=='},{runId:two,data:'data:image/png;base64,Qg=='}]);
  store.saveContext(chat.id,store.runSeq(two),input.slice(2));expect(store.recoverableImages(chat.id)).toEqual([]);
  store.saveContext(chat.id,store.runSeq(two),[...input,{type:'compaction',encrypted_content:'opaque'}]);expect(store.recoverableImages(chat.id)).toEqual([]);
  store.saveContext(chat.id,store.runSeq(two),[{role:'user',content:'Otra'},...input.slice(1)]);expect(store.recoverableImages(chat.id)).toEqual([]);
 });
 it('migration is repeatable, flags partial previews and backs up old tasks',()=>{const{dir,store}=setup();const task={id:randomUUID(),state:'completed' as const,request:'Anterior',message:'Fragmento'};store.migrate([task]);store.migrate([task]);expect(store.list(null)).toHaveLength(1);expect(store.list(null)[0].partial).toBe(true);expect(store.taskIds(store.list(null)[0].id)).toEqual([task.id]);const personal=new PersonalStore(dir);personal.task(task);const other={...task,id:randomUUID(),message:'Otra tarea'};personal.task(other);personal.removeChat(store.list(null)[0].id,store.taskIds(store.list(null)[0].id));expect(personal.tasks().map(t=>t.id)).toEqual([other.id]);expect(store.messages(store.list(null)[0].id).every(m=>m.partial)).toBe(true);});
 it('searches exact scoped originals, archive/recover, pin and page without inference',()=>{const{store}=setup();const a=store.create(null),b=store.create(randomUUID());store.begin(a.id,randomUUID(),'ID exacto 100%_AX');store.begin(b.id,randomUUID(),'Secreto B');expect(store.search(a.id,'100%_')).toHaveLength(1);expect(store.search(a.id,'Secreto B')).toEqual([]);expect(store.list(null,'recent','100%_')).toHaveLength(1);store.update(a.id,{archived:true,pinned:true,title:'Archivo'});expect(store.list(null)).toEqual([]);expect(store.list(null,'archived')[0].id).toBe(a.id);expect(()=>store.begin(a.id,randomUUID(),'mensaje')).toThrow();store.update(a.id,{archived:false});expect(store.list(null,'pinned')[0].title).toBe('Archivo');});
 it('transfers only edited snapshot and selected references, stale versions blocked and detach prevents future transfer',()=>{const{store}=setup(),a=store.create(null),b=store.create(null);store.begin(a.id,randomUUID(),'Todo el secreto A');const drop=new DropContext(v=>v);const item=drop.text('Archivo seleccionado');store.putAttachment(a.id,drop.snapshot([item.id])[0]);store.transfer(a.id,b.id,null,store.chat(a.id).version,'Solo esta frase',[item.id]);expect(store.context(b.id).messages).toEqual([]);expect(store.transfers(b.id)[0].text).toBe('Solo esta frase');expect(store.attachments(b.id)).toHaveLength(1);expect(store.attachments(b.id)[0].item.id).not.toBe(item.id);expect(()=>store.transfer(a.id,b.id,null,0,'obsolete',[])).toThrow();store.detach(b.id,store.transfers(b.id)[0].id);expect(store.transfers(b.id)[0].active).toBe(false);});
 it('deletion leaves originals and shared copies, queues remote cleanup and blocks late resurrection',()=>{const{store}=setup(),a=store.create(null),b=store.create(null),run=randomUUID();store.begin(a.id,run,'A');store.response('resp_one',a.id,run);store.transfer(a.id,b.id,null,store.chat(a.id).version,'selected',[]);store.delete(a.id);store.response('resp_late',a.id,run);expect(store.cleanup().map(r=>r.response)).toEqual(['resp_one','resp_late']);expect(()=>store.require(a.id)).toThrow();expect(()=>store.saveContext(a.id,0,[])).toThrow();expect(store.transfers(b.id)[0].text).toBe('selected');store.cleaned('resp_one','offline');expect(store.cleanup()[0].error).toBe('offline');});
 it('reports changed and missing durable file references without reading file contents',async()=>{const{dir}=setup(),path=join(dir,'sample.txt');writeFileSync(path,'abc');const d=new DropContext(v=>v),item=await d.grantFile(path,signal()),entry=d.snapshot([item.id])[0];expect((await d.availability(entry)).availability).toBe('available');writeFileSync(path,'changed content');expect((await d.availability(entry)).availability).toBe('changed');rmSync(path);expect((await d.availability(entry)).availability).toBe('missing');});
});
describe('Responses continuity',()=>{
 it('reconciliation is explicit, deduplicates stored output and never executes tool-bearing results',async()=>{const{store}=setup(),chat=store.create(null),run=randomUUID(),r=response('Recuperada');store.begin(chat.id,run,'pregunta');store.response(r.id,chat.id,run);store.saveContext(chat.id,store.runSeq(run),r.output);store.accept({id:run,requestId:run,state:'awaiting_input',message:'Desconexión'});const client=api([]);client.responses.retrieve.mockResolvedValue(r);const p=provider(store,client);expect(await p.reconcile(chat.id)).toBe(1);expect(store.context(chat.id).items).toHaveLength(1);expect(await p.reconcile(chat.id)).toBe(0);const next=randomUUID();store.begin(chat.id,next,'acción');store.response('r2',chat.id,next);store.recover();client.responses.retrieve.mockResolvedValue({...r,output:[{type:'function_call',call_id:'uncertain'}]});expect(await p.reconcile(chat.id)).toBe(0);expect(client.responses.create).not.toHaveBeenCalled();});
 it('keeps roles, routes streams to A, isolates B and excludes future queued turns',async()=>{const{store}=setup(),a=store.create(null),b=store.create(null),run=randomUUID();store.begin(a.id,run,'secreto A');store.begin(a.id,randomUUID(),'futuro A');const client=api([response('Primera'),response('B')]),p=provider(store,client);await p.run(a.id,run,'secreto A',signal(),(message,streamText)=>{store.accept({id:run,requestId:run,state:'thinking',message,streamText});store.setActive(b.id);});expect(JSON.stringify(client.inputs[0])).not.toContain('futuro A');expect(store.messages(a.id)[1].text).toBe('Parcial');const rb=randomUUID();store.begin(b.id,rb,'petición B');await p.run(b.id,rb,'petición B',signal(),()=>{});expect(JSON.stringify(client.inputs[1])).not.toContain('secreto A');expect(client.inputs[0].model).toBe('gpt-6.1-sol');expect(client.inputs[0].reasoning.effort).toBe('low');expect(client.inputs[0].conversation).toBeUndefined();expect(client.inputs[0].previous_response_id).toBeUndefined();});
 it('reuses the entire compacted window and preserves original visible messages',async()=>{const{store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Largo '.repeat(2500));const client=api([response()]),window=[{type:'compaction',id:'cmp_item',encrypted_content:'opaque'},{role:'user',content:'Exact current turn'}];client.responses.compact.mockResolvedValue({id:'cmp_1',output:window});await provider(store,client,{chatContextTokens:4000}).run(chat.id,run,'Largo',signal(),()=>{});expect(client.inputs[0].input).toEqual(window);expect(store.messages(chat.id)[0].text).toContain('Largo '.repeat(2500));expect(store.context(chat.id).items[0].encrypted_content).toBe('opaque');});
 it('checks actual input tokens before compacting three images in a short chat',async()=>{
  const{store}=setup(),chat=store.create(null),run=randomUUID();
  const images=Array.from({length:3},()=>({type:'input_image',detail:'auto',image_url:'data:image/png;base64,'+'A'.repeat(1000)}));
  store.saveContext(chat.id,0,[{role:'user',content:images}]);store.begin(chat.id,run,'Mira estas capturas');
  const client=api([response()]);client.responses.inputTokens.count.mockResolvedValue({input_tokens:3200});
  await provider(store,client).run(chat.id,run,'Mira estas capturas',signal(),()=>{});
  expect(client.responses.inputTokens.count).toHaveBeenCalledTimes(1);expect(client.responses.compact).not.toHaveBeenCalled();
  expect(client.inputs[0].input[0].content).toEqual(images);
 });
 it('keeps large encrypted compacted items intact using measured tokens',async()=>{
  const{store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Largo '.repeat(2500));
  const client=api([response()]),window=[{role:'user',content:'Petición conservada'},{type:'compaction',id:'cmp_large',encrypted_content:'opaque'.repeat(20000)}];
  client.responses.inputTokens.count.mockResolvedValueOnce({input_tokens:7000}).mockResolvedValueOnce({input_tokens:2200});
  client.responses.compact.mockResolvedValue({id:'cmp_1',output:window});
  await provider(store,client,{chatContextTokens:4000}).run(chat.id,run,'Largo',signal(),()=>{});
  expect(client.inputs[0].input).toEqual(window);expect(store.context(chat.id).compactionBlocked).toBe(false);
 });
 it('saves a compaction and its usage even when it remains too large; never compacts it again after restart',async()=>{
  let{store,dir}=setup();const chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Largo '.repeat(2500));
  const client=api([]),window=[{role:'user',content:'Largo '.repeat(2500)},{type:'compaction',id:'cmp',encrypted_content:'opaque'}];
  const usage={input_tokens:7000,output_tokens:100};client.responses.compact.mockResolvedValue({id:'cmp_1',output:window,usage});
  const spending={reserve:vi.fn(()=> 'reservation'),record:vi.fn(()=>true),finish:vi.fn(),check:vi.fn(),tool:vi.fn()};
  const p=new ConversationProvider({store,client:()=>client as any,settings:()=>SettingsSchema.parse({chatContextTokens:4000}),spending});
  await expect(p.run(chat.id,run,'Largo',signal(),()=>{})).rejects.toThrow('incluso después');
  expect(store.context(chat.id).items).toEqual(window);expect(spending.record).toHaveBeenCalledWith('reservation','cmp_1','gpt-6.1-sol',usage);expect(spending.finish).toHaveBeenCalledWith('reservation',true);
  store.close();store=new ConversationStore(dir);stores.push(store);const next=randomUUID();store.begin(chat.id,next,'Continúa');
  await expect(provider(store,client,{chatContextTokens:4000}).run(chat.id,next,'Continúa',signal(),()=>{})).rejects.toThrow('incluso después');
  expect(client.responses.compact).toHaveBeenCalledTimes(1);expect(client.responses.create).not.toHaveBeenCalled();
 });
 it('does not generate or compact if token counting fails',async()=>{
  const{store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'Largo '.repeat(2500));
  const client=api([]);client.responses.inputTokens.count.mockRejectedValue(new Error('offline'));
  await expect(provider(store,client,{chatContextTokens:4000}).run(chat.id,run,'Largo',signal(),()=>{})).rejects.toThrow('offline');
  expect(client.responses.compact).not.toHaveBeenCalled();expect(client.responses.create).not.toHaveBeenCalled();
 });
 it('does not overwrite previous context if compaction fails',async()=>{const{store}=setup(),chat=store.create(null),run=randomUUID();const prior=[{role:'user',content:'X'.repeat(10000)}];store.saveContext(chat.id,0,prior);store.begin(chat.id,run,'nuevo');const client=api([]);client.responses.compact.mockRejectedValue(Error('offline'));await expect(provider(store,client,{chatContextTokens:4000}).run(chat.id,run,'nuevo',signal(),()=>{})).rejects.toThrow();expect(store.context(chat.id).items).toEqual(prior);expect(client.responses.create).not.toHaveBeenCalled();});
 it('stores structured calls/results once and never repeats an interrupted effect',async()=>{const{store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'hazlo');const fn={type:'function_call',id:'fc',name:'zen_desktop',call_id:'call_1',arguments:'{}'};const first={...response(),output:[fn]},client=api([first,response('Hecho')]),desktop=vi.fn(async()=>({verified:true}));await provider(store,client).run(chat.id,run,'hazlo',signal(),()=>{},undefined,undefined,desktop);expect(desktop).toHaveBeenCalledTimes(1);expect(client.inputs[1].input.some((i:any)=>i.type==='function_call_output'&&i.call_id==='call_1')).toBe(true);expect(()=>store.startTool(run,'call_1')).toThrow();const next=randomUUID();store.saveContext(chat.id,store.runSeq(run),[fn]);store.begin(chat.id,next,'continúa');client.responses.create.mockImplementationOnce(async(params:any)=>{expect(params.input.some((i:any)=>i.type==='function_call_output'&&i.output.includes('Estado por comprobar'))).toBe(true);return(async function*(){yield{type:'response.completed',response:response()};})();});await provider(store,client).run(chat.id,next,'continúa',signal(),()=>{},undefined,undefined,desktop);expect(desktop).toHaveBeenCalledTimes(1);});
 it('retains remote IDs after incomplete output and retries cleanup explicitly',async()=>{const{store}=setup(),chat=store.create(null),run=randomUUID();store.begin(chat.id,run,'test');const r={...response('partial'),status:'incomplete'},client=api([r]),p=provider(store,client);await expect(p.run(chat.id,run,'test',signal(),()=>{})).rejects.toThrow('incompleta');expect(store.run(run)?.response).toBe(r.id);store.delete(chat.id);client.responses.delete.mockRejectedValueOnce(Error('offline'));expect(await p.cleanup()).toBe(1);client.responses.delete.mockResolvedValue({});expect(await p.cleanup()).toBe(0);});
 it('serializes turns of the same chat but permits independent chats',async()=>{let unblock!:()=>void;const waiting=new Promise<void>(r=>unblock=r),entered:string[]=[];const manager=new TaskManager({client:()=>({responses:{}}) as any,settings:()=>SettingsSchema.parse({maxConcurrentTasks:3}),execute:async()=>({}) as any,emit:()=>{},log:()=>{},conversations:{run:async(chat:string,id:string)=>{entered.push(chat);if(entered.length===1)await waiting;return{message:'ok',needsInput:false};}} as any},()=>3);const a=randomUUID(),b=randomUUID();const one=manager.run('hola',randomUUID(),undefined,undefined,undefined,2,undefined,undefined,false,a);const two=manager.run('siguiente',randomUUID(),undefined,undefined,undefined,2,undefined,undefined,false,a);const three=manager.run('otro',randomUUID(),undefined,undefined,undefined,2,undefined,undefined,false,b);await new Promise(r=>setTimeout(r,30));expect(entered).toEqual([a,b]);unblock();await Promise.all([one,two,three]);expect(entered).toEqual([a,b,a]);});
});
