import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './components';
export type MessageAction={label:string;run:()=>Promise<unknown>|void};
export function MessageActions({text,actions=[],notify}:{text:string;actions?:MessageAction[];notify:(message:string)=>void}){
  const [copied,setCopied]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>(undefined),menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu.current?.open){e.preventDefault();e.stopPropagation();menu.current.open=false;menu.current.querySelector('summary')?.focus();}};document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true);},[]);
  const safe=(action:MessageAction)=>{if(menu.current)menu.current.open=false;void Promise.resolve().then(action.run).catch(e=>notify(e.message));};
  return <div className="message-tools"><button className="message-copy" aria-label="Copiar respuesta" title="Copiar respuesta" onClick={()=>void navigator.clipboard.writeText(text).then(()=>{setCopied(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),1800);},()=>notify('No se pudo copiar. Selecciona el texto y usa Ctrl+C.'))}><Icon name={copied?'check':'copy'}/></button><span className="copy-feedback" role="status">{copied?'Copiado':''}</span>{!!actions.length&&<details ref={menu} className="message-more"><summary aria-label="Más acciones del mensaje" title="Más acciones del mensaje"><Icon name="details"/></summary><div className="message-more-list">{actions.map(action=><button key={action.label} onClick={()=>safe(action)}>{action.label}</button>)}</div></details>}</div>;
}
