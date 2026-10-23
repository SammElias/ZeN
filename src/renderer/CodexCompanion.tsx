import React,{useEffect,useRef,useState} from 'react';
import {CompanionSettingsSchema,type CompanionStatus,type CompanionSettings,type CompanionSession} from '../shared/codex-companion';
import {activeSession,currentChat,phaseNames as names,connectionLabel,toolActivity,isSilenced,lastSignalLabel,completionDetail} from '../shared/companion-presentation';
import {IslandStateMachine} from '../coucou/island/fsm';
import {setLanguage} from '../coucou/i18n/i18n';
import {Sound} from '../coucou/core/sound';
setLanguage('es');
const initial:CompanionStatus={settings:CompanionSettingsSchema.parse({}),account:'unchecked',checking:false,integration:'missing',sessions:[],approvals:[],notices:[]};
function useCompanion(){
 const [status,setStatus]=useState(initial),[ready,setReady]=useState(false);
 useEffect(()=>{const update=(v:CompanionStatus)=>{setStatus(v);setReady(true);};const off=window.companion.onStatus(update);void window.companion.status().then(r=>{if(r.ok)update(r.value);});return off;},[]);
 return{status,ready};
}
function useClock(){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{let timer:ReturnType<typeof setInterval>|undefined;const sync=()=>{clearInterval(timer);if(!document.hidden){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),1000);}};sync();document.addEventListener('visibilitychange',sync);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',sync);};},[]);
 return now;
}
function useNoticeSound(status:CompanionStatus,ready:boolean){
 const seen=useRef<Set<string>|null>(null);
 useEffect(()=>{Sound.setEnabled(status.settings.sounds&&!status.settings.paused&&!isSilenced(status.settings));Sound.setVolume(.1);if(ready&&status.settings.sounds)void Sound.preload();},[ready,status]);
 useEffect(()=>{if(!ready)return;const ids=new Set(status.notices.map(n=>n.id));if(seen.current){const next=status.notices.find(n=>!seen.current!.has(n.id)&&!n.read);if(next&&!document.hidden&&status.settings.sounds&&!status.settings.paused&&!isSilenced(status.settings)){Sound.resume();Sound.play(next.kind==='permission'?'approval':next.kind==='error'?'error':'finish');}}seen.current=ids;},[status,ready]);
}
function Symbol({name}:{name:'code'|'bell'|'settings'|'arrow'|'close'|'check'|'sound'|'mute'}){
 const paths={code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',arrow:'M5 12h14m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4 10-10',sound:'M11 4 6 8H3v8h3l5 4V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',mute:'M11 4 6 8H3v8h3l5 4V4m5 5 6 6m-6 0 6-6'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function CodePreview({text}:{text:string}){
 const [notice,setNotice]=useState(''),lines=text.split('\n');
 return <div className="code-preview"><div><span>Código / acción</span><button onClick={async()=>{const r=await window.companion.copy(text);setNotice(r.ok?'Copiado':r.error);}}>{notice||'Copiar'}</button></div><pre>{lines.map((line,index)=><span className={line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':line.startsWith('@@')||line.startsWith('***')?'diff-header':''} key={index}>{line}{index<lines.length-1?'\n':''}</span>)}</pre></div>;
}
function OpenCodex({id,children}:{id?:string;children?:React.ReactNode}){
 const [error,setError]=useState('');
 return <><button className="primary" onClick={async()=>{const r=await window.companion.openCodex(id);if(!r.ok)setError(r.error);}}>{children??(id?'Volver al chat':'Abrir Codex')}<Symbol name="arrow"/></button>{error&&<small role="alert">{error}</small>}</>;
}
function Connection({status}:{status:CompanionStatus}){
 return <span className={'connection-status connection-'+(status.settings.paused?'paused':status.connection?.state??'unchecked')} title={status.connection?.checkedAt?'Comprobado a las '+new Date(status.connection.checkedAt).toLocaleTimeString('es'):undefined}><i/>{connectionLabel(status)}</span>;
}
function Signal({status}:{status:CompanionStatus}){const now=useClock();return <small className="last-signal" title={status.lastEventAt?new Date(status.lastEventAt).toLocaleString('es'):undefined}>{lastSignalLabel(status.lastEventAt,now)}</small>;}
function Quiet({status}:{status:CompanionStatus}){
 const now=useClock(),quiet=isSilenced(status.settings,now),[error,setError]=useState('');
 return <div className="quiet-control"><button data-quiet={quiet} aria-pressed={quiet} title="Silencia sonido y notificaciones; sigue recibiendo actividad y permisos" onClick={async()=>{const r=await window.companion.silence(quiet?0:30);setError(r.ok?'':r.error);}}><Symbol name={quiet?'bell':'mute'}/>{quiet?'Reactivar avisos · '+Math.ceil((status.settings.silencedUntil-now)/60000)+' min':'Silenciar avisos 30 min'}</button>{error&&<small role="alert">{error}</small>}</div>;
}
function Completion({session}:{session:CompanionSession}){
 const detail=completionDetail(session);return detail?<div className="completion-card"><Symbol name="check"/><div><strong>Turno terminado</strong><small>{detail}</small></div><OpenCodex id={session.id}>Ver en Codex</OpenCodex></div>:null;
}
function RecentSteps({session}:{session:CompanionSession}){
 return <ol className="recent-steps">{session.steps.slice(-3).map(step=><li key={step.id}><span>{step.label}</span><time>{new Date(step.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ol>;
}
function Capsule(){
 const {status,ready}=useCompanion(),[expanded,setExpanded]=useState(false),[error,setError]=useState(''),[reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const fsm=useRef(new IslandStateMachine()),drag=useRef(false);useNoticeSound(status,ready);
 useEffect(()=>{const m=fsm.current;m.pinned=true;m.onTransition=(_f,t)=>{const open=t==='home';setExpanded(open);void window.companion.menu(open);};m.forcePetit();const q=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>setReduced(q.matches);q.addEventListener('change',fn);return()=>{m.cancelTimers();q.removeEventListener('change',fn);};},[]);
 const active=activeSession(status),chat=currentChat(status),phase=status.approvals.length?'approval':active?.state??'idle',state=status.settings.paused?'sleeping':phase==='unknown'||phase==='interrupted'?'idle':phase;
 const unread=status.notices.filter(n=>!n.read).length;
 const label=status.settings.paused?'Avisos en pausa':active?names[phase]:connectionLabel(status);
 const toggle=()=>expanded?fsm.current.forcePetit():fsm.current.forceHome();
 const panel=(v:'activity'|'approvals'|'notices')=>void window.companion.panel(v).then(r=>{if(!r.ok)setError(r.error);});
 return <main className={'companion-capsule '+(expanded?'expanded':'')} data-state={state} data-motion={status.settings.motion&&!reduced} onDragOver={e=>e.preventDefault()} onDrop={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button,a'))return;drag.current=true;e.currentTarget.setPointerCapture(e.pointerId);void window.companion.drag('start');}} onPointerUp={e=>{if(!drag.current)return;drag.current=false;void window.companion.drag('end');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=false;void window.companion.drag('end');}}>
  <header className="companion-bar">
   <button className="companion-brand" aria-label="Opciones de ZEN" aria-expanded={expanded} onClick={toggle}><span className="zen-mark" aria-hidden="true">Z</span></button>
   <button className="companion-state" title={status.target?'Chat fijado · '+status.target.title:active?.label} onClick={()=>panel(status.approvals.length?'approvals':'activity')}><strong><i/>{label}</strong><small>{error||status.targetError||(status.target?'Fijado · '+status.target.title:active?.label)||'Codex trabaja · ZEN te avisa'}</small></button>
   <nav><button className="return-chat" aria-label={chat?'Volver al chat':'Abrir Codex'} title={(chat?'Volver al chat':'Abrir Codex')+' · '+status.settings.returnShortcut} onClick={()=>void window.companion.openCodex(chat).then(r=>{if(!r.ok)setError(r.error);})}><Symbol name="arrow"/></button><button aria-label="Avisos" title={unread?unread+' avisos nuevos':'Avisos'} onClick={()=>panel('notices')}><Symbol name="bell"/>{unread>0&&<b className="badge">{unread}</b>}</button><button aria-label={status.settings.sounds?'Silenciar sonidos':'Activar sonidos'} aria-pressed={!status.settings.sounds} onClick={()=>void window.companion.sound(!status.settings.sounds)}><Symbol name={status.settings.sounds?'sound':'mute'}/></button><button aria-label="Preferencias" title="Preferencias" onClick={()=>void window.companion.settings()}><Symbol name="settings"/></button><button aria-label="Opciones" aria-expanded={expanded} onClick={toggle}>{expanded?'⌃':'⌄'}</button></nav>
  </header>
  {expanded&&<section className="companion-deck"><div className="deck-heading"><span>ZEN <em>× Codex</em></span><div><button aria-label="Ocultar cápsula" onClick={()=>void window.companion.hide()}><Symbol name="close"/></button></div></div>
    <div className="companion-hero"><div><small>{status.target?'CHAT FIJADO':active?'TU CHAT EN CODEX':'TODO OCURRE EN CODEX'}</small><h2>{active?.label??status.target?.title??'Tu trabajo, a un vistazo.'}</h2><p title={status.target?.cwd}>{active?(phase==='working'?toolActivity(active.tool):names[active.state]):status.target?'Proyecto · '+status.target.cwd.split(/[\\/]/).filter(Boolean).pop():'La extensión da acceso al navegador. Codex ejecuta.'}</p></div><OpenCodex id={chat}/></div>
    <div className="companion-shortcuts"><button onClick={()=>panel('activity')}><Symbol name="code"/>Actividad <b>{status.sessions.filter(s=>['working','thinking','approval'].includes(s.state)).length}</b></button><button className={status.approvals.length?'needs-attention':''} onClick={()=>panel('approvals')}><Symbol name="check"/>Permisos <b>{status.approvals.length}</b></button><button onClick={()=>panel('notices')}><Symbol name="bell"/>Avisos <b>{unread}</b></button></div>
    {active?.state==='finished'?<Completion session={active}/>:active?<RecentSteps session={active}/>:<p className="empty-line">Aquí aparecerán las acciones que Codex comunique.</p>}
    <div className="deck-connection"><Connection status={status}/><button onClick={()=>void window.companion.settings()}>Revisar</button></div>
    <div className="deck-signal"><Signal status={status}/><Quiet status={status}/></div>
  </section>}
 </main>;
}
function Settings({status}:{status:CompanionStatus}){
 const [draft,setDraft]=useState<CompanionSettings>(status.settings),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>setDraft(status.settings),[JSON.stringify(status.settings)]);
 const test=async()=>{if(isSilenced(status.settings)){setNotice('Los avisos están silenciados temporalmente. Reactívalos para probar.');return;}if(status.settings.sounds){Sound.setEnabled(true);Sound.setVolume(.1);await Sound.preload();Sound.resume();Sound.play('finish');}const r=await window.companion.testNotice();setNotice(r.ok?'Aviso de prueba enviado. Comprueba el sonido y la notificación.':r.error);};
 return <>
  {status.target&&<div className="companion-card fixed-chat"><span className="eyebrow">SIEMPRE EN EL MISMO CHAT Y PROYECTO</span><h2>{status.target.title}</h2><small>{status.target.cwd}</small><p>La cápsula sigue este chat. Las demás sesiones no cambian su actividad ni sus avisos.</p><OpenCodex id={status.target.session}/></div>}
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  <div className="companion-card connection-diagnosis"><span className="eyebrow">CONEXIÓN CON CODEX</span><dl><dt>Cuenta</dt><dd>{status.account==='chatgpt'?'ChatGPT detectado':status.account==='unchecked'?'Sin comprobar':'Revisar en Codex'}</dd><dt>Integración</dt><dd>{connectionLabel(status)}</dd><dt>Este chat</dt><dd><Signal status={status}/></dd></dl><div className="actions"><button disabled={status.checking} onClick={async()=>{const r=await window.companion.check();if(!r.ok)setNotice(r.error);}}>{status.checking?'Comprobando…':'Comprobar conexión'}</button><Quiet status={status}/></div>{(status.ignoredEvents??0)>0&&<small>Se han descartado {status.ignoredEvents} eventos ajenos al chat o carpeta fijados.</small>}{status.connection?.state==='ready'&&!status.lastEventAt&&<p className="connection-help">Los hooks están revisados, pero todavía no han llegado eventos. Si Codex estaba abierto durante la instalación, sal y vuelve a abrirlo; después continúa el mismo chat. No hace falta reenviar el trabajo.</p>}{status.error&&<p role="alert">{status.error}</p>}{status.account==='missing'&&<p>Inicia sesión en Codex y vuelve a comprobar.</p>}{status.account==='unsupported'&&<p>La sesión comprobada no usa tu cuenta de ChatGPT. Revísala en Codex.</p>}</div>
  <div className="companion-card"><span className="eyebrow">ACTIVIDAD Y PERMISOS</span><h2>{status.connection?.state==='review'?'Falta revisar los hooks':'Enlace local con Codex'}</h2><p>Los hooks comunican acciones, permisos y finales de turno sin consultas al modelo.</p>{status.connection&&status.connection.total>0&&<p>{status.connection.trusted} de {status.connection.total} hooks revisados · {status.connection.enabled} habilitados.</p>}<div className="actions"><button disabled={busy} onClick={async()=>{setBusy(true);const r=await window.companion.install();setNotice(r.ok?'Integración preparada. Revisa los hooks de ZEN con /hooks en Codex CLI.':r.error);setBusy(false);}}>{busy?'Preparando…':status.integration==='missing'?'Preparar integración':'Revisar instalación'}</button><button onClick={async()=>{const r=await window.companion.copy('/hooks');setNotice(r.ok?'Comando copiado. Pégalo en Codex CLI para revisar los hooks de ZEN.':r.error);}}>Copiar /hooks</button></div><small>La primera vez, revisa los hooks de ZEN en Codex CLI con /hooks. ZEN no concede confianza automáticamente. Los permisos de navegación de la extensión se revisan en Codex.</small></div>
  <div className="companion-card"><h2>A tu manera</h2><label>Mostrar cápsula<input value={draft.shortcut} onChange={e=>setDraft({...draft,shortcut:e.target.value})}/></label><label>Volver al chat de Codex<input value={draft.returnShortcut} onChange={e=>setDraft({...draft,returnShortcut:e.target.value})}/></label>{([['motion','Animaciones de estado'],['sounds','Sonidos de aviso'],['notifications','Notificaciones de Windows'],['paused','Pausar recepción y avisos de ZEN']] as const).map(([key,label])=><label className="switch" key={key}><input type="checkbox" checked={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/>{label}</label>)}<div className="actions"><button className="primary" onClick={async()=>{const r=await window.companion.save(draft);setNotice(r.ok?'Preferencias guardadas.':r.error);}}>Guardar</button><button onClick={()=>void test()}>Probar aviso</button></div><small>Pausar ZEN devuelve los permisos pendientes a Codex. Las tareas se detienen desde su chat en Codex.</small></div>
  {notice&&<p role="status">{notice}</p>}<footer>Incluye código MIT de Coucou · Louis Raillé. Iconos ZEN y tonos originales.</footer>
 </>;
}
function Activity({status}:{status:CompanionStatus}){
 const current=activeSession(status);
 return <>
  <div className="activity-summary"><div><Connection status={status}/><Signal status={status}/></div><OpenCodex id={currentChat(status)}/></div>
  {status.target&&<p className="fixed-caption">Chat fijado · {status.target.title}</p>}
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  {status.sessions.length===0?<div className="companion-empty"><Symbol name="code"/><h2>Esperando actividad de este chat</h2><p>Las acciones aparecerán cuando Codex las comunique. Puedes continuar el chat fijado sin preparar otra petición.</p><OpenCodex/></div>:status.sessions.map(s=><article className={'companion-card session-card '+(s.id===current?.id?'current-session':'')} key={s.id}>
   <div className="session-heading"><h2>{s.label}</h2><span className={'state-'+s.state}>{names[s.state]}</span></div><small>{s.cwd}</small><Completion session={s}/>
   <div className="event-list">{s.steps.map(step=><details key={step.id}><summary>{step.label}<time>{new Date(step.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></summary>{step.preview?<CodePreview text={step.preview}/>:<p>Evento observado en Codex.</p>}</details>)}</div><OpenCodex id={s.id}/>
  </article>)}
 </>;
}
function Approvals({status}:{status:CompanionStatus}){
 const [error,setError]=useState(''),[sending,setSending]=useState('');
 const decide=async(id:string,d:'allow'|'deny'|'pass')=>{setSending(id);const r=await window.companion.decide(id,d);if(!r.ok)setError(r.error);setSending('');return r.ok;};
 return <>{status.approvals.length===0&&<div className="companion-empty"><Symbol name="check"/><h2>No hay permisos pendientes</h2><p>Los permisos que Codex envíe a ZEN aparecerán aquí. Los demás se responden en Codex.</p><OpenCodex id={activeSession(status)?.id}/></div>}{status.approvals.map(a=><article className="companion-card approval-card" key={a.id}><span className="eyebrow">SOLICITUD DE CODEX · UNA SOLA VEZ</span><h2>{a.label} · {a.tool}</h2><p>Revisa la acción completa antes de decidir.</p><CodePreview text={a.preview}/><div className="actions"><button className="primary" disabled={sending===a.id} onClick={()=>void decide(a.id,'allow')}>Permitir esta vez</button><button disabled={sending===a.id} onClick={()=>void decide(a.id,'deny')}>Rechazar</button><button disabled={sending===a.id} onClick={async()=>{if(await decide(a.id,'pass'))await window.companion.openCodex(a.session);}}>Revisar en Codex</button></div><small>Caduca a las {new Date(a.expiresAt).toLocaleTimeString('es')}. La respuesta vale solo para esta solicitud.</small></article>)}{error&&<p role="alert">{error}</p>}</>;
}
function Notices({status}:{status:CompanionStatus}){
 return <>{status.notices.length>0&&<button onClick={()=>void window.companion.clearNotices()}>Limpiar avisos</button>}{status.notices.length===0?<div className="companion-empty"><Symbol name="bell"/><h2>Todo al día</h2><p>Aquí verás los turnos terminados, permisos y errores observados.</p></div>:status.notices.map(n=><article className="companion-card notice-card" key={n.id}><Symbol name="bell"/><div><h2>{n.title}</h2><small>{new Date(n.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</small></div><OpenCodex id={n.session}/></article>)}</>;
}
export function CodexCompanion(){const view=new URLSearchParams(location.search).get('view')??'capsule';if(view==='capsule')return <Capsule/>;return <Panel view={view}/>;}
function Panel({view}:{view:string}){
 const {status}=useCompanion();
 return <main className="companion-panel"><header><span className="eyebrow">ZEN / CODEX</span><h1>{{activity:'Actividad',approvals:'Permisos',notices:'Avisos',settings:'Preferencias'}[view]??'ZEN'}</h1></header>{view==='settings'?<Settings status={status}/>:view==='approvals'?<Approvals status={status}/>:view==='notices'?<Notices status={status}/>:<Activity status={status}/>}</main>;
}
