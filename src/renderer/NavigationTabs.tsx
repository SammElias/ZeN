import React,{useRef} from 'react';
import {Icon} from './components';
export type Page='home'|'chat'|'tasks';
const tabs=[['home','Inicio','home'],['chat','Chat','chat'],['tasks','Tareas','history']] as const;
export function NavigationTabs({page,select}:{page:Page;select:(page:Page)=>void}){
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  return <nav className="top-navigation" aria-label="Navegación principal">{tabs.map(([id,label,icon],index)=><button key={id} ref={node=>{buttons.current[index]=node;}} className="navigation-tab" aria-label={label} title={label} aria-current={page===id?'page':undefined} onClick={()=>select(id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:undefined;if(next!==undefined){event.preventDefault();buttons.current[next]?.focus();select(tabs[next][0]);}}}><Icon name={icon}/><span className="nav-label">{label}</span></button>)}</nav>;
}
