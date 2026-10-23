import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {chatStateLabel,type ChatMessage,type ChatSnapshot,type ConversationCommand,type ConversationReply} from '../shared/conversations';
import type {ProjectContexts} from '../shared/project-context';
import {MessageText} from './message-text';
import {ChatImage} from './ChatImage';
import {MessageActions} from './MessageActions';
import {Icon} from './components';
import './conversations.css';
import {useConversationList} from './useConversationList';
import {ConversationActions,type ConversationTarget} from './ConversationActions';
const EMPTY_MESSAGES:ChatMessage[]=[];

export function Conversations({snapshot,revision,loading,projects,call,open,notify,scroll,children}:{children?:React.ReactNode;snapshot?:ChatSnapshot;revision:number;loading:boolean;projects:ProjectContexts;call:(c:ConversationCommand)=>Promise<ConversationReply>;open:(c:ConversationCommand)=>Promise<void>;notify:(s:string)=>void;scroll:React.RefObject<HTMLDivElement|null>}){
 const [list,setList]=useState(false),listScroll=useRef<HTMLDivElement>(null),listEnd=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState<ConversationTarget>();
 useEffect(()=>{setMenu(undefined);},[list,projects.activeId,snapshot?.chat.id]);
 const listing=useConversationList(list,projects.activeId,revision,call);
 useEffect(()=>{if(!list||listing.loading||!listing.more||listing.error||!listEnd.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void listing.loadMore();},{root:listScroll.current,rootMargin:'0px 0px 120px 0px'});observer.observe(listEnd.current);return()=>observer.disconnect();},[list,listing.loading,listing.more,listing.error,listing.rows]);
 const [pages,setPages]=useState(new Map<string,{messages:ChatMessage[];done:boolean}>());
 const chat=snapshot?.chat;
 const cached=chat?pages.get(chat.id):undefined,older=cached?.messages??EMPTY_MESSAGES,olderDone=cached?.done??false;
 const safe=(fn:()=>Promise<unknown>)=>void fn().catch(e=>notify(e.message));

 useLayoutEffect(()=>{setList(false);},[chat?.id]);
 const following=useRef(false),[away,setAway]=useState(false),listRef=useRef(list);listRef.current=list;
 const savedReading=useRef(0),prepend=useRef<{id?:string;offset:number;height:number;top:number}|undefined>(undefined);
 const currentChat=useRef(chat?.id);currentChat.current=chat?.id;
 const toggleHistory=()=>{if(!list&&scroll.current)savedReading.current=scroll.current.scrollTop;setList(v=>!v);};
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&listRef.current&&!document.querySelector('dialog[open],.conversation-context-menu')){e.preventDefault();e.stopPropagation();setList(false);}};document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true);},[]);
 useLayoutEffect(()=>{const el=scroll.current;if(!el)return;el.scrollTop=snapshot?.draft.scrollTop??0;savedReading.current=el.scrollTop;following.current=el.scrollHeight-el.clientHeight-el.scrollTop<60;setAway(!following.current);},[chat?.id]);
 useEffect(()=>{const el=scroll.current;if(!el)return;const update=()=>{if(listRef.current)return;following.current=el.scrollHeight-el.clientHeight-el.scrollTop<60;setAway(!following.current);};el.addEventListener('scroll',update);return()=>el.removeEventListener('scroll',update);},[chat?.id]);
 useLayoutEffect(()=>{if(!list&&scroll.current){scroll.current.scrollTop=savedReading.current;if(following.current)scroll.current.scrollTop=scroll.current.scrollHeight;}},[list]);
 useLayoutEffect(()=>{if(!list&&following.current&&scroll.current&&!prepend.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[snapshot?.messages,list]);
 const loadOlder=()=>safe(async()=>{if(!chat||!snapshot)return;const el=scroll.current,id=chat.id,first=older[0]??snapshot.messages[0];if(!first)return;following.current=false;setAway(true);const row=el&&Array.from(el.querySelectorAll<HTMLElement>('[data-message-id]')).find(row=>row.getBoundingClientRect().bottom>el.getBoundingClientRect().top);const anchor=el?{id:row?.dataset.messageId,offset:row?row.getBoundingClientRect().top-el.getBoundingClientRect().top:0,height:el.scrollHeight,top:el.scrollTop}:undefined;const r=await call({action:'read',id,before:first.seq});if(currentChat.current!==id)return;prepend.current=anchor;setPages(previous=>{const next=new Map(previous);next.delete(id);next.set(id,{messages:[...r.messages??[],...previous.get(id)?.messages??[]],done:!r.messages?.length||r.messages[0].seq===1});while(next.size>6)next.delete(next.keys().next().value!);return next;});});
 useLayoutEffect(()=>{const anchor=prepend.current,el=scroll.current;if(!anchor||!el)return;const row=Array.from(el.querySelectorAll<HTMLElement>('[data-message-id]')).find(row=>row.dataset.messageId===anchor.id);el.scrollTop=row?el.scrollTop+row.getBoundingClientRect().top-el.getBoundingClientRect().top-anchor.offset:anchor.top+el.scrollHeight-anchor.height;savedReading.current=el.scrollTop;prepend.current=undefined;},[older]);
 const choose=(id:string)=>safe(async()=>{await open({action:'open',id});setList(false);});
 const history=useMemo(()=>[...older,...snapshot?.messages??[]].filter((m,i,a)=>a.findIndex(n=>n.id===m.id)===i),[older,snapshot?.messages]);
 return <section className="conversations simple-chat" aria-label={chat?.title?'Conversación: '+chat.title:'Chats guardados'} data-chat-id={chat?.id}>
  <header className="chat-topbar"><nav className="chat-navigation" aria-label="Conversaciones"><button aria-label="Conversaciones" aria-pressed={list} onClick={toggleHistory}><Icon name="history"/><span>Conversaciones</span></button></nav><span className="chat-current-title" title={chat?.title}>{chat?.title}</span><button className="new-chat" aria-label="Nuevo chat" disabled={loading} onClick={()=>safe(()=>open({action:'create',projectId:projects.activeId}))}><span aria-hidden="true">+</span> Nuevo chat</button></header>
  <div className="chat-reading-frame"><div ref={listScroll} className="chat-history-page content-scroll" hidden={!list} tabIndex={0} aria-label="Lista de conversaciones"><div className="conversation-list"><div className="history-heading"><strong>Conversaciones</strong><button aria-label="Volver al chat" onClick={()=>setList(false)}>Volver</button></div>{listing.rows.map(row=><button className="chat-row" key={row.id} aria-current={row.id===chat?.id?'page':undefined} title={row.title} aria-haspopup="menu" aria-expanded={menu?.row.id===row.id} onContextMenu={e=>{e.preventDefault();e.stopPropagation();const box=e.currentTarget.getBoundingClientRect();setMenu({row,x:e.clientX||box.left+16,y:e.clientY||box.bottom,trigger:e.currentTarget});}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();e.stopPropagation();const box=e.currentTarget.getBoundingClientRect();setMenu({row,x:box.left+16,y:box.bottom,trigger:e.currentTarget});}}} onClick={()=>choose(row.id)}><strong>{row.title}</strong></button>)}{!listing.rows.length&&!listing.loading&&!listing.error&&<p>No hay conversaciones todavía.</p>}{listing.loading&&<p className="history-loading" role="status">Cargando conversaciones…</p>}{listing.error&&<p role="alert">{listing.error}</p>}<div ref={listEnd} className="history-end" aria-hidden="true"/></div></div><div ref={scroll} className={`chat-scroll-content chat-reading content-scroll ${list?'reading-obscured':''}`} aria-hidden={list||undefined} inert={list||undefined} tabIndex={0} aria-label="Conversación">

  {loading&&<p role="status">Abriendo conversación…</p>}
  {chat&&<>
   {chat.archived&&<p className="chat-notice">Conversación archivada. <button onClick={()=>safe(async()=>{await call({action:'update',id:chat.id,archived:false});await open({action:'open',id:chat.id});})}>Recuperar conversación</button></p>}
   {snapshot?.hasOlder&&!olderDone&&<button className="load-older" onClick={loadOlder}>Cargar mensajes anteriores</button>}
   <div className="chat-history" aria-label="Historial de la conversación">{history.map(m=><article className={'history-message '+m.role} key={m.id} data-message-id={m.id}><header><strong>{m.role==='user'?'Tú':m.role==='context'?'Contexto seleccionado':'ZEN'}{m.role==='user'&&m.event?.utterance?' · Voz (fragmento)':''}</strong>{m.role==='assistant'&&(m.event?.utterance||!['completed','running','pending'].includes(m.state))&&<small>{m.event?.utterance?'Transcripción de voz · fragmento':chatStateLabel[m.state]}{m.partial&&!m.event?.utterance?' · Parcial':''}</small>}</header>{m.images?.length?<div className="chat-message-images">{m.images.map(image=><ChatImage key={image.id} chatId={chat.id} messageId={m.id} image={image} call={call}/>)}</div>:null}{m.text?m.event?.utterance||['pending','running'].includes(m.state)?<p className="result-text">{m.text}</p>:<MessageText text={m.text} notify={notify}/>:<p role="status">{m.state==='pending'?'En cola…':m.state==='running'?'Preparando respuesta…':'Sin contenido recuperable.'}</p>}{m.role==='assistant'&&<div className="message-action-space">{m.text&&m.role==='assistant'&&!['running','pending'].includes(m.state)&&<MessageActions text={m.text} notify={notify} actions={[...m.event?.artifacts?.map(a=>({label:'Guardar '+a.title,run:async()=>{const r=await window.zen.saveResult({artifactId:a.id});notify(r.ok?r.value.saved?'Resultado guardado.':'Guardado cancelado.':r.error);}}))??[]]}/>}</div>}</article>)}{!history.length&&<p className="chat-empty">Un espacio para continuar tus ideas. Escribe abajo o añade contexto.</p>}</div>

  </>}{children}</div>{away&&!list&&<button className="chat-tail" aria-label="Ir a los mensajes nuevos" title="Ir a los mensajes nuevos" onClick={()=>{following.current=true;setAway(false);if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;}}><span aria-hidden="true">↓</span></button>}</div>
 {menu&&<ConversationActions key={menu.row.id} target={menu} call={call} close={()=>setMenu(undefined)} deleted={()=>{setPages(previous=>{const next=new Map(previous);next.delete(menu.row.id);return next;});void listing.refresh();}}/>}
 </section>;
}
