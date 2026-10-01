import React, { useState } from 'react';
import type { ProjectBundle, ProjectDraft, WorkContext } from '../shared/project';
export function ContextFlow({context,focused,toggle}:{context:WorkContext;focused:boolean;toggle:()=>void}){
  const label={preparing:'Dando forma a tu idea',review:'Listo para revisar',saving:'Guardando tu proyecto',complete:'Tu proyecto está listo',incomplete:'Necesita tu atención'}[context.phase];
  return <div className={`context-flow ${context.phase}`} aria-label="Contexto de trabajo"><span className="flow-orbit">✧</span><div><span className="flow-route">ZEN <span aria-hidden="true">→</span> Codex</span><strong>{label}</strong></div><button onClick={toggle}>{focused?'Volver a ZEN':'Ver proyecto'}<span aria-hidden="true">{focused?'↩':'↗'}</span></button></div>;
}
export function ProjectCard({draft,notify,changed}:{draft:ProjectDraft;notify:(message:string)=>void;changed:(draft:ProjectDraft)=>void}){
  const [preview,setPreview]=useState<ProjectBundle>(),[working,setWorking]=useState(false),[expanded,setExpanded]=useState(false);
  const choose=async()=>{
    setWorking(true);try{const selection=await window.zen.chooseDirectory();if(!selection.ok){notify(selection.error);return;}if(!selection.value)return;const result=await window.zen.projectDestination({id:draft.id,grantId:selection.value.grantId});if(result.ok)changed(result.value);else notify(result.error);}finally{setWorking(false);}
  };
  const inspect=async()=>{setExpanded(!expanded);if(!preview){const result=await window.zen.projectPreview(draft.id);if(result.ok)setPreview(result.value);else notify(result.error);}};
  const save=async()=>{if(!draft.approvalId)return;setWorking(true);try{const result=await window.zen.projectApprove({id:draft.id,approvalId:draft.approvalId});if(!result.ok)notify(result.error);}finally{setWorking(false);}};
  return <article className="project-card" aria-label="Propuesta de Codex"><div className="project-card-heading"><span className="project-folder" aria-hidden="true">⌑</span><div><span className="project-eyebrow">Preparado con Codex</span><h2>{draft.name}</h2></div><span className="project-count">{draft.paths.length} {draft.paths.length===1?'archivo':'archivos'}</span></div><p>{draft.summary}</p>
    <ul className="project-tree" aria-label="Estructura del proyecto">{draft.directories.map(path=><li key={'d:'+path}><span aria-hidden="true">▱</span>{path}/</li>)}{draft.paths.map(path=><li key={'f:'+path}><span aria-hidden="true">·</span>{path}</li>)}{!draft.paths.length&&!draft.directories.length&&<li>Carpeta vacía</li>}</ul>
    {!!draft.paths.length&&<button className="project-inspect" aria-expanded={expanded} onClick={()=>void inspect()}>{expanded?'Ocultar contenido':'Ver archivos antes de crear'}</button>}
    {expanded&&preview&&<div className="project-preview">{preview.files.map(file=><details key={file.path}><summary>{file.path}</summary><pre>{file.content}</pre></details>)}</div>}
    <div className="project-destination"><span>{draft.destination?'Se guardará en':'Elige un lugar para tu proyecto'}</span>{draft.destination&&<strong>{draft.destination}</strong>}<button disabled={working} onClick={()=>void choose()}>{draft.destination?'Cambiar ubicación':'Elegir ubicación'}</button></div>
    <div className="project-actions"><button disabled={working} onClick={()=>void window.zen.projectDiscard(draft.id).then(result=>{if(!result.ok)notify(result.error);})}>Descartar</button>{draft.destination&&<button className="primary" disabled={working||!draft.approvalId} onClick={()=>void save()}>{working?'Guardando…':'Crear aquí'}</button>}</div>
  </article>;
}
