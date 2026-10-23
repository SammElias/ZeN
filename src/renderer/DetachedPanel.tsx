import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {portalNames} from '../shared/desktop-shell';
export const detachedWorkspace=new URLSearchParams(location.search).get('view')==='workspace';
/** React retains the same state/handlers; the native window contains only the
 * local panel DOM. No second App, voice client, task runtime or draft writer. */
export function DetachedPanel({name,title,close,children}:{name:typeof portalNames[number];title:string;close:()=>void;children:React.ReactNode}){
 const [target,setTarget]=useState<HTMLElement>(),onClose=useRef(close);onClose.current=close;
 useEffect(()=>{
  if(!detachedWorkspace)return;
  const child=window.open('about:blank','zen-'+name,name==='appearance'?'width=400,height=280':'width=560,height=650');
  if(!child)return;
  child.document.title='ZEN · '+title;
  for(const node of document.head.querySelectorAll('link[rel=stylesheet],style'))child.document.head.appendChild(node.cloneNode(true));
  child.document.documentElement.dataset.zenTheme='midnight';child.document.body.className='detached-panel-body';
  const host=child.document.createElement('div');host.className='detached-panel-root compact-shell';child.document.body.appendChild(host);setTarget(host);
  const closed=()=>onClose.current();child.addEventListener('beforeunload',closed);
  const keyboard=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();onClose.current();}};child.document.addEventListener('keydown',keyboard);
  child.focus();
  return()=>{child.removeEventListener('beforeunload',closed);child.document.removeEventListener('keydown',keyboard);child.close();};
 },[name]);
 if(!detachedWorkspace)return <>{children}</>;
 return target?createPortal(children,target):<div className="detached-panel-fallback">{children}</div>;
}
