import React,{useEffect,useRef,useState} from 'react';
import type {CompanionResult} from '../shared/codex-companion';
import type {CodexResultState} from '../shared/companion-codex-result';
import {emptyResultDraft,receiveResult,editResult,applyPendingResult} from './codex-result-draft';

/** Visible-source reconciliation only; never sends work, polls providers, or overwrites edits. */
export function CodexResultPanel({read,disabled,mail=false,hideEmpty=false}:{read:()=>Promise<CompanionResult<CodexResultState>>;disabled:boolean;mail?:boolean;hideEmpty?:boolean}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(emptyResultDraft),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[copied,setCopied]=useState(false),[waiting,setWaiting]=useState(false),[hasContext,setHasContext]=useState(false);
 const manual=useRef<()=>void>(()=>{}),copyEpoch=useRef(0);
 useEffect(()=>{
  let live=true,epoch=0,flight=false,again=false,timer:ReturnType<typeof setTimeout>|undefined;setDraft(emptyResultDraft());setOpen(false);setNotice('');setWaiting(false);setHasContext(false);setCopied(false);copyEpoch.current++;
  const poll=async(explicit=false)=>{
   if(!live||disabled||document.hidden)return;if(flight){again=true;return;}clearTimeout(timer);flight=true;const n=epoch;if(explicit)setBusy(true);
   let retry=false;
   try{const r=await read();if(!live||n!==epoch||document.hidden)return;
    if(!r.ok){if(explicit)setNotice(r.error);retry=true;return;}
    const v=r.value;setHasContext(v.state!=='none');setWaiting(v.state==='waiting');
    if(v.state==='ready'){setDraft(old=>receiveResult(old,v.result));setOpen(true);setNotice('');setCopied(false);}
    else if(v.state==='changed'||v.state==='expired'){setDraft(emptyResultDraft());setOpen(false);setNotice(v.state==='changed'?'El contenido cambió. Prepara una petición nueva.':'La petición caducó. Puedes preparar otra.');copyEpoch.current++;}
    else{retry=v.state==='waiting';if(explicit)setNotice(v.state==='waiting'?'Esperando la respuesta de esta petición en Codex.':'Prepara una petición en Codex para este contenido.');}
   }catch{retry=true;if(live&&n===epoch&&explicit)setNotice('No se pudo actualizar. Puedes volver a intentarlo.');}
   finally{flight=false;if(live&&again){again=false;void poll();}else if(live&&n===epoch){setBusy(false);if(retry&&!document.hidden)timer=setTimeout(()=>void poll(),4000);}}
  };
  const refresh=()=>{void poll();},visibility=()=>{clearTimeout(timer);epoch++;if(document.hidden){copyEpoch.current++;setDraft(emptyResultDraft());setOpen(false);setWaiting(false);setNotice('');}else void poll();};
  manual.current=()=>{void poll(true);};void poll();window.addEventListener('zen:handoff',refresh);document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;epoch++;copyEpoch.current++;clearTimeout(timer);window.removeEventListener('zen:handoff',refresh);document.removeEventListener('visibilitychange',visibility);};
 },[read,disabled]);
 if(disabled||hideEmpty&&!hasContext&&!notice)return null;
 const reply=mail&&(!draft.result||draft.result.action==='reply'),label=draft.result?.label??(mail?'Respuesta de Codex':'Resultado de Codex');
 return <section className="gmail-reply-editor" aria-label="Respuesta de Codex" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if((e.target as HTMLElement).tagName==='TEXTAREA')(e.target as HTMLElement).blur();else setOpen(false);}}}>
  <header><button className="gmail-reply-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{label}<span aria-hidden="true">{open?'−':'+'}</span></button><button className="gmail-reply-fetch" disabled={disabled||busy} onClick={()=>manual.current()} title="Actualizar resultado de esta petición">{busy?'Buscando…':'Traer de Codex'}</button></header>
  {waiting&&!open&&<small className="codex-result-waiting" role="status">Esperando respuesta en Codex</small>}
  {open&&<div className="gmail-reply-content">{draft.pending&&<button className="codex-result-pending" onClick={()=>{setDraft(applyPendingResult);setCopied(false);}}>Hay un resultado nuevo · Sustituir mi edición</button>}{reply?<textarea aria-label="Propuesta de respuesta editable" placeholder="La propuesta aparecerá aquí." value={draft.text} maxLength={64000} onChange={e=>{setDraft(old=>editResult(old,e.target.value));setCopied(false);}}/>:<div className="codex-result-text">{draft.text}</div>}<div className="gmail-reply-actions"><button disabled={disabled||!draft.text.trim()} onClick={async()=>{const n=copyEpoch.current,r=await window.companion.copy(draft.text);if(n!==copyEpoch.current)return;if(r.ok)setCopied(true);else setNotice(r.error);}}>{copied?'Copiada ✓':reply?'Copiar respuesta':'Copiar'}</button><button disabled={disabled} onClick={()=>mail?void window.companion.openIntegrationWeb('gmail'):void window.companion.openCodex()}>{mail?'Abrir Gmail ↗':'Abrir Codex'}</button></div></div>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
