import {CompanionMusic,CompanionMiniMusic,CompanionNowPlaying,useNowPlaying} from './CompanionMusic';
import type {LauncherPage} from '../shared/companion-workspace';
import {CompanionGmail} from './CompanionGmail';
import {CompanionHome} from './CompanionHome';
import {useHomeMail} from './useHomeMail';
import React,{useEffect,useRef,useState} from 'react';
import {CompanionSettingsSchema,type CompanionStatus,type CompanionSettings,type CompanionSession} from '../shared/codex-companion';
import {activeSession,currentChat,phaseNames as names,connectionLabel,toolActivity,isSilenced,lastSignalLabel,completionDetail} from '../shared/companion-presentation';

import {setLanguage} from '../coucou/i18n/i18n';
import {Sound} from '../coucou/core/sound';
import {CompanionIntegrations,IntegrationIcon} from './CompanionIntegrations';
import {OrbitalMark} from './OrbitalMark';
import {CAPSULE_HEIGHT} from '../shared/island';
setLanguage('es');
const initial:CompanionStatus={settings:CompanionSettingsSchema.parse({}),account:'unchecked',checking:false,integration:'missing',sessions:[],approvals:[],notices:[]};
function useCompanion(){
 const [status,setStatus]=useState(initial),[ready,setReady]=useState(false);
 useEffect(()=>{const update=(v:CompanionStatus)=>{setStatus(old=>(old.revision??-1)>(v.revision??0)?old:v);setReady(true);};const off=window.companion.onStatus(update);void window.companion.status().then(r=>{if(r.ok)update(r.value);});return off;},[]);
 return{status,ready};
}
function useClock(){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{let timer:ReturnType<typeof setInterval>|undefined;const sync=()=>{clearInterval(timer);if(!document.hidden){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),1000);}};sync();document.addEventListener('visibilitychange',sync);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',sync);};},[]);
 return now;
}
function useNoticeSound(status:CompanionStatus,ready:boolean){
 const seen=useRef<Set<string>|null>(null);
 useEffect(()=>{Sound.setEnabled(status.settings.sounds&&!status.settings.presentation&&!status.settings.paused&&!isSilenced(status.settings));Sound.setVolume(.1);if(ready&&status.settings.sounds&&!status.settings.presentation)void Sound.preload();},[ready,status]);
 useEffect(()=>{if(!ready)return;const ids=new Set(status.notices.map(n=>n.id));if(seen.current){const next=status.notices.find(n=>!seen.current!.has(n.id)&&!n.read&&n.audible!==false);if(next&&!document.hidden&&status.settings.sounds&&!status.settings.presentation&&!status.settings.paused&&!isSilenced(status.settings)){Sound.resume();Sound.play(next.kind==='permission'?'approval':next.kind==='error'?'error':'finish');}}seen.current=ids;},[status,ready]);
}
function Symbol({name}:{name:'code'|'bell'|'settings'|'arrow'|'close'|'check'|'sound'|'mute'|'presentation'|'return'}){
 const paths={code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',arrow:'M5 12h14m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4 10-10',sound:'M11 4 6 8H3v8h3l5 4V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',mute:'M11 4 6 8H3v8h3l5 4V4m5 5 6 6m-6 0 6-6',presentation:'M3 4h18v12H3zM8 21l4-5 4 5M12 4V2',return:'M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v2'};
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
function Presentation({status}:{status:CompanionStatus}){return <button className="presentation-toggle" aria-label="Modo presentación" title={status.settings.presentation?'Desactivar presentación':'Ocultar detalles y silenciar avisos para presentar'} aria-pressed={status.settings.presentation} onClick={()=>void window.companion.presentation(!status.settings.presentation)}><Symbol name="presentation"/></button>;}
function ReturnApp({status,compact=false,onError}:{status:CompanionStatus;compact?:boolean;onError?:(error:string)=>void}){
 const [error,setError]=useState('');const label=status.settings.presentation?'Volver a mi aplicación':status.desktop?.name?'Volver a '+status.desktop.name:'Volver a mi aplicación';
 return <><button className="return-app" disabled={!status.desktop?.available} aria-label="Volver a mi aplicación" title={status.desktop?.available?label:'Activa primero una aplicación de trabajo'} onClick={async()=>{const r=await window.companion.returnApp(),message=r.ok?'':r.error;setError(message);onError?.(message);}}><Symbol name="return"/><span>{compact?(status.settings.presentation?'Volver':status.desktop?.name??'Volver'):label}</span></button>{error&&!compact&&<small role="alert">{status.settings.presentation?'No se pudo volver a la aplicación.':error}</small>}</>;
}
function Completion({session,full=false}:{session:CompanionSession;full?:boolean}){
 const [error,setError]=useState('');const detail=completionDetail(session),summary=session.summary;
 return detail?<><div className="completion-card"><Symbol name="check"/><div><strong>Turno terminado</strong><small>{detail}</small>{summary?.state==='ready'&&<small>{summary.files.length+summary.omitted} archivos con cambios detectados</small>}</div><OpenCodex id={session.id}>Ver en Codex</OpenCodex></div>{full&&<div className="completion-details">{summary?.state==='ready'?<><small>Comparación local de metadatos durante el intervalo observado. Puede incluir ediciones externas.</small><ul className="changed-files">{summary.files.map(f=><li key={f.path}><span><b>{{added:'Nuevo',changed:'Modificado',removed:'Eliminado'}[f.change]}</b>{f.path}</span><button onClick={async()=>{const r=await window.companion.locate(session.id,f.path);setError(r.ok?'':r.error);}}>Abrir ubicación</button></li>)}</ul>{summary.omitted>0&&<small>Y {summary.omitted} archivos más. Revisa el detalle en Codex.</small>}</>:<small>Sin comparación de archivos disponible para este turno.</small>}<small>Las acciones y comandos recibidos aparecen abajo. Su finalización no acredita que las pruebas hayan pasado.</small>{error&&<small role="alert">{error}</small>}</div>}</>:null;
}
function RecentSteps({session}:{session:CompanionSession}){
 return <ol className="recent-steps">{session.steps.slice(-3).map(step=><li key={step.id}><span>{step.label}</span><time>{new Date(step.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ol>;
}

function Capsule(){
 const {status,ready}=useCompanion(),[error,setError]=useState(''),[dragged,setDragged]=useState<LauncherPage>(),[reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const {track:nowPlaying}=useNowPlaying(status);
 const homeMail=useHomeMail(status);
 const drag=useRef(false),expanded=status.workspace?.expanded??false,page=status.workspace?.page??'home',launcher=status.workspace?.launcher??false;useNoticeSound(status,ready);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>setReduced(q.matches);q.addEventListener('change',fn);return()=>q.removeEventListener('change',fn);},[]);
 const active=activeSession(status),chat=currentChat(status),phase=status.approvals.length?'approval':active?.state??'idle',state=status.settings.paused?'sleeping':phase==='unknown'||phase==='interrupted'?'idle':phase;
 const unread=status.notices.filter(n=>!n.read).length,label=status.settings.paused?'Avisos en pausa':active?names[phase]:connectionLabel(status);
 const toggle=()=>void window.companion.menu(!expanded);
 const navigate=(v:import('../shared/companion-workspace').WorkspacePage)=>void window.companion.navigate(v).then(r=>{if(!r.ok)setError(r.error);});
 const panel=(v:'activity'|'approvals'|'notices')=>void window.companion.panel(v).then(r=>{if(!r.ok)setError(r.error);});
 const order=status.workspace?.order??['home','spotify','gmail','codex','notices'];
 const reorder=(from:LauncherPage,to:LauncherPage)=>{const next=[...order],a=next.indexOf(from),b=next.indexOf(to);if(a<0||b<0||a===b)return;next.splice(a,1);next.splice(b,0,from);void window.companion.launcherOrder(next).then(r=>{if(!r.ok)setError(r.error);});};
 const context=(v:LauncherPage)=>void window.companion.launcherContext(v).then(r=>{if(!r.ok)setError(r.error);});
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key!=='Escape'||e.defaultPrevented)return;if(expanded){e.preventDefault();void window.companion.menu(false);}else if(launcher){e.preventDefault();void window.companion.launcher(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[expanded,launcher]);

 const navigation=(compact:boolean)=><nav className={compact?'capsule-launcher':'workspace-navigation'} aria-label={compact?'Integraciones':'Navegación de ZEN'}>{order.map(v=>{const selected=page===v||v==='home'&&page==='settings'||v==='codex'&&page==='permissions',mail=v==='gmail'?status.workspace?.gmail:undefined,name={home:'Home',spotify:'Spotify',gmail:'Gmail',codex:'Codex',notices:'Avisos'}[v],description=mail?`${name} · ${mail.unread} sin leer al consultar a las ${new Date(mail.checkedAt).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`:v==='codex'&&status.approvals.length?`Codex · ${status.approvals.length} permiso pendiente`:name;return <button key={v} data-page={v} aria-label={name} aria-expanded={expanded&&selected} aria-controls="capsule-content" title={(expanded&&selected?'Recoger cápsula':'Abrir '+name)+' · '+description+' · clic derecho para acciones · Alt + flechas para ordenar'} aria-current={selected?'page':undefined} aria-pressed={expanded&&selected} data-dragging={dragged===v} draggable onDragStart={e=>{setDragged(v);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-zen-integration',v);}} onDragEnd={()=>setDragged(undefined)} onDragOver={e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{e.preventDefault();const from=e.dataTransfer.getData('application/x-zen-integration') as LauncherPage;if(dragged===from)reorder(from,v);setDragged(undefined);}} onContextMenu={e=>{e.preventDefault();context(v);}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();context(v);}else if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const target=order[order.indexOf(v)+(e.key==='ArrowLeft'?-1:1)];if(target)reorder(v,target);}}} onClick={()=>void window.companion.togglePage(v).then(r=>{if(!r.ok)setError(r.error);})}>{v==='home'?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>:v==='notices'?<Symbol name="bell"/>:<IntegrationIcon name={v}/>}<span>{name}</span>{v==='notices'&&unread>0?<b className="integration-badge">{unread}</b>:v==='codex'&&status.approvals.length>0?<b className="integration-badge permission-badge">{status.approvals.length}</b>:mail&&mail.unread>0&&Date.now()-mail.checkedAt<900000?<b className="integration-badge" aria-label={description}>{mail.unread>99?'99+':mail.unread}</b>:null}</button>;})}</nav>;
 return <main className={'companion-capsule '+(expanded?'expanded companion-shell':'collapsed')} data-state={state} data-motion={status.settings.motion&&!reduced} onPointerDown={e=>{if(e.button!==0||expanded&&!(e.target as HTMLElement).closest('.companion-bar')||(e.target as HTMLElement).closest('button,a,input,select,textarea,label'))return;drag.current=true;e.currentTarget.setPointerCapture(e.pointerId);void window.companion.drag('start');}} onPointerUp={e=>{if(!drag.current)return;drag.current=false;void window.companion.drag('end');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=false;void window.companion.drag('end');}}>
  <header className="companion-bar" data-has-media={!!nowPlaying||!expanded&&status.workspace?.compact==='spotify'&&status.approvals.length===0} style={{'--capsule-header-height':`${CAPSULE_HEIGHT-2}px`} as React.CSSProperties}>
   <button className="companion-brand" aria-label="Opciones de ZEN" title={expanded?'Recoger a cápsula':'Abrir última integración · '+({home:'Home',spotify:'Spotify',gmail:'Gmail',codex:'Codex',notices:'Avisos'}[status.workspace?.last??'home'])} aria-expanded={expanded} onClick={toggle}><OrbitalMark status={status} ready={ready}/></button>
   <button className="companion-state" data-compact={status.workspace?.compact==='codex'} onClick={()=>panel(status.approvals.length?'approvals':'activity')}><strong><i/>{label}</strong><small>{(status.settings.presentation&&error?'Revisa Codex':error)||status.desktop?.error||status.targetError||(status.settings.presentation?'Presentación · detalles ocultos':status.workspace?.compact==='codex'?(active?.steps.at(-1)?.preview?.split('\n')[0]?.slice(0,180)||active?.steps.at(-1)?.label||'Sin acciones recibidas'):status.target?'Fijado · '+status.target.title:active?.label)||'Tu escritorio, a mano'}</small></button>
   {nowPlaying?<CompanionNowPlaying track={nowPlaying}/>:!expanded&&status.workspace?.compact==='spotify'&&status.approvals.length===0?<CompanionMiniMusic status={status}/>:null}
   {navigation(true)}
   <nav aria-label="Controles de la cápsula"><ReturnApp status={status} compact onError={setError}/><button className="integration-launch-toggle" aria-label="Integraciones" title={launcher?'Recoger integraciones':'Mostrar integraciones'} aria-expanded={launcher} onClick={toggle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg></button><button className="capsule-options" aria-label="Opciones" title="Más opciones" aria-controls="capsule-content" aria-expanded={expanded&&page==='options'} onClick={()=>void window.companion.options()}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>{unread>0&&<b className="badge">{unread}</b>}</button><button aria-label="Ocultar ZEN" title="Ocultar ZEN" onClick={()=>void window.companion.hide()}><Symbol name="close"/></button></nav>
  </header>
  {expanded&&<>
   <section id="capsule-content" className="workspace-content" data-page={page}>
    {page==='home'?<><CompanionHome status={status} nowPlaying={nowPlaying} mail={homeMail.mail} mailLoading={homeMail.loading} mailError={homeMail.error} onRefresh={()=>void homeMail.refresh()} onNavigate={navigate}/><div className="workspace-home-status"><Connection status={status}/><Signal status={status}/><Quiet status={status}/></div>{status.approvals.length>0&&<button className="workspace-attention" onClick={()=>navigate('permissions')}><Symbol name="check"/>Revisar {status.approvals.length} permiso pendiente</button>}</>:
    page==='spotify'?<CompanionMusic status={status}/>:
    page==='gmail'?<CompanionGmail status={status}/>:
    page==='notices'?<><div className="workspace-section-heading"><h1>Avisos</h1></div><Notices status={status}/></>:
    page==='options'||page==='shortcuts'?<CapsuleMenu status={status} context={page==='shortcuts'?status.workspace?.context:undefined}/>:
    page==='settings'?<><div className="workspace-section-heading"><h1>Preferencias</h1><button onClick={()=>navigate('home')}>Volver a Home</button></div><Settings status={status}/></>:
    <><div className="workspace-section-heading"><h1>Codex</h1><div className="actions"><button aria-pressed={page==='codex'} onClick={()=>navigate('codex')}>Actividad</button><button aria-pressed={page==='permissions'} onClick={()=>navigate('permissions')}>Permisos{status.approvals.length?' · '+status.approvals.length:''}</button></div></div>{page==='permissions'?<Approvals status={status}/>:<Activity status={status}/>}</>}
   </section>
  </>}
 </main>;
}


function CapsuleMenu({status,context}:{status:CompanionStatus;context?:LauncherPage}){
 const [error,setError]=useState(''),order=status.workspace?.order??['home','spotify','gmail','codex','notices'];
 const run=async(p:Promise<{ok:boolean;error?:string}>)=>{const r=await p;setError(r.ok?'':r.error??'No se pudo completar la acción.');};
 const names={home:'Home',spotify:'Spotify',gmail:'Gmail',codex:'Codex',notices:'Avisos'},last=status.workspace?.last??'home';
 const move=(offset:number)=>{if(!context)return;const next=[...order],index=next.indexOf(context),to=index+offset;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];void run(window.companion.launcherOrder(next));};
 return <section className="capsule-inline-menu" aria-label={context?'Acciones de '+names[context]:'Más opciones'}><h1>{context?names[context]:'Opciones'}</h1><div className="capsule-menu-grid">{context?<>
  <button onClick={()=>void run(window.companion.navigate(context))}>Abrir {names[context]}</button>
  {(context==='spotify'||context==='codex')&&<button onClick={()=>void run(window.companion.compact(context))}>Ver en cápsula</button>}
  {(context==='spotify'||context==='gmail')&&<button disabled={status.settings.presentation} onClick={()=>void run(window.companion.openIntegrationWeb(context))}>Abrir {names[context]} web ↗</button>}
  {context==='codex'&&<><button onClick={()=>void run(window.companion.openCodex())}>Volver al chat fijado</button><button onClick={()=>void run(window.companion.navigate('permissions'))}>Revisar permisos</button></>}
  <button disabled={order.indexOf(context)===0} onClick={()=>move(-1)}>← Mover a la izquierda</button><button disabled={order.indexOf(context)===order.length-1} onClick={()=>move(1)}>Mover a la derecha →</button>
 </>:<>
  <button onClick={()=>void run(window.companion.navigate(last))}>Continuar en {names[last]}</button><button onClick={()=>void run(window.companion.openCodex())}>Volver al chat fijado</button>
  <button onClick={()=>void run(window.companion.navigate('notices'))}><Symbol name="bell"/>Avisos</button>
  <button aria-pressed={status.settings.sounds} onClick={()=>void run(window.companion.sound(!status.settings.sounds))}><Symbol name={status.settings.sounds?'sound':'mute'}/>{status.settings.sounds?'Silenciar sonidos':'Activar sonidos'}</button>
  <button onClick={()=>void run(window.companion.silence(isSilenced(status.settings)?0:30))}>{isSilenced(status.settings)?'Reactivar avisos':'Silenciar avisos 30 min'}</button>
  <button aria-pressed={status.settings.presentation} onClick={()=>void run(window.companion.presentation(!status.settings.presentation))}><Symbol name="presentation"/>Presentación</button>
  <button onClick={()=>void run(window.companion.navigate('settings'))}><Symbol name="settings"/>Preferencias</button>
 </>}</div>{error&&<p role="alert">{error}</p>}</section>;
}
function Settings({status}:{status:CompanionStatus}){
 const [draft,setDraft]=useState<CompanionSettings>(status.settings),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>setDraft(status.settings),[JSON.stringify(status.settings)]);
 const test=async()=>{if(status.settings.presentation){setNotice('Desactiva Presentación para probar avisos.');return;}if(isSilenced(status.settings)){setNotice('Los avisos están silenciados temporalmente. Reactívalos para probar.');return;}if(status.settings.sounds){Sound.setEnabled(true);Sound.setVolume(.1);await Sound.preload();Sound.resume();Sound.play('finish');}const r=await window.companion.testNotice();setNotice(r.ok?'Aviso de prueba enviado. Comprueba el sonido y la notificación.':r.error);};
 return <>
  {status.target&&<div className="companion-card fixed-chat"><span className="eyebrow">SIEMPRE EN EL MISMO CHAT Y PROYECTO</span><h2>{status.target.title}</h2><small>{status.target.cwd}</small><p>La cápsula sigue este chat. Las demás sesiones no cambian su actividad ni sus avisos.</p><OpenCodex id={status.target.session}/></div>}
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  <div className="companion-card connection-diagnosis"><span className="eyebrow">CONEXIÓN CON CODEX</span><dl><dt>Cuenta</dt><dd>{status.account==='chatgpt'?'ChatGPT detectado':status.account==='unchecked'?'Sin comprobar':'Revisar en Codex'}</dd><dt>Integración</dt><dd>{connectionLabel(status)}</dd><dt>Este chat</dt><dd><Signal status={status}/></dd></dl><div className="actions"><button disabled={status.checking} onClick={async()=>{const r=await window.companion.check();if(!r.ok)setNotice(r.error);}}>{status.checking?'Comprobando…':'Comprobar conexión'}</button><Quiet status={status}/></div>{(status.ignoredEvents??0)>0&&<small>Se han descartado {status.ignoredEvents} eventos ajenos al chat o carpeta fijados.</small>}{status.connection?.state==='ready'&&!status.lastEventAt&&<p className="connection-help">Los hooks están revisados, pero todavía no han llegado eventos. Si Codex estaba abierto durante la instalación, sal y vuelve a abrirlo; después continúa el mismo chat. No hace falta reenviar el trabajo.</p>}{status.error&&<p role="alert">{status.error}</p>}{status.account==='missing'&&<p>Inicia sesión en Codex y vuelve a comprobar.</p>}{status.account==='unsupported'&&<p>La sesión comprobada no usa tu cuenta de ChatGPT. Revísala en Codex.</p>}</div>
  <div className="companion-card"><span className="eyebrow">ACTIVIDAD Y PERMISOS</span><h2>{status.connection?.state==='review'?'Falta revisar los hooks':'Enlace local con Codex'}</h2><p>Los hooks comunican acciones, permisos y finales de turno sin consultas al modelo.</p>{status.connection&&status.connection.total>0&&<p>{status.connection.trusted} de {status.connection.total} hooks revisados · {status.connection.enabled} habilitados.</p>}<div className="actions"><button disabled={busy} onClick={async()=>{setBusy(true);const r=await window.companion.install();setNotice(r.ok?'Integración preparada. Revisa los hooks de ZEN con /hooks en Codex CLI.':r.error);setBusy(false);}}>{busy?'Preparando…':status.integration==='missing'?'Preparar integración':'Revisar instalación'}</button><button onClick={async()=>{const r=await window.companion.copy('/hooks');setNotice(r.ok?'Comando copiado. Pégalo en Codex CLI para revisar los hooks de ZEN.':r.error);}}>Copiar /hooks</button></div><small>La primera vez, revisa los hooks de ZEN en Codex CLI con /hooks. ZEN no concede confianza automáticamente. Los permisos de navegación de la extensión se revisan en Codex.</small></div>
  <div className="companion-card"><h2>A tu manera</h2><label>Mostrar cápsula<input value={draft.shortcut} onChange={e=>setDraft({...draft,shortcut:e.target.value})}/></label><label>Volver al chat de Codex<input value={draft.returnShortcut} onChange={e=>setDraft({...draft,returnShortcut:e.target.value})}/></label>{([['motion','Animaciones de estado'],['sounds','Sonidos de aviso'],['notifications','Notificaciones de Windows'],['presentation','Modo presentación: ocultar detalles y silenciar avisos'],['followPointerDisplay','Invocar la cápsula en el monitor del puntero'],['respectFullscreen','Ocultar la cápsula sobre aplicaciones a pantalla completa'],['paused','Pausar recepción y avisos de ZEN']] as const).map(([key,label])=><label className="switch" key={key}><input type="checkbox" checked={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/>{label}</label>)}<div className="actions"><button className="primary" onClick={async()=>{const r=await window.companion.save(draft);setNotice(r.ok?'Preferencias guardadas.':r.error);}}>Guardar</button><button onClick={()=>void test()}>Probar aviso</button></div><small>Pausar ZEN devuelve los permisos pendientes a Codex. Las tareas se detienen desde su chat en Codex.</small></div>
  {notice&&<p role="status">{status.settings.presentation?'Detalles ocultos en Presentación.':notice}</p>}<footer>Incluye código MIT de Coucou · Louis Raillé. Iconos ZEN y tonos originales.</footer>
 </>;
}
function Activity({status}:{status:CompanionStatus}){
 const current=activeSession(status),replySession=status.target?status.sessions.find(s=>s.id===status.target!.session):undefined,reply=!status.settings.presentation&&!status.settings.paused?replySession?.lastReply:undefined;
 return <>
  <div className="activity-summary"><div><Connection status={status}/><Signal status={status}/></div><OpenCodex id={currentChat(status)}/></div>
  {status.target&&<p className="fixed-caption">Chat fijado · {status.target.title}</p>}
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  {reply?<article className="companion-card codex-last-response" aria-label="Última respuesta de Codex"><header><div><span className="eyebrow">ÚLTIMA RESPUESTA</span><h2>Codex</h2><small>{new Date(reply.at).toLocaleString('es')}</small></div><OpenCodex id={replySession?.id}>Abrir Codex</OpenCodex></header><div className="codex-last-response-text">{reply.text}</div>{reply.truncated&&<small>Esta respuesta supera la vista local. Abre Codex para leerla completa.</small>}{current&&['thinking','working'].includes(current.state)&&<small>Codex está trabajando; se muestra su última respuesta final.</small>}</article>:!status.settings.presentation&&!status.settings.paused&&<p className="codex-response-empty">La última respuesta aparecerá aquí cuando esté disponible. Puedes revisar el chat en Codex.</p>}
  {status.sessions.length===0?<div className="companion-empty"><Symbol name="code"/><h2>Esperando actividad de este chat</h2><p>Las acciones aparecerán cuando Codex las comunique. Puedes continuar el chat fijado sin preparar otra petición.</p><OpenCodex/></div>:status.sessions.map(s=><article className={'companion-card session-card '+(s.id===current?.id?'current-session':'')} key={s.id}>
   <div className="session-heading"><h2>{s.label}</h2><span className={'state-'+s.state}>{names[s.state]}</span></div><small>{s.cwd}</small><Completion session={s} full={!status.settings.presentation}/>
   <div className="event-list">{s.steps.map(step=><details key={step.id}><summary>{step.label}<time>{new Date(step.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></summary>{step.preview?<CodePreview text={step.preview}/>:<p>Evento observado en Codex.</p>}</details>)}</div><OpenCodex id={s.id}/>
  </article>)}
 </>;
}
function Approvals({status}:{status:CompanionStatus}){
 const [error,setError]=useState(''),[sending,setSending]=useState('');
 const decide=async(id:string,d:'allow'|'deny'|'pass')=>{setSending(id);const r=await window.companion.decide(id,d);if(!r.ok)setError(r.error);setSending('');return r.ok;};
 return <>{status.approvals.length===0&&<div className="companion-empty"><Symbol name="check"/><h2>No hay permisos pendientes</h2><p>Los permisos que Codex envíe a ZEN aparecerán aquí. Los demás se responden en Codex.</p><OpenCodex id={activeSession(status)?.id}/></div>}{status.approvals.map(a=><article className="companion-card approval-card" key={a.id}><span className="eyebrow">SOLICITUD DE CODEX · UNA SOLA VEZ</span><h2>{a.label} · {a.tool}</h2>{status.settings.presentation?<p>Detalles ocultos por Presentación. Revisa este permiso en Codex.</p>:<><p>Revisa la acción completa antes de decidir.</p><CodePreview text={a.preview}/></>}<div className="actions">{!status.settings.presentation&&<><button className="primary" disabled={sending===a.id} onClick={()=>void decide(a.id,'allow')}>Permitir esta vez</button><button disabled={sending===a.id} onClick={()=>void decide(a.id,'deny')}>Rechazar</button></>}<button disabled={sending===a.id} onClick={async()=>{if(await decide(a.id,'pass'))await window.companion.openCodex(a.session);}}>Revisar en Codex</button></div><small>Caduca a las {new Date(a.expiresAt).toLocaleTimeString('es')}. La respuesta vale solo para esta solicitud.</small></article>)}{error&&<p role="alert">{status.settings.presentation?'Revisa el permiso en Codex.':error}</p>}</>;
}
function Notices({status}:{status:CompanionStatus}){
 return <>{status.notices.length>0&&<button onClick={()=>void window.companion.clearNotices()}>Limpiar avisos</button>}{status.notices.length===0?<div className="companion-empty"><Symbol name="bell"/><h2>Todo al día</h2><p>Aquí verás los turnos terminados, permisos y errores observados.</p></div>:status.notices.map(n=><article className="companion-card notice-card" key={n.id}><Symbol name="bell"/><div><h2>{n.title}</h2><small>{new Date(n.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</small></div><OpenCodex id={n.session}/></article>)}</>;
}
export function CodexCompanion(){const view=new URLSearchParams(location.search).get('view')??'capsule';if(view==='capsule')return <Capsule/>;return <Panel view={view}/>;}
function Panel({view}:{view:string}){
 const {status}=useCompanion();
 return <main className="companion-panel"><header><div className="panel-tools"><ReturnApp status={status}/><Presentation status={status}/></div><span className="eyebrow">{view==='integrations'?'ZEN / TU ESPACIO':'ZEN / CODEX'}</span><h1>{{activity:'Actividad',approvals:'Permisos',notices:'Avisos',settings:'Preferencias',integrations:'Tu espacio'}[view]??'ZEN'}</h1>{status.settings.presentation&&<small>Presentación · detalles ocultos y avisos silenciados</small>}</header>{view==='integrations'?<CompanionIntegrations status={status}/>:view==='settings'?<Settings status={status}/>:view==='approvals'?<Approvals status={status}/>:view==='notices'?<Notices status={status}/>:<Activity status={status}/>}</main>;
}
