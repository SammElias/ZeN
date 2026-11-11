import React, {useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {CompanionIcon, OpenCodex} from './CompanionActions';
import {Segments} from './WorkspaceTools';

export function CompanionNotices({status}:{status:CompanionStatus}){
 const [kind,setKind]=useState<'all'|'permission'|'error'>('all');
 const items=status.notices.filter(n=>kind==='all'||n.kind===kind).sort((a,b)=>b.at-a.at);
 return <><div className="view-toolbar notice-tools"><Segments label="Filtrar avisos" value={kind} onChange={setKind} items={[{value:'all',label:'Todos'},{value:'permission',label:'Permisos'},{value:'error',label:'Errores'}]}/><small className="view-count">{items.length} avisos</small>{status.notices.length>0&&<button onClick={()=>void window.companion.clearNotices()}>Limpiar avisos</button>}</div>{status.notices.length>0&&items.length===0&&<p className="view-empty">No hay avisos de este tipo.</p>}{status.notices.length===0?<div className="companion-empty"><CompanionIcon name="bell"/><h2>Todo al día</h2></div>:items.map(n=><article className="companion-card notice-card" key={n.id}><CompanionIcon name="bell"/><div><h2>{n.title}</h2><small>{new Date(n.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</small></div><OpenCodex id={n.session}/></article>)}</>;
}
