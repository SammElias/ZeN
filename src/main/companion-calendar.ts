import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {CalendarEvent,CalendarSource,CalendarRange,CalendarReply,CalendarLibrary,calendarDraftEvent,calendarOverlaps,eventKey,sourceKey,
 type CalendarDraft,type CalendarOperation,type CalendarSnapshot} from '../shared/companion-calendar';

type Target={session:string;cwd:string};
type Dependencies={
 policy:()=>{visible:boolean;allowed:boolean;target?:Target};
 queue:(thread:string,text:string,verify:()=>void)=>Promise<void>;
 changed:()=>void;
};
const coverage=z.object({range:CalendarRange,source:z.string(),complete:z.boolean(),at:z.number()});
const creation=z.object({draftId:z.uuid(),requestId:z.uuid(),eventKey:z.string().optional()});
const stored=z.object({version:z.literal(1),events:z.array(CalendarEvent).max(10000),sources:z.array(CalendarSource).max(100),
 coverage:z.array(coverage).max(200),creations:z.array(creation).max(1000).default([])});
type Pending={operation:CalendarOperation;target:Target;sources:string[];event?:CalendarEvent;awaitingLateReply?:boolean};

export class CompanionCalendar {
 private state:z.infer<typeof stored>={version:1,events:[],sources:[],coverage:[],creations:[]};
 private pending=new Map<string,Pending>();
 private damaged=false;
 constructor(private file:string,private deps:Dependencies){
  try{this.state=stored.parse(JSON.parse(readFileSync(file,'utf8')));}catch{this.damaged=existsSync(file);}
 }
 get waiting(){return [...this.pending.values()].some(item=>item.operation.status==='waiting'||item.operation.status==='uncertain'||item.awaitingLateReply);}
 private save(next:typeof this.state){
  if(this.damaged)throw Error('El calendario local contiene datos dañados. Conserva el archivo original antes de restaurar una copia.');
  const value=stored.parse(next);
  writeFileSync(this.file+'.tmp',JSON.stringify(value));renameSync(this.file+'.tmp',this.file);
  this.state=value;this.deps.changed();
 }
 private requireVisible(){
  const policy=this.deps.policy();
  if(!policy.visible||!policy.allowed)throw Error('Abre Calendario y desactiva Pausa o Presentación.');
  return policy;
 }
 snapshot():CalendarSnapshot{
  const policy=this.requireVisible();
  if(this.damaged)throw Error('No se pudo leer el calendario local. Se conserva el archivo original.');
  for(const pending of this.pending.values()){
   if(pending.operation.status==='waiting'&&Date.now()-pending.operation.at>120000){
    pending.operation.status=pending.operation.type==='created'?'uncertain':'error';
    // Other work in the pinned chat may delay a valid result past the UI timeout.
    pending.awaitingLateReply=pending.operation.type==='events';
    pending.operation.message='Codex todavía no ha confirmado el resultado. Comprueba el chat fijado.';
   }
  }
  const {events,sources,coverage}=structuredClone(this.state);
  const restored=this.state.creations.filter(item=>!item.eventKey&&!this.pending.has(item.requestId)).map(item=>({
   id:item.requestId,type:'created' as const,draftId:item.draftId,status:'uncertain' as const,at:0,
   message:'Creación pendiente de confirmar tras reiniciar. Comprueba el calendario en Codex.',
  }));
  return {events,sources,coverage,operations:[...this.pending.values()].map(item=>({...item.operation})).concat(restored),canRequest:!!policy.target,
   confirmations:this.state.creations.flatMap(item=>item.eventKey?[{draftId:item.draftId,eventKey:item.eventKey}]:[])};
 }
 backupLocal(){
  if(this.damaged)throw Error('No se puede respaldar el calendario local hasta recuperar sus datos.');
  return CalendarLibrary.parse({version:1,events:this.state.events.filter(event=>event.accountId==='zen-local')});
 }
 restoreLocal(value:z.infer<typeof CalendarLibrary>){
  const before=this.backupLocal(),next=CalendarLibrary.parse(value);
  this.save({...this.state,events:[...this.state.events.filter(event=>event.accountId!=='zen-local'),...next.events]});
  return ()=>this.restoreLocal(before);
 }
 async refresh(range:CalendarRange,sources:string[]){
  sources=[...new Set(sources)].sort();
  for(const [id,item] of this.pending){
   if(item.operation.type==='events'&&item.operation.status==='error'&&JSON.stringify(item.operation.range)===JSON.stringify(range))this.pending.delete(id);
  }
  const current=[...this.pending.values()].find(item=>item.operation.type==='events'&&item.operation.status==='waiting'&&
   JSON.stringify(item.operation.range)===JSON.stringify(range)&&JSON.stringify(item.sources)===JSON.stringify(sources));
  if(current)return this.snapshot();
  const instruction='Usa el conector de Google Calendar disponible en ESTE chat. Consulta el perfil y todos los calendarios accesibles. '+
   'Consulta eventos que se SOLAPAN con el intervalo (inicio incluido, fin exclusivo), recorriendo toda la paginación y expandiendo recurrencias y excepciones. '+
   'Conserva identidad de cuenta, calendario y evento. No reconstruyas la agenda del historial. No crees ni modifiques eventos. '+
   'Devuelve cada calendario consultado en coverage y marca complete=true solo si terminaste todas sus páginas. '+
   'Incluye cancelaciones cuando las facilite el proveedor. Si careces del conector devuelve type:error. '+
   'Los calendarios writable=true deben tener permiso de escritura confirmado por el proveedor.\n'+
   JSON.stringify({range,selectedSources:sources,response:{version:1,type:'events',range,
    sources:[{accountId:'identidad-real',id:'calendario-real',name:'Nombre',writable:false}],
    coverage:[{accountId:'identidad-real',calendarId:'calendario-real',complete:true}],
    events:[{id:'evento-real',accountId:'identidad-real',calendarId:'calendario-real',title:'Título real',start:'fecha ISO con offset o YYYY-MM-DD si allDay',
     end:'fin exclusivo ISO con offset o YYYY-MM-DD',allDay:false,timeZone:range.timeZone,description:'',location:'',cancelled:false}]}});
  await this.send({id:randomUUID(),type:'events',status:'waiting',at:Date.now(),range},sources,instruction);
  return this.snapshot();
 }
 async create(draft:CalendarDraft){
  this.requireVisible();
  const event=calendarDraftEvent(draft);
  if(draft.destination==='local'){
   const previous=this.state.events.find(item=>item.accountId==='zen-local'&&item.id===draft.id);
   if(!previous)this.save({...this.state,events:[...this.state.events,event]});
   return {event:previous??event,local:true as const};
  }
  const source=this.state.sources.find(source=>sourceKey(source)===draft.destination&&source.writable);
  if(!source)throw Error('El calendario de destino no tiene permiso de escritura confirmado.');
  const previous=[...this.pending.values()].find(item=>item.operation.draftId===draft.id);
  if(previous)return {operation:previous.operation};
  const receipt=this.state.creations.find(item=>item.draftId===draft.id);
  if(receipt){
   const confirmed=this.state.events.find(item=>eventKey(item)===receipt.eventKey);
   if(confirmed)return {event:confirmed,local:false as const};
   return {operation:{id:receipt.requestId,draftId:draft.id,type:'created' as const,status:'uncertain' as const,
    at:Date.now(),message:'Hay una creación anterior pendiente de confirmación. Comprueba el calendario en Codex antes de repetirla.'}};
  }
  const remote={...event,accountId:source.accountId,calendarId:source.id};
  const instruction='Crea UN evento sin asistentes ni invitaciones en el calendario de destino mediante el conector de Google Calendar de ESTE chat. '+
   'La acción Guardar ya fue solicitada explícitamente. Respeta cualquier aprobación exigida por el conector. '+
   'Usa el identificador de solicitud como idempotencia si el proveedor lo permite. Si no, comprueba duplicados antes de crear. '+
   'Si el resultado es incierto no vuelvas a crear el evento. Devuelve type:error con esa limitación. '+
   'Devuelve type:created únicamente tras recibir un id REAL del proveedor y sus fechas reales, cuenta y calendario. '+
   'El campo end de eventos de día completo es EXCLUSIVO.\n'+
   JSON.stringify({event:remote,response:{version:1,type:'created',event:remote}});
  const operation:CalendarOperation={id:randomUUID(),type:'created',status:'waiting',at:Date.now(),draftId:draft.id};
  if(!this.deps.policy().target)throw Error('Calendario no conectado. Se conserva el formulario.');
  this.save({...this.state,creations:[...this.state.creations,{draftId:draft.id,requestId:operation.id}]});
  await this.send(operation,[draft.destination],instruction,remote);
  return {operation};
 }
 private async send(operation:CalendarOperation,sources:string[],instruction:string,event?:CalendarEvent){
  const policy=this.requireVisible(),target=policy.target;
  if(!target)throw Error('Calendario no conectado. Fija un chat de Codex en Ajustes para solicitar el calendario.');
  if(this.pending.size>=100)throw Error('Hay demasiadas consultas guardadas. Revisa las operaciones pendientes en Codex.');
  const item:Pending={operation,target:{...target},sources,event};
  this.pending.set(operation.id,item);this.deps.changed();
  try{
   await this.deps.queue(target.session,instruction+'\nResponde únicamente con <zen_calendar id="'+operation.id+'">JSON válido</zen_calendar>. '+
    'Formato de error {"version":1,"type":"error","message":"Motivo concreto"}. La solicitud es '+operation.id,()=>{
     const current=this.requireVisible().target;
     if(current?.session!==target.session||current.cwd!==target.cwd)throw Error('El chat fijado ha cambiado.');
    });
  }catch(error){
   operation.status=operation.type==='created'?'uncertain':'error';
   operation.message=error instanceof Error?error.message:'No se pudo confirmar la entrega a Codex.';
   this.deps.changed();
  }
 }
 observe(session:string,cwd:string,text:string){
  if(text.length>1_500_000)return;
  const tag=/<zen_calendar id="([a-f0-9-]{36})">\s*([\s\S]*?)\s*<\/zen_calendar>/.exec(text);
  if(!tag)return;
  const pending=this.pending.get(tag[1]);
  if(!pending||pending.target.session!==session||pending.target.cwd!==cwd)return;
  const operation=pending.operation;
  if(operation.status!=='waiting'&&operation.status!=='uncertain'&&!pending.awaitingLateReply)return;
  pending.awaitingLateReply=false;
  try{
   const reply=CalendarReply.parse(JSON.parse(tag[2]));
   if(reply.type==='error')throw Error(reply.message);
   if(reply.type!==operation.type)throw Error('La respuesta de Codex no corresponde a esta solicitud.');
   if(reply.type==='created'){
    const requested=pending.event!;
    if(reply.event.cancelled||reply.event.accountId!==requested.accountId||reply.event.calendarId!==requested.calendarId)
     throw Error('La confirmación pertenece a otro calendario.');
    const sameStart=requested.allDay?reply.event.start===requested.start:Date.parse(reply.event.start)===Date.parse(requested.start);
    const sameEnd=requested.allDay?reply.event.end===requested.end:Date.parse(reply.event.end)===Date.parse(requested.end);
    if(reply.event.allDay!==requested.allDay||!sameStart||!sameEnd||reply.event.title!==requested.title)
     throw Error('La confirmación no coincide con el evento solicitado. Comprueba Codex antes de repetirlo.');
    this.save({...this.state,events:[...this.state.events.filter(event=>eventKey(event)!==eventKey(reply.event)),reply.event],
     creations:this.state.creations.map(item=>item.requestId===operation.id?{...item,eventKey:eventKey(reply.event)}:item)});
    operation.message='Creado y confirmado por el calendario.';
   }else{
    if(JSON.stringify(reply.range)!==JSON.stringify(operation.range))throw Error('El intervalo de la respuesta no coincide.');
    const sources=new Map(reply.sources.map(source=>[sourceKey(source),source]));
    const covered=new Map(reply.coverage.map(item=>[sourceKey({accountId:item.accountId,id:item.calendarId}),item.complete]));
    for(const key of covered.keys()){
     if(!sources.has(key)||pending.sources.length&&!pending.sources.includes(key))throw Error('Cobertura de un calendario no solicitado.');
    }
    const existingSources=new Map(this.state.sources.map(source=>[sourceKey(source),source]));
    for(const [id,source] of sources)existingSources.set(id,source);
    const events=new Map(this.state.events.map(event=>[eventKey(event),event]));
    for(const event of reply.events){
     const source=sourceKey({accountId:event.accountId,id:event.calendarId});
     if(!sources.has(source)||!covered.has(source)||event.accountId==='zen-local'||pending.sources.length&&!pending.sources.includes(source)||
      !calendarOverlaps({...event,cancelled:false},reply.range))
      throw Error('La respuesta contiene eventos de un calendario ajeno al intervalo consultado.');
    }
    for(const [id,event] of events){
     const key=sourceKey({accountId:event.accountId,id:event.calendarId});
     if(event.accountId!=='zen-local'&&covered.get(key)===true&&calendarOverlaps(event,reply.range))events.delete(id);
    }
    for(const event of reply.events){if(event.cancelled)events.delete(eventKey(event));else events.set(eventKey(event),event);}
    const at=Date.now();
    const ranges=this.state.coverage.filter(item=>JSON.stringify(item.range)!==JSON.stringify(reply.range)||!covered.has(item.source));
    for(const [source,complete] of covered)ranges.push({range:reply.range,source,complete,at});
    this.save({...this.state,sources:[...existingSources.values()],events:[...events.values()],coverage:ranges.slice(-200)});
   }
   this.pending.delete(operation.id);this.deps.changed();
  }catch(error){
   operation.status=operation.type==='created'?'uncertain':'error';
   operation.message=error instanceof Error?error.message:'Resultado estructurado inválido.';this.deps.changed();
  }
 }
}
