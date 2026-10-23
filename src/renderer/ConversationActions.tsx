import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {confirmationCode} from '../shared/confirmation';
import type {ChatRow,ConversationCommand,ConversationReply} from '../shared/conversations';

export type ConversationTarget={row:ChatRow;x:number;y:number;trigger:HTMLButtonElement};
export function ConversationActions({target,call,close,deleted}:{target:ConversationTarget;call:(c:ConversationCommand)=>Promise<ConversationReply>;close:()=>void;deleted:()=>void}){
 const menu=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),alive=useRef(true),proposal=useRef<string|undefined>(undefined),busyRef=useRef(false);
 const latest=useRef({call,close,deleted});latest.current={call,close,deleted};
 const [review,setReview]=useState(false),[code,setCode]=useState(''),[title,setTitle]=useState(target.row.title),[busy,setBusy]=useState(false),[error,setError]=useState(''),[typed,setTyped]=useState('');
 const dismiss=()=>{if(busyRef.current)return;latest.current.close();if(target.trigger.isConnected)target.trigger.focus();};
 useEffect(()=>{
  alive.current=true;
  const off=window.zen.onConversation(event=>{if(event.deleted&&event.chatId===target.row.id){latest.current.deleted();latest.current.close();}});
  return()=>{alive.current=false;off();if(proposal.current)void latest.current.call({action:'delete-cancel',id:target.row.id,code:proposal.current}).catch(()=>{});};
 },[target.row.id]);
 useLayoutEffect(()=>{
  if(review){dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('.cancel-delete')?.focus();return;}
  const el=menu.current;if(!el)return;
  const box=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(target.x,innerWidth-box.width-8))+'px';el.style.top=Math.max(8,Math.min(target.y,innerHeight-box.height-8))+'px';
  el.querySelector<HTMLButtonElement>('button')?.focus();
 },[review,target]);
 useEffect(()=>{
  if(review)return;
  const outside=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node))latest.current.close();};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}};
  const moved=()=>latest.current.close();
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('resize',moved);window.addEventListener('blur',moved);document.addEventListener('scroll',moved,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',moved);window.removeEventListener('blur',moved);document.removeEventListener('scroll',moved,true);};
 },[review]);
 const prepare=async()=>{
  setReview(true);setError('');
  try{
   const reply=await call({action:'delete-preview',id:target.row.id});
   if(!reply.code)throw new Error('No se pudo preparar la confirmación.');
   if(!alive.current){void latest.current.call({action:'delete-cancel',id:target.row.id,code:reply.code}).catch(()=>{});return;}
   proposal.current=reply.code;setTitle(reply.deletion?.title??target.row.title);setCode(reply.code);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo preparar el borrado.');}
 };
 const confirm=async()=>{
  if(!code||busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{await call({action:'delete-confirm',id:target.row.id,code});proposal.current=undefined;if(alive.current){latest.current.deleted();latest.current.close();}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo eliminar la conversación.');}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
 };
 return createPortal(review?<dialog ref={dialog} className="conversation-delete-dialog" aria-labelledby="delete-conversation-title" aria-describedby="delete-conversation-detail" onCancel={e=>{e.preventDefault();dismiss();}}>
  <h2 id="delete-conversation-title">¿Eliminar conversación?</h2><p className="delete-chat-title">{title}</p>
  <p id="delete-conversation-detail">Se borrarán su historial y sus copias locales, y se solicitará eliminar sus respuestas remotas. Sus tareas se detendrán. Los archivos originales se conservan. Esta acción no se puede deshacer.</p>
  {code&&<><p className="delete-voice-code">También puedes confirmar por voz o chat: <strong>confirmo {code}</strong>.</p><form onSubmit={e=>{e.preventDefault();if(confirmationCode(typed)===code)void confirm();else setError('Escribe «confirmo» y el código mostrado.');}}><input className="delete-chat-input" aria-label="Confirmar borrado por chat" placeholder={'confirmo '+code} value={typed} disabled={busy} onChange={e=>{setTyped(e.target.value);setError('');}}/></form></>}
  {!code&&!error&&<p role="status">Preparando confirmación…</p>}{error&&<p role="alert">{error}</p>}
  <div className="delete-chat-actions"><button className="cancel-delete" disabled={busy} onClick={dismiss}>Cancelar</button><button className="confirm-delete" disabled={!code||busy||!!error} onClick={()=>void confirm()}>{busy?'Eliminando…':'Eliminar conversación'}</button></div>
 </dialog>:<div ref={menu} role="menu" aria-label="Opciones de conversación" className="conversation-context-menu" style={{left:target.x,top:target.y}} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();menu.current?.querySelector<HTMLButtonElement>('button')?.focus();}if(e.key==='Tab')latest.current.close();}}><button role="menuitem" onClick={()=>void prepare()}>Eliminar conversación</button></div>,document.body);
}
