import React, {useLayoutEffect, useState} from 'react';
import type {CompanionApproval, CompanionSession, CompanionStatus} from '../shared/codex-companion';
import {phaseNames as names,toolActivity} from '../shared/companion-presentation';
import {CodexContext,type ContextDraft} from './CodexContext';
import {CompanionIcon, Connection, OpenCodex, useClock} from './CompanionActions';
import {SearchField, searchText} from './WorkspaceTools';
import './CodexActivity.css';

const activityTime=new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit'});

function CodePreview({text,label='Código / acción',review}:{text:string;label?:string;review?:{chat:string;expiresAt:number}}){
 const [notice,setNotice]=useState('');
 const copy=async()=>{
  const result=await window.companion.copy(text);
  setNotice(result.ok?'Copiado':result.error);
 };
 if(review)return <div className="code-preview codex-review-preview">
  <div className="codex-review-meta">
   <p className="codex-review-chat codex-review-title" title={review.chat}>{permissionChatTitle(review.chat)}</p>
   <details className="codex-review-details">
    <summary>Detalles</summary>
    <div><time dateTime={new Date(review.expiresAt).toISOString()}>Caduca {activityTime.format(review.expiresAt)}</time><button type="button" aria-label="Copiar solicitud completa" onClick={()=>void copy()}>{notice||'Copiar'}</button></div>
   </details>
  </div>
  <pre tabIndex={0} aria-label={label}>{text}</pre>
 </div>;
 const lines=text.split('\n');
 return <div className="code-preview"><div><span>{label}</span><button type="button" onClick={()=>void copy()}>{notice||'Copiar'}</button></div><pre tabIndex={0} aria-label={label}>{lines.map((line,index)=><span className={line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':line.startsWith('@@')||line.startsWith('***')?'diff-header':''} key={index}>{line}{index<lines.length-1?'\n':''}</span>)}</pre></div>;
}

export function CodexWorkspace({status,visible,memory,onCloseReview}:{status:CompanionStatus;visible:boolean;memory:{current?:ContextDraft};onCloseReview:()=>void}){
 const reviewing=status.workspace?.page==='permissions';
 return <section className="codex-page" data-reviewing={reviewing}>
  {reviewing?(visible&&<ApprovalReview status={status} onClose={onCloseReview}/>):<div className="workspace-section-heading"><h1>Actividad de Codex</h1></div>}
  <Activity status={status} visible={visible&&!reviewing} memory={memory}/>
 </section>;
}

const inProgress=(session:CompanionSession)=>session.state==='working'||session.state==='thinking';
const projectName=(session:CompanionSession)=>session.cwd.split(/[\\/]/).filter(Boolean).at(-1);

function Activity({status,visible,memory}:{status:CompanionStatus;visible:boolean;memory:{current?:ContextDraft}}){
 const [observedId,selectChat]=useState<string>();
 const [picker,setPicker]=useState(false),[chatQuery,setChatQuery]=useState('');
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all');
 const [analysisOpen,setAnalysisOpen]=useState(false);
 const sessions=visible?status.activitySessions??[]:[];
 const needsApproval=(session:CompanionSession)=>session.state==='approval'||status.approvals.some(a=>a.session===session.id);
 const groups=[
  {name:'Necesitan permiso',items:sessions.filter(needsApproval)},
  {name:'En curso',items:sessions.filter(session=>!needsApproval(session)&&inProgress(session))},
  {name:'Recientes',items:sessions.filter(session=>!needsApproval(session)&&!inProgress(session))},
 ];
 const selected=sessions.find(session=>session.id===observedId)??groups.find(group=>group.items.length)?.items[0];
 const selectedId=selected?.id;
 useLayoutEffect(()=>{
  if(selectedId&&selectedId!==observedId)selectChat(selectedId);
 },[observedId,selectedId]);
 if(!visible)return null;
 const currentStep=selected?.steps.at(-1);
 const activitySearch=searchText(query),chatSearch=searchText(chatQuery);
 const steps=selected?.steps.filter(step=>(kind==='all'||step.kind===kind)&&
  searchText([step.label,step.tool,step.preview].join(' ')).includes(activitySearch)).reverse()??[];
 const approvals=status.approvals.filter(item=>item.session===selectedId&&item.preview);
 const permissionCount=status.approvalCount??status.approvals.length;
 const canAnalyze=!status.targetError&&!status.settings.presentation&&!status.settings.paused&&Boolean(status.target);
 const observedAt=sessions[0]?.at??status.lastEventAt;
 const count=groups[1].items.length;
 const pickerLabel=count?`Chats · ${count} en curso`:'Chats';
 return <div className="codex-monitor">
  <div className="codex-monitor-connection">
   <Connection status={{...status,lastEventAt:observedAt}}/>
   {permissionCount>0&&<button type="button" className="codex-permissions" onClick={()=>void window.companion.navigate('permissions')}>Permisos · {permissionCount}</button>}
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
     <div className="codex-monitor-actions"><OpenCodex id={selected.id}>{needsApproval(selected)&&!approvals.length?'Revisar permiso en Codex':'Abrir en Codex'}</OpenCodex></div>
    </header>
    <div className="codex-chat-current"><span className="codex-chat-dot" data-state={needsApproval(selected)?'approval':selected.state} aria-hidden="true"/>
     <span>{needsApproval(selected)?names.approval:selected.state==='working'&&currentStep?currentStep.label:names[selected.state]}</span>
     {selected.at>0&&<time dateTime={new Date(selected.at).toISOString()}>{activityTime.format(selected.at)}</time>}
    </div>
    {approvals.map(approval=><ApprovalCard key={approval.id} approval={approval}/>)}
    {selected.steps.length>0&&<details className="codex-activity-filters"><summary>Filtros{kind!=='all'||query.trim()?' · activos':''}</summary>
     <div><SearchField value={query} onChange={setQuery} label="Buscar acciones" placeholder="Buscar acción…"/>
      <select aria-label="Tipo de actividad" value={kind} onChange={event=>setKind(event.target.value)}><option value="all">Todas las acciones</option><option value="command">Comandos</option><option value="file">Archivos</option></select>
     </div>
    </details>}
    <ol className="codex-chat-timeline" aria-label="Cronología del chat">{steps.map(step=><li key={step.id}>
     <time dateTime={new Date(step.at).toISOString()}>{activityTime.format(step.at)}</time>
     {step.tool||step.preview?<details><summary><span>{step.label}</span>{step.preview&&<code className="codex-command-line">{step.preview.trimStart().split(/\r?\n/,1)[0]}</code>}</summary>{step.tool&&<code>{step.tool}</code>}{step.preview&&<CodePreview text={step.preview}/>}</details>:<span>{step.label}</span>}
    </li>)}</ol>
    {!steps.length&&<p>{selected.steps.length?'No hay acciones que coincidan.':'Aún no hay acciones observadas para este chat.'}</p>}
   </article>
  </div>:<div className="companion-empty"><CompanionIcon name="code"/><h2>{status.settings.presentation?'Actividad oculta en Presentación':status.settings.paused?'Seguimiento en pausa':'Esperando actividad de Codex'}</h2></div>}
  {canAnalyze&&<details className="codex-analysis" open={analysisOpen} onToggle={event=>setAnalysisOpen(event.currentTarget.open)}>
   <summary>Peticiones y resultados del chat fijado</summary>
   {analysisOpen&&<CodexContext disabled={false} visible={visible} memory={memory} targetTitle={status.target?.title}><p>Los resultados de análisis aparecerán aquí.</p></CodexContext>}
  </details>}
 </div>;
}
function ApprovalDeadline({expiresAt}:{expiresAt:number}){
 const seconds=Math.ceil((expiresAt-useClock())/1000);
 if(seconds<1||seconds>20)return null;
 return <span className="codex-review-deadline" aria-label={`Vence en ${seconds} segundos`}>Vence en {seconds} s</span>;
}

function ApprovalReview({status,onClose}:{status:CompanionStatus;onClose:()=>void}){
 const [selection,select]=useState('');
 const blocked=status.settings.presentation||status.settings.paused;
 const approvals=blocked?[]:status.approvals.filter(item=>item.preview).sort((a,b)=>a.expiresAt-b.expiresAt);
 const count=status.approvalCount??approvals.length;
 const inCodex=!blocked&&count>approvals.length?(status.activitySessions??[]).filter(chat=>chat.state==='approval'&&!approvals.some(item=>item.session===chat.id)):[];
 const choices=[...approvals.map(approval=>({id:approval.id,title:approval.label,approval})),...inCodex.map(chat=>({id:`codex-${chat.id}`,title:chat.label,chat}))];
 const selected=choices.find(choice=>choice.id===selection)??choices[0];
 const approval=selected&&'approval' in selected?selected.approval:undefined;
 const title=approval&&toolActivity(approval.tool).kind==='command'?'Aprobar comando de Codex':'Permisos de Codex';
 return <>
  <header className="codex-review-heading">
   <span className="codex-review-mark" aria-hidden="true" data-pending={!!count&&!blocked}/>
   <h1>{title}</h1>
   {approval&&<ApprovalDeadline expiresAt={approval.expiresAt}/>}
   <button type="button" aria-label="Cerrar revisión" title="Cerrar revisión" onClick={onClose}><CompanionIcon name="close"/></button>
  </header>
  {blocked||!count?<p className="codex-review-empty" role="status">{status.settings.presentation?'Permisos ocultos en Presentación.':status.settings.paused?'Seguimiento en pausa.':'Sin permisos pendientes.'}</p>:<div className="codex-monitor codex-review">
  {choices.length>1&&<label className="codex-review-selector"><span>{count} solicitudes</span>
   <select aria-label="Solicitud pendiente" value={selected?.id} onChange={event=>select(event.target.value)}>
    {choices.map((choice,index)=><option key={choice.id} value={choice.id}>{index+1}. {permissionChatTitle(choice.title)}</option>)}
   </select>
  </label>}
  {selected?'approval' in selected?<ApprovalCard key={selected.id} approval={selected.approval} showChat/>:
   <article className="codex-review-external" key={selected.id}>
    <div><strong className="codex-review-title" title={selected.title}>{permissionChatTitle(selected.title)}</strong><p>Permiso pendiente en Codex</p></div>
    <OpenCodex id={selected.chat.id}>Abrir en Codex</OpenCodex>
   </article>:
   <p>Hay permisos pendientes que puedes revisar desde Actividad.</p>}
  </div>}
 </>;
}

function permissionChatTitle(label:string){
 const linkedTitle=/^\[(https?:\/\/[^\]]+)\]\(\1\)\s*(.*)$/u.exec(label);
 return linkedTitle?(linkedTitle[2]||linkedTitle[1]):label;
}

function ApprovalCard({approval,showChat=false}:{approval:CompanionApproval;showChat?:boolean}){
 const activity=toolActivity(approval.tool);
 const command=activity.kind==='command';
 const [error,setError]=useState(''),[sending,setSending]=useState(false);
 async function decide(decision:'allow'|'deny'|'pass'){
  setSending(true);setError('');
  try{
   const result=await window.companion.decide(approval.id,decision);
   if(!result.ok)setError(result.error);
  }catch{setError('No se pudo enviar la decisión a Codex.');}
  finally{setSending(false);}
 }
 return <section className="companion-card approval-card codex-inline-approval" aria-label="Solicitud de permiso de Codex">
  <div className="codex-approval-body" tabIndex={showChat?0:undefined} aria-label={showChat?'Detalle de la solicitud':undefined}>
   {!showChat&&<header><strong>{command?'Comando pendiente':activity.label}</strong><small>Caduca {activityTime.format(approval.expiresAt)}</small></header>}
   <CodePreview text={approval.preview} label={command?'Comando':undefined} review={showChat?{chat:approval.label,expiresAt:approval.expiresAt}:undefined}/>
  </div>
  <div className="actions">
   <button className="primary" disabled={sending} onClick={()=>void decide('allow')}>Permitir esta vez</button>
   <button disabled={sending} onClick={()=>void decide('deny')}>Rechazar</button>
   <button type="button" className="codex-review-handoff" disabled={sending} onClick={()=>void decide('pass')}>Abrir en Codex <CompanionIcon name="arrow"/></button>
  </div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
