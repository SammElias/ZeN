import React, {useLayoutEffect, useRef, useState} from 'react';
import type {CompanionSession, CompanionStatus} from '../shared/codex-companion';
import {codexTabs, type CodexTab} from '../shared/companion-navigation';
import {activeSession, completionDetail, currentChat, phaseNames as names} from '../shared/companion-presentation';
import {CodexContext,type ContextDraft} from './CodexContext';
import {CompanionIcon, Connection, OpenCodex} from './CompanionActions';
import {CopyVisible, SearchField, searchText} from './WorkspaceTools';
import {MarkdownPreview as CodexReplyText} from './MarkdownPreview';
import './CodexActivity.css';

function CodePreview({text}:{text:string}){
 const [notice,setNotice]=useState(''),lines=text.split('\n');
 return <div className="code-preview"><div><span>Código / acción</span><button onClick={async()=>{const r=await window.companion.copy(text);setNotice(r.ok?'Copiado':r.error);}}>{notice||'Copiar'}</button></div><pre>{lines.map((line,index)=><span className={line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':line.startsWith('@@')||line.startsWith('***')?'diff-header':''} key={index}>{line}{index<lines.length-1?'\n':''}</span>)}</pre></div>;
}

function Completion({session,full=false}:{session:CompanionSession;full?:boolean}){
 const [error,setError]=useState('');const detail=completionDetail(session),summary=session.summary;
 return detail?<><div className="completion-card"><CompanionIcon name="check"/><div><strong>Turno terminado</strong><small>{detail}</small>{summary?.state==='ready'&&<small>{summary.files.length+summary.omitted} archivos con cambios detectados</small>}</div></div>{full&&summary?.state==='ready'&&<div className="completion-details"><ul className="changed-files">{summary.files.map(f=><li key={f.path}><span><b>{{added:'Nuevo',changed:'Modificado',removed:'Eliminado'}[f.change]}</b>{f.path}</span><button onClick={async()=>{const r=await window.companion.locate(session.id,f.path);setError(r.ok?'':r.error);}}>Abrir ubicación</button></li>)}</ul>{summary.omitted>0&&<small>Y {summary.omitted} archivos más · Ver en Codex</small>}{error&&<small role="alert">{error}</small>}</div>}</>:null;
}

const tabNames = {activity: 'Actividad', summary: 'Resumen'} satisfies Record<CodexTab, string>;

export function CodexWorkspace({status, monochrome, visible, memory}: {status: CompanionStatus; monochrome: boolean; visible:boolean;memory:{current?:ContextDraft}}) {
 const root = useRef<HTMLElement>(null);
 const permissions = status.workspace?.page === 'permissions';
 const tab = permissions ? 'activity' : status.workspace?.codexTab ?? 'activity';
 const [error, setError] = useState('');
 const [observedId,setObservedId]=useState<string>();

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
   {tab === 'summary' ? <CodexSummary status={status} visible={visible} memory={memory}/>
    : permissions ? <>
     <button className="codex-back-activity" onClick={() => select('activity')}>← Actividad</button>
     {visible&&<Approvals status={status}/>}
    </> : <Activity status={status} observedId={observedId} selectChat={setObservedId}/>}
  </div>
 </section>;
}

const activityTime=new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit'});
const inProgress=(session:CompanionSession)=>session.state==='working'||session.state==='thinking';
const projectName=(session:CompanionSession)=>session.cwd.split(/[\\/]/).filter(Boolean).at(-1);

function Activity({status,observedId,selectChat}:{status:CompanionStatus;observedId?:string;selectChat:(id:string)=>void}){
 const [picker,setPicker]=useState(false),[chatQuery,setChatQuery]=useState('');
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all');
 const sessions=status.activitySessions??[];
 const groups=[
  {name:'Necesitan permiso',items:sessions.filter(session=>session.state==='approval')},
  {name:'En curso',items:sessions.filter(inProgress)},
  {name:'Recientes',items:sessions.filter(session=>session.state!=='approval'&&!inProgress(session))},
 ];
 const selected=sessions.find(session=>session.id===observedId)??groups.find(group=>group.items.length)?.items[0];
 const selectedId=selected?.id;
 useLayoutEffect(()=>{if(selectedId&&selectedId!==observedId)selectChat(selectedId);},[observedId,selectedId,selectChat]);
 const currentStep=selected?.steps.at(-1);
 const activitySearch=searchText(query),chatSearch=searchText(chatQuery);
 const steps=selected?.steps.filter(step=>(kind==='all'||step.kind===kind)&&
  searchText([step.label,step.tool,step.preview].join(' ')).includes(activitySearch)).reverse()??[];
 const approval=status.approvals.some(item=>item.session===selectedId);
 const observedAt=sessions[0]?.at??status.lastEventAt;
 const count=groups[1].items.length;
 const pickerLabel=count?`Chats · ${count} en curso`:'Chats';
 return <div className="codex-monitor">
  <div className="codex-monitor-connection">
   <Connection status={{...status,lastEventAt:observedAt}}/>
   {status.approvals.length>0&&<button className="codex-permissions" onClick={()=>void window.companion.navigate('permissions')}>Permisos · {status.approvals.length}</button>}
  </div>
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  {selected?<div className="codex-monitor-grid">
   <aside aria-label="Chats observados" className="codex-chat-list">
    <h2>{pickerLabel}</h2>
    <button type="button" className="codex-chat-toggle" aria-expanded={picker} aria-controls="codex-chat-picker" onClick={()=>setPicker(value=>!value)}><span>{pickerLabel}</span><span>{picker?'−':'+'}</span></button>
    <div id="codex-chat-picker" className="codex-chat-picker" data-open={picker}>
     {(sessions.length>6||chatQuery)&&<SearchField value={chatQuery} onChange={setChatQuery} label="Buscar chat" placeholder="Buscar chat…"/>}
     {groups.map(group=>{
      const items=group.items.filter(session=>searchText(`${session.label} ${projectName(session)??''}`).includes(chatSearch));
      return items.length>0&&<section className="codex-chat-group" key={group.name} aria-label={group.name}>
       <h3>{group.name}</h3>
       {items.map(session=><button type="button" key={session.id} data-chat-id={session.id} className="codex-chat-row" aria-pressed={selectedId===session.id}
        onClick={()=>{selectChat(session.id);setPicker(false);setQuery('');setKind('all');}}>
        <span className="codex-chat-dot" data-state={session.state} aria-hidden="true"/>
        <span className="codex-chat-copy"><strong title={session.label}>{session.label}</strong><small>{names[session.state]}</small></span>
       </button>)}
      </section>;
     })}
     {chatSearch&&!sessions.some(session=>searchText(`${session.label} ${projectName(session)??''}`).includes(chatSearch))&&<p>No hay chats que coincidan.</p>}
    </div>
   </aside>
   <article className="codex-chat-detail" key={selected.id}>
    <header className="codex-chat-header">
     <div><h2>{selected.label}</h2>{projectName(selected)&&projectName(selected)!==selected.label&&<small>{projectName(selected)}</small>}</div>
     <div className="codex-monitor-actions"><OpenCodex id={selected.id}>{selected.state==='approval'&&!approval?'Revisar en Codex':'Abrir en Codex'}</OpenCodex></div>
    </header>
    <div className="codex-chat-current"><span className="codex-chat-dot" data-state={selected.state} aria-hidden="true"/>
     <span>{selected.state==='working'&&currentStep?currentStep.label:names[selected.state]}</span>
     {selected.at>0&&<time dateTime={new Date(selected.at).toISOString()}>{activityTime.format(selected.at)}</time>}
    </div>
    {selected.steps.length>0&&<details className="codex-activity-filters"><summary>Filtros{kind!=='all'||query.trim()?' · activos':''}</summary>
     <div><SearchField value={query} onChange={setQuery} label="Buscar acciones" placeholder="Buscar acción…"/>
      <select aria-label="Tipo de actividad" value={kind} onChange={event=>setKind(event.target.value)}><option value="all">Todas las acciones</option><option value="command">Comandos</option><option value="file">Archivos</option></select>
     </div>
    </details>}
    <ol className="codex-chat-timeline" aria-label="Cronología del chat">{steps.map(step=><li key={step.id}>
     <time dateTime={new Date(step.at).toISOString()}>{activityTime.format(step.at)}</time>
     {step.tool||step.preview?<details><summary>{step.label}</summary>{step.tool&&<code>{step.tool}</code>}{step.preview&&<CodePreview text={step.preview}/>}</details>:<span>{step.label}</span>}
    </li>)}</ol>
    {!steps.length&&<p>{selected.steps.length?'No hay acciones que coincidan.':'Aún no hay acciones observadas para este chat.'}</p>}
   </article>
  </div>:<div className="companion-empty"><CompanionIcon name="code"/><h2>{status.settings.presentation?'Actividad oculta en Presentación':status.settings.paused?'Seguimiento en pausa':'Esperando actividad de Codex'}</h2></div>}
 </div>;
}
function CodexSummary({status,visible,memory}:{status:CompanionStatus;visible:boolean;memory:{current?:ContextDraft}}){
 const current=activeSession(status),session=status.target?current:undefined,reply=!status.settings.presentation&&!status.settings.paused?session?.lastReply:undefined;
 const privateMode=status.settings.paused||status.settings.presentation;
 return <>
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  <CodexContext key={privateMode?'private':JSON.stringify([status.target?.session,status.target?.cwd,status.targetError])} disabled={privateMode} visible={visible} memory={memory} targetTitle={status.targetError?undefined:status.target?.title}>
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
