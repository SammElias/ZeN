import {CompanionEventSchema,CompanionLastReplySchema,type CompanionLastReply,type CompanionEvent,type CompanionStatus,type CompanionSettings,type CompanionApproval,type CompanionSession,type CompanionNotice,type CompanionConnection,type CompanionTarget,type CompanionSummary} from '../shared/codex-companion';
import {toolActivity,isSilenced,observedCommand} from '../shared/companion-presentation';
import {matchesTarget} from '../shared/companion-target';
import {preferCompanionReply} from './companion-reply';
type Decision='allow'|'deny'|'pass';
/** Local observer. Only the pinned chat's latest confirmed answer is retained in RAM. */
export class CompanionHub{
 private sessions=new Map<string,CompanionSession>();
 private pending=new Map<string,{view:CompanionApproval;reply:(d:Decision)=>void;timer:ReturnType<typeof setTimeout>}>();
 private delegated=new Map<string,{timer:ReturnType<typeof setTimeout>;tool?:string}>();
 private seen=new Set<string>();private notices:CompanionStatus['notices']=[];
 private announced=new Set<string>();
 private lastEventAt?:number;
 private ignoredEvents=0;targetError?:string;
 account:CompanionStatus['account']='unchecked';checking=false;installed=false;error?:string;
 connection:CompanionConnection={state:'unchecked',total:0,trusted:0,enabled:0};
 constructor(public settings:CompanionSettings,private changed:()=>void,private notify:(notice:CompanionStatus['notices'][number])=>void,private now=()=>Date.now(),private target?:CompanionTarget,private observed?:(event:CompanionEvent,session:CompanionSession,reply?:CompanionLastReply)=>void){}
 setSummary(id:string,runKey:string,summary:CompanionSummary){const s=this.sessions.get(id);if(!s||s.runKey!==runKey||s.state!=='finished')return;s.summary=summary;this.changed();}
 private canReadReply(session:string,cwd:string){return !this.targetError&&!!this.target&&matchesTarget(this.target,session,cwd)&&!this.settings.paused&&!this.settings.presentation;}
 lastReply(selected:CompanionTarget){
  if(!this.canReadReply(selected.session,selected.cwd))return undefined;
  const reply=this.sessions.get(selected.session)?.lastReply;
  return reply?{...reply}:undefined;
 }
 /** Restore a confirmed local answer without inventing activity, a Stop or a notice. */
 setLastReply(session:string,cwd:string,reply:CompanionLastReply):boolean{
  const parsed=CompanionLastReplySchema.safeParse(reply);
  if(!parsed.success||parsed.data.source!=='local'||!parsed.data.text.trim()||!this.target||!this.canReadReply(session,cwd))return false;
  const prior=this.sessions.get(session),last=prior?.lastReply,next=parsed.data;
  if(last&&(preferCompanionReply(last,next)===last||last.text===next.text&&last.turn===next.turn&&last.truncated===next.truncated))return false;
  const value=prior??{id:session,label:this.target.title,title:this.target.title,cwd:this.target.cwd,state:'idle' as const,at:0,steps:[]};
  value.lastReply={...next};this.sessions.set(session,value);this.changed();return true;
 }
 private snapshotSessions(supervise=false){
  return [...this.sessions.values()].filter(s=>supervise||!this.target||s.id===this.target.session)
   .sort((a,b)=>b.at-a.at).map(s=>({...s,lastReply:!supervise&&s.lastReply?{...s.lastReply}:undefined,
    summary:!supervise&&s.summary?structuredClone(s.summary):undefined,observation:s.observation?{...s.observation}:undefined,
    state:this.pendingFor(s.id)||this.delegated.has(s.id)?'approval' as const:
     ['thinking','working','approval'].includes(s.state)&&this.now()-s.at>120000?'unknown' as const:s.state,
    steps:s.steps.map(t=>({...t}))}));
 }
 private pendingFor(id:string){return [...this.pending.values()].some(p=>p.view.session===id);}
 activitySessions(){return this.snapshotSessions(true);}
 status():CompanionStatus{return{settings:{...this.settings},target:this.target?{...this.target}:undefined,targetError:this.targetError,ignoredEvents:this.ignoredEvents,account:this.account,checking:this.checking,connection:{...this.connection},integration:this.lastEventAt?'receiving':this.installed?'waiting':'missing',sessions:this.snapshotSessions(),approvalCount:this.pending.size+this.delegated.size,approvals:[...this.pending.values()].map(p=>({...p.view})),notices:this.notices.map(n=>({...n})),lastEventAt:this.lastEventAt,error:this.error};}
 publish(){this.changed();}
 private notice(id:string,session:string,title:string,kind:CompanionNotice['kind']){const item={id,session,title,kind,read:false,audible:this.settings.sounds&&!this.settings.presentation&&!isSilenced(this.settings,this.now()),at:this.now()};this.notices=[item,...this.notices].slice(0,30);if(this.settings.notifications&&!this.settings.presentation&&!isSilenced(this.settings,this.now()))this.notify(item);}
 markNoticesRead(){for(const n of this.notices)n.read=true;this.changed();}
 setTitle(session:string,title:unknown){const s=this.sessions.get(session);if(s&&typeof title==='string'&&title.trim()&&title.length<=200){s.title=title.trim();s.label=s.title;for(const p of this.pending.values())if(p.view.session===session)p.view.label=s.title;this.changed();}}
 clearNotices(){this.notices=[];this.changed();}
 update(settings:CompanionSettings){this.settings=settings;if(settings.paused){for(const id of [...this.pending.keys()])this.decide(id,'pass');for(const id of this.delegated.keys())this.clearDelegated(id);}this.changed();}
 private clearDelegated(session:string){
  const seen=this.delegated.get(session);if(!seen)return;
  clearTimeout(seen.timer);this.delegated.delete(session);
  const current=this.sessions.get(session);if(current?.state==='approval'&&!this.pendingFor(session))current.state='unknown';
 }
 private observeDelegatedPermission(e:CompanionEvent,session:CompanionSession){
  const first=!this.delegated.has(e.session);
  clearTimeout(this.delegated.get(e.session)?.timer);
  session.state='approval';
  const timer=setTimeout(()=>{this.clearDelegated(e.session);this.changed();},105000);
  this.delegated.set(e.session,{timer,tool:e.tool});
  if(first)this.notice(e.id,e.session,'Codex necesita tu permiso','permission');
 }
 accept(raw:unknown,reply:(d:Decision)=>void):()=>void{
  const parsed=CompanionEventSchema.safeParse(raw);if(!parsed.success||this.settings.paused){reply('pass');return()=>{};}
  const e=parsed.data,scoped=!this.target||matchesTarget(this.target,e.session,e.cwd);
  if(this.targetError||this.target?.session===e.session&&!scoped){this.ignoredEvents++;reply('pass');this.changed();return()=>{};}
  if(this.seen.has(e.id)){reply('pass');return()=>{};}this.seen.add(e.id);if(this.seen.size>2000)this.seen.delete(this.seen.values().next().value!);
  if(scoped)this.lastEventAt=this.now();const prior=this.sessions.get(e.session);
  if(prior?.turn&&e.turn&&prior.turn!==e.turn&&e.event!=='UserPromptSubmit'&&e.event!=='SessionStart'){reply('pass');this.changed();return()=>{};}
  if(['UserPromptSubmit','SessionStart','Stop','Interrupt','SessionEnd'].includes(e.event)||
   e.event==='PostToolUse'&&this.delegated.get(e.session)?.tool===e.tool)this.clearDelegated(e.session);
  if(['UserPromptSubmit','SessionStart','Stop','Interrupt','SessionEnd'].includes(e.event))for(const [id,p]of this.pending)if(p.view.session===e.session)this.decide(id,'pass');
  const title=prior?.title??(scoped?this.target?.title:undefined);
  const label=title??e.cwd.split(/[\\/]/).filter(Boolean).pop()??'Codex';
  const observation:NonNullable<CompanionSession['observation']>=e.event==='UserPromptSubmit'?{since:this.now(),startedAt:this.now(),actions:0}:e.event==='SessionStart'?{since:this.now(),actions:0}:{...prior?.observation??{since:this.now(),actions:0}};
  if(e.event==='PreToolUse')observation.actions++;
  if(e.event==='Stop'&&observation.endedAt===undefined)observation.endedAt=this.now();
  const fresh=e.event==='UserPromptSubmit'||e.event==='SessionStart';
  const session:CompanionSession={id:e.session,turn:e.turn??prior?.turn,runKey:fresh?e.id:prior?.runKey??e.id,summary:fresh?undefined:prior?.summary,lastReply:prior?.lastReply,label:label||'Codex',title,cwd:e.cwd,state:prior?.state??'idle',tool:e.tool,at:this.now(),observation,steps:e.event==='UserPromptSubmit'?[]:prior?.steps??[]};
  const duplicateStop=e.event==='Stop'&&prior?.state==='finished'&&prior.turn===session.turn;
  let acceptedReply:CompanionLastReply|undefined;
  if(e.event==='Stop'&&!duplicateStop&&!e.failed&&e.lastAssistantMessage?.trim()&&this.canReadReply(e.session,e.cwd)){
   acceptedReply={text:e.lastAssistantMessage,at:this.now(),source:'hook',turn:e.turn,truncated:e.lastAssistantMessageTruncated};
   session.lastReply=acceptedReply;
  }
  const labels:Record<CompanionEvent['event'],string>={SessionStart:'Sesión abierta',UserPromptSubmit:'Pensando',PreToolUse:'Ejecutando',PermissionRequest:'Necesita permiso',PostToolUse:e.failed?'Herramienta con error':'Acción terminada',Stop:'Turno terminado',SubagentStart:'Agente iniciado',SubagentStop:'Agente terminado',Interrupt:'Interrumpido',SessionEnd:'Sesión cerrada'};
  if(!duplicateStop){
   const activity=e.tool?toolActivity(e.tool):undefined;
   const toolLabel=activity&&(e.tool?.startsWith(activity.label.replace(/…$/,''))?'Herramienta de Codex':activity.label);
   const label=toolLabel?`${labels[e.event]} · ${toolLabel}`:labels[e.event];
   const command=activity?.kind==='command'&&e.event!=='PermissionRequest';
   const preview=command?(scoped?e.preview:observedCommand(e.preview)):undefined;
   session.steps=[...session.steps,{id:e.id,label,kind:activity?.kind,tool:e.tool,preview,at:this.now()}].slice(-20);
  }
  if(e.event==='UserPromptSubmit')session.state='thinking';
  else if(e.event==='PreToolUse')session.state='working';
  else if(e.event==='PostToolUse')session.state=e.failed?'error':'thinking';
  else if(e.event==='Stop')session.state='finished';
  else if(e.event==='Interrupt')session.state='interrupted';
  else if(['SessionStart','SessionEnd'].includes(e.event))session.state='idle';
  this.sessions.set(e.session,session);if(this.sessions.size>40){const oldest=this.snapshotSessions(true).reverse().find(s=>s.id!==e.session&&s.id!==this.target?.session&&!this.pendingFor(s.id));if(oldest){this.clearDelegated(oldest.id);this.sessions.delete(oldest.id);}}
  if(!scoped){if(e.event==='PermissionRequest')this.observeDelegatedPermission(e,session);reply('pass');this.changed();return()=>{};}
  try{this.observed?.(e,session,acceptedReply?{...acceptedReply}:undefined);}catch{/* Optional observers cannot delay or break hook replies. */}
  if(e.event==='PermissionRequest'){
   if(e.turn&&e.preview&&!e.truncated&&e.preview.length<=64000){session.state='approval';const view={id:e.id,session:e.session,turn:e.turn,label,tool:e.tool??'Acción',preview:e.preview,expiresAt:this.now()+105000};const timer=setTimeout(()=>this.decide(e.id,'pass'),105000);this.pending.set(e.id,{view,reply,timer});this.notice(e.id,e.session,'Codex necesita tu permiso','permission');this.changed();return()=>this.abandon(e.id);}
   this.observeDelegatedPermission(e,session);
  }else if(e.event==='Stop'||e.failed){const kind=e.failed?'error':'finished',key=e.session+'|'+(e.turn??e.id)+'|'+kind;if(!this.announced.has(key)){this.announced.add(key);if(this.announced.size>1000)this.announced.delete(this.announced.values().next().value!);this.notice(e.id,e.session,e.failed?'Codex: revisa un error':'Codex terminó el turno',kind);}}
  reply('pass');this.changed();return()=>{};
 }
 decide(id:string,decision:Decision){const p=this.pending.get(id);if(!p)throw Error('Esta solicitud ya terminó o caducó.');if(this.settings.presentation&&decision!=='pass')throw Error('Desactiva Presentación para revisar la acción completa o revísala en Codex.');const s=this.sessions.get(p.view.session);if(decision!=='pass'&&(!s||s.turn!==p.view.turn||this.now()>=p.view.expiresAt)){this.decide(id,'pass');throw Error('El permiso ya no pertenece al turno activo.');}this.pending.delete(id);clearTimeout(p.timer);p.reply(decision);if(s&&!this.pendingFor(s.id)&&!this.delegated.has(s.id))s.state='unknown';this.changed();}
 private abandon(id:string){const p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.timer);const s=this.sessions.get(p.view.session);if(s&&!this.pendingFor(s.id)&&!this.delegated.has(s.id))s.state='unknown';this.changed();}
 dispose(){for(const id of this.delegated.keys())this.clearDelegated(id);for(const id of [...this.pending.keys()])this.decide(id,'pass');}
}
