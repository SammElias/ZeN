import {CompanionEventSchema,type CompanionEvent,type CompanionStatus,type CompanionSettings,type CompanionApproval,type CompanionSession,type CompanionNotice,type CompanionConnection,type CompanionTarget} from '../shared/codex-companion';
import {toolActivity,matchesTarget,isSilenced} from '../shared/companion-presentation';
type Decision='allow'|'deny'|'pass';
/** Event-only observer. No task execution, prompt context, transcript or model call. */
export class CompanionHub{
 private sessions=new Map<string,CompanionSession>();
 private pending=new Map<string,{view:CompanionApproval;reply:(d:Decision)=>void;timer:ReturnType<typeof setTimeout>}>();
 private seen=new Set<string>();private notices:CompanionStatus['notices']=[];
 private announced=new Set<string>();
 private lastEventAt?:number;
 private ignoredEvents=0;targetError?:string;
 account:CompanionStatus['account']='unchecked';checking=false;installed=false;error?:string;
 connection:CompanionConnection={state:'unchecked',total:0,trusted:0,enabled:0};
 constructor(public settings:CompanionSettings,private changed:()=>void,private notify:(notice:CompanionStatus['notices'][number])=>void,private now=()=>Date.now(),private target?:CompanionTarget){}
 status():CompanionStatus{return{settings:{...this.settings},target:this.target?{...this.target}:undefined,targetError:this.targetError,ignoredEvents:this.ignoredEvents,account:this.account,checking:this.checking,connection:{...this.connection},integration:this.lastEventAt?'receiving':this.installed?'waiting':'missing',sessions:[...this.sessions.values()].sort((a,b)=>b.at-a.at).map(s=>({...s,observation:s.observation?{...s.observation}:undefined,state:['thinking','working'].includes(s.state)&&this.now()-s.at>120000?'unknown':s.state,steps:[...s.steps]})),approvals:[...this.pending.values()].map(p=>({...p.view})),notices:this.notices.map(n=>({...n})),lastEventAt:this.lastEventAt,error:this.error};}
 publish(){this.changed();}
 private notice(id:string,session:string,title:string,kind:CompanionNotice['kind']){const item={id,session,title,kind,read:false,at:this.now()};this.notices=[item,...this.notices].slice(0,30);if(this.settings.notifications&&!isSilenced(this.settings,this.now()))this.notify(item);}
 markNoticesRead(){for(const n of this.notices)n.read=true;this.changed();}
 setTitle(session:string,title:unknown){const s=this.sessions.get(session);if(s&&typeof title==='string'&&title.trim()&&title.length<=200){s.title=title.trim();s.label=s.title;for(const p of this.pending.values())if(p.view.session===session)p.view.label=s.title;this.changed();}}
 clearNotices(){this.notices=[];this.changed();}
 update(settings:CompanionSettings){this.settings=settings;if(settings.paused)for(const id of [...this.pending.keys()])this.decide(id,'pass');this.changed();}
 accept(raw:unknown,reply:(d:Decision)=>void):()=>void{
  const parsed=CompanionEventSchema.safeParse(raw);if(!parsed.success||this.settings.paused){reply('pass');return()=>{};}
  const e=parsed.data;if(this.targetError||this.target&&!matchesTarget(this.target,e.session,e.cwd)){this.ignoredEvents++;reply('pass');this.changed();return()=>{};}
  if(this.seen.has(e.id)){reply('pass');return()=>{};}this.seen.add(e.id);if(this.seen.size>2000)this.seen.delete(this.seen.values().next().value!);
  this.lastEventAt=this.now();const prior=this.sessions.get(e.session);
  if(prior?.turn&&e.turn&&prior.turn!==e.turn&&e.event!=='UserPromptSubmit'&&e.event!=='SessionStart'){reply('pass');this.changed();return()=>{};}
  if(['UserPromptSubmit','SessionStart','Stop','Interrupt','SessionEnd'].includes(e.event))for(const [id,p]of this.pending)if(p.view.session===e.session)this.decide(id,'pass');
  const title=prior?.title??this.target?.title;
  const label=title??e.cwd.split(/[\\/]/).filter(Boolean).pop()??'Codex';
  const observation:NonNullable<CompanionSession['observation']>=e.event==='UserPromptSubmit'?{since:this.now(),startedAt:this.now(),actions:0}:{...prior?.observation??{since:this.now(),actions:0}};
  if(e.event==='PreToolUse')observation.actions++;
  if(e.event==='Stop'&&observation.endedAt===undefined)observation.endedAt=this.now();
  const session:CompanionSession={id:e.session,turn:e.turn??prior?.turn,label:label||'Codex',title,cwd:e.cwd,state:prior?.state??'idle',tool:e.tool,at:this.now(),observation,steps:e.event==='UserPromptSubmit'?[]:prior?.steps??[]};
  const labels:Record<CompanionEvent['event'],string>={SessionStart:'Sesión abierta',UserPromptSubmit:'Pensando',PreToolUse:'Ejecutando',PermissionRequest:'Necesita permiso',PostToolUse:e.failed?'Herramienta con error':'Acción terminada',Stop:'Turno terminado',SubagentStart:'Agente iniciado',SubagentStop:'Agente terminado',Interrupt:'Interrumpido',SessionEnd:'Sesión cerrada'};
  if(!(e.event==='Stop'&&prior?.state==='finished'&&prior.turn===session.turn))session.steps=[...session.steps,{id:e.id,label:labels[e.event]+(e.tool?' · '+toolActivity(e.tool):''),preview:e.preview,at:this.now()}].slice(-20);
  if(e.event==='UserPromptSubmit')session.state='thinking';
  else if(e.event==='PreToolUse')session.state='working';
  else if(e.event==='PostToolUse')session.state=e.failed?'error':'thinking';
  else if(e.event==='Stop')session.state='finished';
  else if(e.event==='Interrupt')session.state='interrupted';
  else if(['SessionStart','SessionEnd'].includes(e.event))session.state='idle';
  this.sessions.set(e.session,session);if(this.sessions.size>40){const oldest=[...this.sessions.keys()].find(id=>id!==e.session&&![...this.pending.values()].some(p=>p.view.session===id));if(oldest)this.sessions.delete(oldest);}
  if(e.event==='PermissionRequest'){
   if(e.turn&&e.preview&&!e.truncated&&e.preview.length<=64000){session.state='approval';const view={id:e.id,session:e.session,turn:e.turn,label,tool:e.tool??'Acción',preview:e.preview,expiresAt:this.now()+105000};const timer=setTimeout(()=>this.decide(e.id,'pass'),105000);this.pending.set(e.id,{view,reply,timer});this.notice(e.id,e.session,'Codex necesita tu permiso','permission');this.changed();return()=>this.abandon(e.id);}
   session.state='unknown';this.notice(e.id,e.session,'Revisa el permiso completo en Codex','permission');
  }else if(e.event==='Stop'||e.failed){const kind=e.failed?'error':'finished',key=e.session+'|'+(e.turn??e.id)+'|'+kind;if(!this.announced.has(key)){this.announced.add(key);if(this.announced.size>1000)this.announced.delete(this.announced.values().next().value!);this.notice(e.id,e.session,e.failed?'Codex: revisa un error':'Codex terminó el turno',kind);}}
  reply('pass');this.changed();return()=>{};
 }
 decide(id:string,decision:Decision){const p=this.pending.get(id);if(!p)throw Error('Esta solicitud ya terminó o caducó.');const s=this.sessions.get(p.view.session);if(decision!=='pass'&&(!s||s.turn!==p.view.turn||this.now()>=p.view.expiresAt)){this.decide(id,'pass');throw Error('El permiso ya no pertenece al turno activo.');}this.pending.delete(id);clearTimeout(p.timer);p.reply(decision);if(s)s.state='unknown';this.changed();}
 private abandon(id:string){const p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.timer);const s=this.sessions.get(p.view.session);if(s)s.state='unknown';this.changed();}
 dispose(){for(const id of [...this.pending.keys()])this.decide(id,'pass');}
}
