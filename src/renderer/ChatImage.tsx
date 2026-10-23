import React,{useEffect,useRef,useState} from 'react';
import type {ChatImage as ImageInfo,ConversationCommand,ConversationReply} from '../shared/conversations';
import './chat-image.css';

export function ChatImage({chatId,messageId,image,call}:{chatId:string;messageId:string;image:ImageInfo;call:(c:ConversationCommand)=>Promise<ConversationReply>}){
 const button=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),callRef=useRef(call);callRef.current=call;
 const [thumbnail,setThumbnail]=useState<string>(),[full,setFull]=useState<string>(),[open,setOpen]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{
  let live=true,started=false;
  const observer=new IntersectionObserver(entries=>{
   if(started||!entries.some(e=>e.isIntersecting))return;started=true;observer.disconnect();
   void callRef.current({action:'message-image',id:chatId,messageId,imageId:image.id,size:'thumbnail'}).then(r=>{if(live){if(r.image)setThumbnail(r.image.data);else setError(true);}}).catch(()=>{if(live)setError(true);});
  },{rootMargin:'240px'});
  if(button.current)observer.observe(button.current);
  return()=>{live=false;observer.disconnect();};
 },[chatId,messageId,image.id]);
 useEffect(()=>{
  if(!open)return;
  let live=true;dialog.current?.showModal();setError(false);
  if(!full)void callRef.current({action:'message-image',id:chatId,messageId,imageId:image.id,size:'full'}).then(r=>{if(live){if(r.image)setFull(r.image.data);else setError(true);}}).catch(()=>{if(live)setError(true);});
  return()=>{live=false;dialog.current?.close();};
 },[open,chatId,messageId,image.id]);
 const close=()=>{dialog.current?.close();setOpen(false);button.current?.focus();};
 return <>
  <button ref={button} type="button" className="chat-image-thumbnail" aria-label={'Ampliar imagen: '+image.name} onClick={()=>setOpen(true)}>
   {thumbnail?<img src={thumbnail} alt={image.name} decoding="async"/>:<span>{error?'Ver imagen':'Cargando imagen…'}</span>}
   <span className="chat-image-caption">{image.name} <span aria-hidden="true">↗</span></span>
  </button>
  {open&&<dialog ref={dialog} className="chat-image-dialog" aria-label={'Imagen adjunta: '+image.name} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close();}}}>
   <header><span>{image.name}</span><button type="button" onClick={close} aria-label="Cerrar imagen" autoFocus>×</button></header>
   <div className="chat-image-view">{error?<p role="alert">No se pudo abrir esta imagen guardada.</p>:<>{(full||thumbnail)&&<img src={full??thumbnail} alt={image.name}/>} {!full&&<p role="status">Abriendo imagen…</p>}</>}</div>
  </dialog>}
 </>;
}
