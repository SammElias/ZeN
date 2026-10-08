import {ConversationCommandSchema,type ConversationCommand,type ConversationReply,type ChatSnapshot} from '../shared/conversations';
import type {ConversationStore} from '../storage/conversations';
import type {ConversationProvider} from '../agent/conversation-provider';
import type {HumanConfirmations} from '../policy/human-confirmations';
import {DropContext} from './drop-context';
import {ZenError} from '../shared/errors';

export function installConversations(d:{store:ConversationStore;provider:ConversationProvider;confirmations:HumanConfirmations;handle:(name:string,schema:any,fn:(v:any)=>unknown)=>void;project:()=>string|null;validProject:(id:string|null)=>boolean;drop:()=>DropContext;select:(id:string,drop:DropContext)=>Promise<void>;cancel:(task:string)=>void;changed:(id:string)=>void;removed:(id:string,taskIds:string[])=>void}){
 const contexts=new Map<string,DropContext>();
 const local=(id:string)=>{let ctx=contexts.get(id);if(!ctx){ctx=new DropContext(data=>data);contexts.set(id,ctx);}return ctx;};
 const snapshot=async(id:string):Promise<ChatSnapshot>=>{const messages=d.store.messages(id),ctx=local(id);return{chat:d.store.chat(id),messages,hasOlder:!!messages.length&&messages[0].seq>1,draft:d.store.draft(id),attachments:await Promise.all(d.store.attachmentReferences(id,d.store.draft(id).attachmentIds).map(row=>ctx.availability(row))),transfers:d.store.transfers(id),checkpoint:d.store.checkpointValue(id)};};
 const select=async(id:string)=>{
  if(d.store.chat(id).projectId!==d.project())throw new ZenError('Cambia al proyecto de esta conversación para abrirla.');
  const ctx=local(id),draft=d.store.draft(id);ctx.restore(d.store.attachments(id).filter(row=>draft.attachmentIds.includes(row.item.id)));
  await d.select(id,ctx);d.store.setActive(id);return snapshot(id);
 };
 const command=async(c:ConversationCommand):Promise<ConversationReply>=>{
  switch(c.action){
   case 'list':return{rows:d.store.list(c.projectId,c.filter,c.query,c.offset),pendingCleanup:d.store.cleanup().length};
   case 'active':return{snapshot:await select(d.store.active(c.projectId).id)};
   case 'create':if(c.projectId!==d.project())throw new ZenError('El proyecto cambió.');return{snapshot:await select(d.store.create(c.projectId).id)};
   case 'open':return{snapshot:await select(c.id)};
   case 'activity':{const messages=d.store.messages(c.id);return{updates:{chat:d.store.chat(c.id),messages,hasOlder:!!messages.length&&messages[0].seq>1,checkpoint:d.store.checkpointValue(c.id)}};}
   case 'read':return c.before?{messages:d.store.messages(c.id,c.before)}:{snapshot:await snapshot(c.id)};
   case 'message':return{messages:[d.store.messageById(c.id,c.messageId)]};
   case 'use-message':{
    if(d.store.active(d.project()).id!==c.id)throw new ZenError('Abre esta conversación primero.');
    const message=d.store.messageById(c.id,c.messageId),draft=d.store.draft(c.id);if(draft.attachmentIds.length>=8)throw new ZenError('Máximo ocho adjuntos.');
    const ctx=local(c.id),item=ctx.text(`Fragmento histórico, solo datos sin permisos. Mensaje ${message.id}, autor ${message.role}, estado ${message.state}:\n${message.text.slice(0,60000)}`);
    d.store.putAttachment(c.id,ctx.snapshot([item.id])[0]);d.store.saveDraft(c.id,{...draft,attachmentIds:[...draft.attachmentIds,item.id]});return{snapshot:await snapshot(c.id)};
   }
   case 'search':return{messages:d.store.search(c.id,c.query)};
   case 'update':d.store.update(c.id,c);d.changed(c.id);return{snapshot:await snapshot(c.id)};
   case 'draft':{
    // IDs come only from explicit local attachment grants, never from paths in a page/model.
    const saved=d.store.attachments(c.id),ctx=contexts.get(c.id)??d.drop();
    for(const id of c.draft.attachmentIds){try{d.store.putAttachment(c.id,ctx.snapshot([id])[0]);}catch{if(!saved.some(row=>row.item.id===id))throw new ZenError('Adjunto no disponible en esta conversación.');}}
    d.store.saveDraft(c.id,c.draft);return{};
   }
   case 'use-attachment':{
    if(d.store.active(d.project()).id!==c.id)throw new ZenError('Abre primero esta conversación.');
    const row=d.store.attachments(c.id).find(row=>row.item.id===c.attachmentId);if(!row)throw new ZenError('Adjunto no disponible.');
    const info=await local(c.id).availability(row);if(['missing','changed'].includes(info.availability))throw new ZenError(info.problem!);
    const draft=d.store.draft(c.id),ids=[...new Set([...draft.attachmentIds,c.attachmentId])];if(ids.length>8)throw new ZenError('Máximo ocho adjuntos.');
    local(c.id).restore([row]);d.store.saveDraft(c.id,{...draft,attachmentIds:ids});return{snapshot:await snapshot(c.id)};
   }
   case 'transfer':{
    if(!d.validProject(c.targetProject))throw new ZenError('Proyecto de destino no disponible.');
    if(c.targetId&&(d.store.activeRuns(c.targetId).length||d.store.chat(c.targetId).archived))throw new ZenError('El destino debe estar disponible y sin ejecuciones activas.');
    if(c.targetId===c.sourceId)throw new ZenError('Elige otra conversación.');
    const rows=d.store.attachments(c.sourceId).filter(row=>c.attachmentIds.includes(row.item.id));
    for(const row of rows)if(['missing','changed'].includes((await local(c.sourceId).availability(row)).availability))throw new ZenError('Un adjunto cambió o falta. Revisa la selección.');
    const id=d.store.transfer(c.sourceId,c.targetId,c.targetProject,c.sourceVersion,c.text,c.attachmentIds);d.changed(id);
    return{snapshot:await snapshot(id),notice:'Contexto copiado como referencia histórica. Los adjuntos elegidos quedan disponibles para adjuntar; no se envían automáticamente.'};
   }
   case 'detach':if(d.store.activeRuns(c.id).length)throw new ZenError('Espera o detén la ejecución antes de retirar contexto.');d.store.detach(c.id,c.transferId);return{snapshot:await snapshot(c.id),notice:'Referencia retirada de futuras peticiones; las respuestas ya escritas se conservan.'};
   case 'delete-preview':{
    const row=d.store.chat(c.id),version=row.version;
    d.confirmations.offer('chat-delete:'+c.id,`Eliminar «${row.title}»: historial y copias locales del chat, y respuestas remotas propias. Se detienen sus tareas. Los archivos originales y referencias de otros chats se conservan.`,String(version),async()=>{
     if(d.store.chat(c.id).version!==version)throw new ZenError('La conversación cambió. Revisa una nueva confirmación.');
     for(const run of d.store.activeRuns(c.id)){try{d.cancel(run.task??run.id);}catch{}}
     const taskIds=d.store.taskIds(c.id);d.store.delete(c.id);contexts.delete(c.id);d.removed(c.id,taskIds);d.changed(c.id);await d.provider.cleanup();return true;
    });
    return{code:d.confirmations.list().find(row=>row.key==='chat-delete:'+c.id)!.code};
   }
   case 'delete-confirm':{
    if(!d.confirmations.list().some(row=>row.key==='chat-delete:'+c.id&&row.code===c.code))throw new ZenError('Confirmación distinta o caducada.');
    await d.confirmations.confirm('confirmo '+c.code);return{notice:'Conversación eliminada.',pendingCleanup:d.store.cleanup().length};
   }
   case 'cleanup':return{pendingCleanup:await d.provider.cleanup()};
   case 'reconcile':return{notice:`${await d.provider.reconcile(c.id)} resultado(s) recuperado(s). Las acciones inciertas no se repiten.`,snapshot:await snapshot(c.id)};
  }
 };
 d.handle('conversations',ConversationCommandSchema,command);
 return{snapshot,select};
}
