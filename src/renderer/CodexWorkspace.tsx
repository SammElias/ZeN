import React, {useLayoutEffect, useRef, useState} from 'react';
import type {CompanionSession, CompanionStatus} from '../shared/codex-companion';
import {codexTabs, type CodexTab} from '../shared/companion-navigation';
import {activeSession, completionDetail, currentChat, phaseNames as names} from '../shared/companion-presentation';
import {CodexContext} from './CodexContext';
import {CompanionIcon, Connection, OpenCodex, Signal} from './CompanionActions';
import {CopyVisible, SearchField, Segments, searchText} from './WorkspaceTools';
import {MarkdownPreview as CodexReplyText} from './MarkdownPreview';

function CodePreview({text}:{text:string}){
 const [notice,setNotice]=useState(''),lines=text.split('\n');
 return <div className="code-preview"><div><span>Código / acción</span><button onClick={async()=>{const r=await window.companion.copy(text);setNotice(r.ok?'Copiado':r.error);}}>{notice||'Copiar'}</button></div><pre>{lines.map((line,index)=><span className={line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':line.startsWith('@@')||line.startsWith('***')?'diff-header':''} key={index}>{line}{index<lines.length-1?'\n':''}</span>)}</pre></div>;
}

function Completion({session,full=false}:{session:CompanionSession;full?:boolean}){
 const [error,setError]=useState('');const detail=completionDetail(session),summary=session.summary;
 return detail?<><div className="completion-card"><CompanionIcon name="check"/><div><strong>Turno terminado</strong><small>{detail}</small>{summary?.state==='ready'&&<small>{summary.files.length+summary.omitted} archivos con cambios detectados</small>}</div></div>{full&&summary?.state==='ready'&&<div className="completion-details"><ul className="changed-files">{summary.files.map(f=><li key={f.path}><span><b>{{added:'Nuevo',changed:'Modificado',removed:'Eliminado'}[f.change]}</b>{f.path}</span><button onClick={async()=>{const r=await window.companion.locate(session.id,f.path);setError(r.ok?'':r.error);}}>Abrir ubicación</button></li>)}</ul>{summary.omitted>0&&<small>Y {summary.omitted} archivos más · Ver en Codex</small>}{error&&<small role="alert">{error}</small>}</div>}</>:null;
}

const tabNames = {activity: 'Actividad', summary: 'Resumen'} satisfies Record<CodexTab, string>;

export function CodexWorkspace({status, monochrome}: {status: CompanionStatus; monochrome: boolean}) {
 const root = useRef<HTMLElement>(null);
 const permissions = status.workspace?.page === 'permissions';
 const tab = permissions ? 'activity' : status.workspace?.codexTab ?? 'activity';
 const [error, setError] = useState('');

 useLayoutEffect(() => {
  const container = root.current?.closest('.workspace-content');
  if (container) container.scrollTop = 0;
 }, [tab, permissions]);

 function select(value: CodexTab) {
  void window.companion.codexTab(value).then(result => setError(result.ok ? '' : result.error));
 }

 return <section className="codex-page" ref={root}>
  <div className="workspace-section-heading">
   <h1>Codex</h1>
   <div className="codex-subnav" role="tablist" aria-label="Vistas de Codex">
    {codexTabs.map((value, index, tabs) => <button key={value}
     id={'codex-tab-' + value} data-codex-tab={value} role="tab" aria-selected={tab === value}
     aria-controls={'codex-panel-' + value} tabIndex={tab === value ? 0 : -1} onClick={() => select(value)}
     onKeyDown={event => {
      let next: CodexTab | undefined;
      if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs.at(-1);
      else if (event.key === 'ArrowLeft' || (monochrome && event.key === 'ArrowUp')) next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'ArrowRight' || (monochrome && event.key === 'ArrowDown')) next = tabs[(index + 1) % tabs.length];
      if (!next) return;
      event.preventDefault();
      select(next);
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[data-codex-tab="' + next + '"]')?.focus();
     }}>
     {monochrome && <CompanionIcon name={value==='activity' ? 'code' : 'check'}/>}
     {tabNames[value]}
     {value === 'activity' && status.approvals.length > 0 && <span className="codex-permission-count">{status.approvals.length}</span>}
    </button>)}
   </div>
  </div>
  <div role="tabpanel" id={'codex-panel-' + tab} aria-labelledby={'codex-tab-' + tab} tabIndex={0}>
   {monochrome && <h2 className="codex-pane-title">{permissions ? 'Permisos' : tabNames[tab]}</h2>}
   {error && <p role="alert">{error}</p>}
   {tab === 'summary' ? <CodexSummary status={status}/>
    : permissions ? <>
     <button className="codex-back-activity" onClick={() => select('activity')}>← Actividad</button>
     <Approvals status={status}/>
    </> : <Activity status={status}/>}
  </div>
 </section>;
}

function Activity({status}:{status:CompanionStatus}){
 const current=activeSession(status);
 const [query,setQuery]=useState(''),[kind,setKind]=useState<'all'|'commands'|'files'>('all'),[recent,setRecent]=useState(true),[expanded,setExpanded]=useState(false);
 const search = searchText(query);
 const activityKind = kind==='commands' ? 'command' : kind==='files' ? 'file' : undefined;
 const sessions = status.sessions.map(session => ({
  session,
  steps: session.steps.filter(step => (!activityKind || step.kind === activityKind) &&
   searchText(step.label+' '+(step.preview??'')).includes(search))
   .sort((a,b)=>recent?b.at-a.at:a.at-b.at),
 }));
 const total=sessions.reduce((n,{session})=>n+session.steps.length,0),shown=sessions.reduce((n,{steps})=>n+steps.length,0);
 return <>
  <div className="activity-summary"><div><Connection status={status}/><Signal status={status}/></div><div className="actions"><button className="codex-permissions" onClick={()=>void window.companion.navigate('permissions')}>Permisos{status.approvals.length?' · '+status.approvals.length:''}</button><OpenCodex id={currentChat(status)}/></div></div>
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  {status.sessions.length>0&&<div className="view-toolbar activity-tools"><SearchField value={query} onChange={setQuery} label="Buscar actividad" placeholder="Buscar acción o comando…"/><Segments label="Tipo de actividad" value={kind} onChange={setKind} items={[{value:'all',label:'Todo'},{value:'commands',label:'Comandos'},{value:'files',label:'Archivos'}]}/><button aria-pressed={recent} onClick={()=>setRecent(v=>!v)}>{recent?'Recientes primero':'Antiguos primero'}</button><button aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Plegar detalles':'Ver detalles'}</button><small className="view-count">{shown} / {total}</small></div>}
  {total>0&&shown===0&&<p className="view-empty">No hay acciones que coincidan. Cambia el filtro o la búsqueda.</p>}
  {status.sessions.length===0?<div className="companion-empty"><CompanionIcon name="code"/><h2>Esperando actividad de este chat</h2></div>:sessions.map(({session:s,steps})=><article className={'companion-card session-card '+(s.id===current?.id?'current-session':'')} key={s.id}>
   <div className="session-heading"><h2>{s.label}</h2><span className={'state-'+s.state}>{names[s.state]}</span></div><small>{s.cwd}</small>
   <div className="event-list">{steps.map(step=><details key={step.id+String(expanded)} open={expanded}><summary>{step.label}<time>{new Date(step.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></summary>{step.preview?<CodePreview text={step.preview}/>:<small>Sin detalles adicionales</small>}</details>)}</div>
  </article>)}
 </>;
}
function CodexSummary({status}:{status:CompanionStatus}){
 const current=activeSession(status),session=status.target?current:undefined,reply=!status.settings.presentation&&!status.settings.paused?session?.lastReply:undefined;
 const privateMode=status.settings.paused||status.settings.presentation;
 return <>
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  <CodexContext key={privateMode?'private':JSON.stringify([status.target?.session,status.target?.cwd,status.targetError])} disabled={privateMode} targetTitle={status.targetError?undefined:status.target?.title}>
  {reply?<article className="companion-card codex-last-response" aria-label="Última respuesta de Codex"><header><div><h2>Última respuesta</h2><small>{new Date(reply.at).toLocaleString('es')}</small></div><div className="actions"><OpenCodex id={session?.id}>Abrir Codex</OpenCodex><CopyVisible text={reply.text} label="Copiar respuesta"/></div></header><CodexReplyText className="codex-last-response-text" text={reply.text}/>{reply.truncated&&<small>Abre Codex para leer la respuesta completa.</small>}</article>:<div className="companion-empty codex-summary-empty"><h2>{status.settings.presentation||status.settings.paused?'Contenido oculto':'Todavía no hay una respuesta'}</h2><OpenCodex id={currentChat(status)}/></div>}
  </CodexContext>
  {current?.state==='finished'&&<section className="companion-card codex-turn-summary" aria-label="Resumen del turno"><h2>Resumen del turno</h2><Completion session={current} full={!status.settings.presentation}/></section>}
 </>;
}
function Approvals({status}:{status:CompanionStatus}){
 const [error,setError]=useState(''),[sending,setSending]=useState('');
 const decide=async(id:string,d:'allow'|'deny'|'pass')=>{setSending(id);const r=await window.companion.decide(id,d);if(!r.ok)setError(r.error);setSending('');return r.ok;};
 return <>{status.approvals.length===0&&<div className="companion-empty"><CompanionIcon name="check"/><h2>No hay permisos pendientes</h2><OpenCodex id={activeSession(status)?.id}/></div>}{status.approvals.map(a=><article className="companion-card approval-card" key={a.id}><span className="eyebrow">SOLICITUD DE CODEX · UNA SOLA VEZ</span><h2>{a.label} · {a.tool}</h2>{status.settings.presentation?<p>Detalles ocultos por Presentación. Revisa este permiso en Codex.</p>:<><CodePreview text={a.preview}/></>}<div className="actions">{!status.settings.presentation&&<><button className="primary" disabled={sending===a.id} onClick={()=>void decide(a.id,'allow')}>Permitir esta vez</button><button disabled={sending===a.id} onClick={()=>void decide(a.id,'deny')}>Rechazar</button></>}<button disabled={sending===a.id} onClick={async()=>{if(await decide(a.id,'pass'))await window.companion.openCodex(a.session);}}>Revisar en Codex</button></div><small>Caduca a las {new Date(a.expiresAt).toLocaleTimeString('es')}. La respuesta vale solo para esta solicitud.</small></article>)}{error&&<p role="alert">{status.settings.presentation?'Revisa el permiso en Codex.':error}</p>}</>;
}
