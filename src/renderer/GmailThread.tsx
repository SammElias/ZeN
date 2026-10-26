import React,{useEffect,useRef,useState} from 'react';
import type {GmailMessage,GmailThreadMessage} from '../shared/companion-gmail';
import './GmailThread.css';
import {mailSender,mailDate} from './mail-presentation';
import {splitQuotedText} from '../shared/mail-quoted-text';
import type {MailThreadReading} from './mail-reading';

function RichMailBody({message}:{message:GmailThreadMessage}){
 const rich=message.rich!,frame=useRef<HTMLIFrameElement>(null),live=useRef(true),flight=useRef(false);
 const [height,setHeight]=useState(180),[ready,setReady]=useState(false),[loading,setLoading]=useState(false),[remaining,setRemaining]=useState(rich.externalImages),[notice,setNotice]=useState('');
 const send=(value:object)=>frame.current?.contentWindow?.postMessage({zenMail:rich.view,...value},'*');
 const images=async(external:boolean)=>{
  if(flight.current)return;flight.current=true;if(external){setLoading(true);setNotice('');}
  try{const result=await window.companion.gmailImages(rich.view,external);if(!live.current)return;if(result.ok){send({kind:'images',images:result.value.images});setRemaining(result.value.remaining);if(result.value.failed)setNotice('Algunas imágenes no se pudieron cargar. Puedes volver a intentarlo o abrir Gmail.');}else setNotice(result.error);}
  finally{flight.current=false;if(live.current)setLoading(false);}
 };
 useEffect(()=>{
  live.current=true;
  const receive=(event:MessageEvent)=>{const value=event.data;if(event.source!==frame.current?.contentWindow||event.origin!=='null'||!value||value.zenMail!==rich.view)return;
   if(value.kind==='resize'&&Number.isFinite(value.height))setHeight(Math.min(12000,Math.max(150,Math.ceil(value.height))));
   if(value.kind==='escape')document.dispatchEvent(new Event('zen-mail-escape'));
   if(value.kind==='navigate'&&(value.direction===-1||value.direction===1))document.dispatchEvent(new CustomEvent('zen-mail-navigate',{detail:value.direction}));
   if(value.kind==='link'&&typeof value.id==='string'&&/^l\d{1,3}$/.test(value.id))void window.companion.gmailOpenLink(rich.view,value.id).then(result=>{if(live.current&&!result.ok)setNotice(result.error);});
  };window.addEventListener('message',receive);
  return()=>{live.current=false;window.removeEventListener('message',receive);void window.companion.gmailImagesCancel(rich.view);};
 },[rich.view]);
 return <div className="gmail-rich-body">
  {rich.externalImages>0&&remaining>0&&<div className="gmail-image-bar"><button title="Cargar imágenes externas. El remitente puede registrar la apertura." disabled={!ready||loading} onClick={()=>void images(true)}>{loading?'Cargando…':'Mostrar imágenes'+(remaining>1?' · '+remaining:'')}</button></div>}
  {rich.truncated&&<small className="gmail-rich-note">Contenido incompleto · <button onClick={()=>void window.companion.openIntegrationWeb('gmail')}>Ver en Gmail ↗</button></small>}
  <iframe ref={frame} className="gmail-rich-frame" title={'Contenido original: '+(message.subject||'correo')} src={'zen-mail://message/'+rich.view} sandbox="allow-scripts" referrerPolicy="no-referrer" style={{height}} onLoad={()=>{setReady(true);send({kind:'measure'});void images(false);}}/>
  {notice&&<p role="status" className="gmail-rich-note">{notice}</p>}
 </div>;
}
function PlainBody({text}:{text:string}){const parts=splitQuotedText(text);return <div className="gmail-message-text">{parts.body}{parts.quote&&<details className="gmail-plain-quote"><summary>Ver texto citado</summary><div>{parts.quote}</div></details>}</div>;}
function ThreadEntry({message,latest,mode,open,onOpen}:{message:GmailThreadMessage;latest:boolean;mode:'original'|'text';open:boolean;onOpen:(open:boolean)=>void}){
 const sender=mailSender(message.from),date=mailDate(message.date);
 return <details className="gmail-thread-entry" data-latest={latest||undefined} open={open} onToggle={e=>{if(e.currentTarget.open!==open)onOpen(e.currentTarget.open);}}>
  <summary><span className="gmail-sender-mark" aria-hidden="true">{sender.name[0]?.toUpperCase()}</span><span className="gmail-sender"><strong title={message.from}>{sender.name}</strong><small title={open?message.from+' · Para: '+message.to:message.text}>{open?(sender.address||message.to&&'Para: '+message.to):message.text.replace(/\s+/g,' ').slice(0,160)}</small></span><time dateTime={date.iso} title={date.full}>{date.label}</time></summary>
  {open&&<div className="gmail-thread-body">{message.to&&<div className="gmail-recipient" title={message.to}>Para: {message.to}</div>}{mode==='original'&&message.rich&&message.rich.source!=='text'?<RichMailBody key={message.rich.view} message={message}/>:<PlainBody text={message.text}/ >}{message.truncated&&<p role="status" className="gmail-rich-note">Mensaje incompleto · Ábrelo en Gmail para verlo entero.</p>}</div>}
 </details>;
}
export function GmailThread({thread,actions,initialReading,onReading}:{thread:GmailMessage;actions?:React.ReactNode;initialReading?:MailThreadReading;onReading?:(value:MailThreadReading)=>void}){
 const [mode,setMode]=useState<'original'|'text'>(initialReading?.mode??'original'),[opened,setOpened]=useState<string[]>(initialReading?.open??[thread.messages.at(-1)!.id]),hasRich=thread.messages.some(m=>m.rich);
 useEffect(()=>{onReading?.({mode,open:opened});},[mode,opened]);
 return <><div className="gmail-thread-toolbar">{actions}<div className="gmail-view-controls" role="group" aria-label="Formato del correo"><span>{thread.messageCount} {thread.messageCount===1?'mensaje':'mensajes'}</span>{hasRich&&<div><button aria-pressed={mode==='original'} onClick={()=>setMode('original')}>Original</button><button aria-pressed={mode==='text'} onClick={()=>setMode('text')}>Texto</button></div>}</div></div><div className="gmail-thread">{thread.messages.map((message,index)=><ThreadEntry key={message.id} message={message} latest={index===thread.messages.length-1} mode={mode} open={opened.includes(message.id)} onOpen={open=>setOpened(old=>open?[...new Set([...old,message.id])]:old.filter(id=>id!==message.id))}/>)}</div></>;
}
