import React from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {MediaNowPlaying} from '../shared/companion-media';
import type {GmailSummary} from '../shared/companion-gmail';
import type {WorkspacePage} from '../shared/companion-workspace';
import {activeSession,connectionLabel,phaseNames,toolActivity} from '../shared/companion-presentation';
import './CompanionHome.css';

export type CompanionHomeProps={status:CompanionStatus;nowPlaying:MediaNowPlaying|null;mail:GmailSummary|undefined;mailLoading:boolean;mailError:boolean;onRefresh:()=>void;onNavigate:(page:WorkspacePage)=>void};

function HomeIcon({name}:{name:'music'|'mail'|'work'|'notices'|'settings'|'refresh'|'arrow'}){
 const paths={music:'M9 18V5l11-2v13M9 9l11-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m11-2a3 3 0 1 1-3-3c2 0 3 1 3 3',mail:'M4 5h16v14H4zM4 6l8 7 8-7',work:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20',notices:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',refresh:'M20 4v6h-6M4 20v-6h6M6 7a8 8 0 0 1 13-1l1 4M4 14l1 4a8 8 0 0 0 13-1',arrow:'M5 12h14m-5-5 5 5-5 5'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
const timestamp=(value:number)=>new Date(value).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});

/** Home renders only supplied summaries; providers and refresh lifecycles stay in its parent. */
export function CompanionHome({status,nowPlaying,mail,mailLoading,mailError,onRefresh,onNavigate}:CompanionHomeProps){
 const hidden=status.settings.presentation||status.settings.paused,track=hidden?null:nowPlaying;
 const session=activeSession(status),permission=status.approvals.length>0;
 const phase=permission?'approval':status.settings.paused?'paused':session?.state??'unknown';
 const workState=permission?phaseNames.approval:status.settings.paused?'ZEN en pausa':session?phaseNames[session.state]:connectionLabel(status);
 const workDetail=permission?(hidden?'Revisa la solicitud en Permisos.':status.approvals.length===1?'1 solicitud para revisar':`${status.approvals.length} solicitudes para revisar`):status.settings.paused?'Reanuda la recepción desde Preferencias.':hidden?'Detalles del chat ocultos.':session?.state==='working'&&session.tool?toolActivity(session.tool):session?.state==='finished'?'Último turno finalizado':session?'Estado observado de tu chat':'La actividad recibida de Codex aparecerá aquí.';
 const unread=hidden?[]:status.notices.filter(n=>!n.read);
 const latest=hidden?undefined:status.notices.reduce<(typeof status.notices)[number]|undefined>((last,item)=>!last||item.at>last.at?item:last,undefined);
 const noticeKind=latest?{permission:'Permiso solicitado',finished:'Turno terminado',error:'Error observado'}[latest.kind]:undefined;
 const countKnown=!hidden&&mail?.connected===true&&typeof mail.unread==='number'&&Number.isSafeInteger(mail.unread)&&mail.unread>=0;
 const checked=!hidden&&typeof mail?.checkedAt==='number'&&Number.isFinite(mail.checkedAt)&&mail.checkedAt>0&&mail.checkedAt<=8640000000000000?mail.checkedAt:undefined;
 const stale=countKnown&&(checked===undefined||Date.now()-checked>=900000||checked>Date.now()+60000);
 const disconnected=!hidden&&mail!==undefined&&!mail.connected;
 const mailState=hidden?'Correo oculto':disconnected?'Sin conectar':countKnown?undefined:mailLoading?'Consultando Gmail…':mailError?'No se pudo consultar':'Sin consultar';
 const mailDetail=hidden?'Tus detalles están ocultos.':disconnected?'Vincula tu cuenta de Gmail.':countKnown?'sin leer en Gmail':mailError?'Abre Gmail o vuelve a actualizar.':'Consulta el recuento de tu buzón conectado.';
 const mailNote=hidden?undefined:disconnected?undefined:mailError?'No se pudo actualizar'+(countKnown?' · dato anterior':''):mailLoading?'Actualizando correo…':stale?'Recuento anterior · actualiza para comprobar':countKnown?'Recuento consultado en Gmail':undefined;
 return <section className="home-status" aria-label="Todo a mano">
  <header className="home-status-heading"><div><span className="home-status-eyebrow">TU ESPACIO</span><h1>Todo a mano.</h1><p>Lo que suena, lo que llega y lo que estás haciendo.</p></div><button className="home-status-refresh" disabled={hidden||mailLoading} title="Consultar el recuento de correo sin leer de Gmail" onClick={onRefresh}><HomeIcon name="refresh"/><span>{mailLoading&&!hidden?'Actualizando…':'Actualizar correo'}</span></button></header>
  {hidden&&<p className="home-status-privacy" role="status">{status.settings.presentation?'Presentación activa':'ZEN está en pausa'} · detalles de música, correo y avisos ocultos.</p>}
  <div className="home-status-grid">
   <article className="home-status-card home-status-music" data-home-card="music">
    <header className="home-status-card-heading"><span className="home-status-icon"><HomeIcon name="music"/></span><h2>Tu música</h2>{track?.artwork&&<img className="home-status-artwork" src={track.artwork} alt=""/>}</header>
    <div className="home-status-card-body"><strong className="home-status-value home-song-title" title={track?.title||undefined}>{hidden?'Música oculta':track?track.title||'Multimedia en reproducción':'Sin reproducción'}</strong><p className="home-status-detail">{hidden?'Tus detalles están ocultos.':track?track.artist||'Artista no informado':'Lo que comparta Windows aparecerá aquí.'}</p>{track&&<small className="home-status-source">{track.source}{track.browser?' · navegador':''}</small>}</div>
    <button className="home-status-action" onClick={()=>onNavigate('spotify')}>Abrir reproductor<HomeIcon name="arrow"/></button>
   </article>
   <article className="home-status-card home-status-mail" data-home-card="mail" data-stale={stale||undefined} aria-busy={mailLoading&&!hidden}>
    <header className="home-status-card-heading"><span className="home-status-icon"><HomeIcon name="mail"/></span><h2>Tu correo</h2></header>
    <div className="home-status-card-body" aria-live="polite">{countKnown?<strong className="home-status-value home-mail-count">{mail!.unread}</strong>:<strong className="home-status-value">{mailState}</strong>}<p className="home-status-detail">{mailDetail}</p>{mailNote&&<small className={'home-status-mail-note'+(mailError?' home-status-error':'')}>{mailNote}</small>}{checked&&!disconnected&&<time className="home-status-time" dateTime={new Date(checked).toISOString()}>Última consulta · {timestamp(checked)}</time>}</div>
    <button className="home-status-action" onClick={()=>onNavigate('gmail')}>{disconnected?'Conectar Gmail':'Abrir Gmail'}<HomeIcon name="arrow"/></button>
   </article>
   <article className="home-status-card home-status-work" data-home-card="work" data-phase={phase}>
    <header className="home-status-card-heading"><span className="home-status-icon"><HomeIcon name="work"/></span><h2>Tu trabajo</h2><span className="home-status-state-dot" aria-hidden="true"/></header>
    <div className="home-status-card-body"><strong className="home-status-value home-work-state">{workState}</strong><p className="home-status-detail">{workDetail}</p>{!hidden&&session&&<small className="home-status-source">{status.target?'Chat fijado en Codex':'Sesión observada de Codex'}</small>}</div>
    <button className="home-status-action" onClick={()=>onNavigate(permission?'permissions':'codex')}>{permission?'Revisar permisos':'Ver actividad'}<HomeIcon name="arrow"/></button>
   </article>
   <article className="home-status-card home-status-notices" data-home-card="notices">
    <header className="home-status-card-heading"><span className="home-status-icon"><HomeIcon name="notices"/></span><h2>Avisos</h2></header>
    <div className="home-status-card-body">{hidden?<strong className="home-status-value">Avisos ocultos</strong>:<strong className="home-status-value home-notice-count">{unread.length}</strong>}<p className="home-status-detail">{hidden?'Tus detalles están ocultos.':unread.length===1?'aviso pendiente':'avisos pendientes'}</p>{noticeKind&&<small className="home-status-source">Último · {noticeKind}</small>}</div>
    <button className="home-status-action" onClick={()=>onNavigate('notices')}>Ver avisos<HomeIcon name="arrow"/></button>
   </article>
  </div>
  <button className="home-status-settings" onClick={()=>onNavigate('settings')}><span className="home-status-icon"><HomeIcon name="settings"/></span><span><strong>A tu manera</strong><small>Preferencias y conexiones</small></span><HomeIcon name="arrow"/></button>
 </section>;
}
