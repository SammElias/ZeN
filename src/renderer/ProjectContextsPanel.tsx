import React,{useState} from 'react';
import type {ProjectContexts,ProjectContext} from '../shared/project-context';
export function ProjectContextsPanel({value,save,notify,locked}:{value:ProjectContexts;save:(value:ProjectContexts)=>Promise<boolean>;notify:(text:string)=>void;locked:boolean}){
  const [draft,setDraft]=useState(value),[id,setId]=useState<string|undefined>(value.activeId??value.projects[0]?.id),[pending,setPending]=useState(false);
  const project=draft.projects.find(p=>p.id===id);
  const update=(patch:Partial<ProjectContext>)=>setDraft(previous=>({...previous,projects:previous.projects.map(p=>p.id===id?{...p,...patch}:p)}));
  const importFile=async()=>{setPending(true);try{const result=await window.zen.importProjectReference();if(!result.ok)notify(result.error);else if(result.value&&project)update({documents:[...project.documents,result.value]});}finally{setPending(false);}};
  return <fieldset className="project-editor" disabled={locked||pending}><legend>Contexto por proyecto</legend>
    <p>Marca los documentos que quieres usar y guarda los cambios. Solo se comparte contexto al enviar una petición.</p>
    <div className="project-editor-choices" aria-label="Proyecto a editar">{draft.projects.map(p=><button key={p.id} aria-pressed={id===p.id} onClick={()=>setId(p.id)}>{p.name}</button>)}</div>
    <button disabled={draft.projects.length>=12} onClick={()=>{const next={id:crypto.randomUUID(),name:'Nuevo proyecto',preferences:'',documents:[]};setDraft({...draft,projects:[...draft.projects,next]});setId(next.id);}}>Nuevo proyecto</button>
    {project&&<><label>Nombre del proyecto<input value={project.name} maxLength={50} onChange={e=>update({name:e.target.value})}/></label>
      <label>Preferencias del proyecto<textarea value={project.preferences} maxLength={2000} placeholder="Idioma, estilo de respuesta, tecnologías…" onChange={e=>update({preferences:e.target.value})}/></label>
      <button disabled={project.documents.length>=8} onClick={()=>void importFile()}>{pending?'Leyendo localmente…':'Importar documento'}</button>
      <p>Máximo 8 fragmentos de 12.000 caracteres. Revisa el extracto: puede omitir partes del archivo.</p>
      {project.documents.map(doc=><article key={doc.id}><label className="document-choice"><input type="checkbox" checked={doc.enabled} onChange={e=>update({documents:project.documents.map(d=>d.id===doc.id?{...d,enabled:e.target.checked}:d)})}/>Usar {doc.name}</label><small>Importado: {new Date(doc.importedAt).toLocaleString()}</small><details><summary>Revisar fragmento</summary><textarea aria-label={`Fragmento de ${doc.name}`} value={doc.content} maxLength={12000} onChange={e=>update({documents:project.documents.map(d=>d.id===doc.id?{...d,content:e.target.value}:d)})}/></details><button onClick={()=>update({documents:project.documents.filter(d=>d.id!==doc.id)})}>Quitar referencia</button></article>)}
      <button disabled={project.id===value.activeId} onClick={()=>{setDraft({...draft,projects:draft.projects.filter(p=>p.id!==id)});setId(draft.projects.find(p=>p.id!==id)?.id);}}>Eliminar proyecto local</button>
    </>}
    <div className="card-actions"><button onClick={async()=>{setPending(true);try{if(await save(draft))notify('Proyectos guardados localmente.');}finally{setPending(false);}}}>Guardar proyectos</button><button onClick={()=>{setDraft(value);setId(value.activeId??value.projects[0]?.id);}}>Deshacer cambios sin guardar</button></div>
    {locked&&<p>Termina o detén la tarea para editar el contexto.</p>}
  </fieldset>;
}
