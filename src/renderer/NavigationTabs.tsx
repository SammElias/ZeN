import React,{useId,useRef} from 'react';
import {Icon} from './components';

type Page='home'|'chat';
const tabs=[['home','Home'],['chat','Chat']] as const;

export function NavigationTabs({page,select}:{page:Page;select:(page:Page)=>void}){
  const gradient=useId().replace(/:/g,'');const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const index=tabs.findIndex(([id])=>id===page);
  return <nav className="top-navigation" aria-label="Navegación principal">
    <svg className="navigation-contour" viewBox="0 0 88 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#34263e"/><stop offset="1" stopColor="#1b181f"/></linearGradient></defs>
      <path className="navigation-rail" d="M0 40H88"/>
      <g className="navigation-wave" style={{transform:`translateX(${index*44}px)`}}>
        <path className="navigation-wave-fill" d="M2 40V14Q2 5 11 5H33Q42 5 42 14V40Z" fill={`url(#${gradient})`}/>
        <path className="navigation-wave-line" d="M2 40V14Q2 5 11 5H33Q42 5 42 14V40"/>
      </g>
    </svg>
    {tabs.map(([id,label],position)=><button key={id} ref={node=>{buttons.current[position]=node;}} className="navigation-tab" aria-label={label} title={label} aria-current={page===id?'page':undefined} onClick={()=>select(id)} onKeyDown={event=>{
      const next=event.key==='ArrowRight'?(position+1)%tabs.length:event.key==='ArrowLeft'?(position+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:undefined;
      if(next===undefined)return;event.preventDefault();buttons.current[next]?.focus();select(tabs[next][0]);
    }}><Icon name={id}/><i className="navigation-selected-dot" aria-hidden="true"/></button>)}
  </nav>;
}
