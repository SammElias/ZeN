import React,{useEffect,useRef,useState} from 'react';
import {initialShellStatus,type ShellAction} from '../shared/desktop-shell';
import {Icon} from './components';
import {useMascot} from './useMascot';
import {MascotHost} from './Mascot';
import {prepareInputImage} from './Composer';
import type {WindowDropEvent} from '../shared/drop-context';
import {capsuleStatus} from './capsule-status';
export function DesktopCapsule(){
 const [status,setStatus]=useState(initialShellStatus),[hover,setHover]=useState(false),[error,setError]=useState('');
 const [windowDrop,setWindowDrop]=useState<WindowDropEvent>();
 useEffect(()=>window.zen.onWindowDrop(event=>{setWindowDrop(['hover','preparing','error'].includes(event.state)?event:undefined);}),[]);
 const receiving=hover||windowDrop?.state==='hover'||windowDrop?.state==='preparing';
 const visibleError=error||(windowDrop?.state==='error'?windowDrop.error:undefined);
 const drag=useRef<{x:number;y:number;moved:boolean}|undefined>(undefined);
 const [documentVisible,setDocumentVisible]=useState(!document.hidden);
 const presentation=capsuleStatus(status);
 useEffect(()=>{const changed=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
 const action=(a:ShellAction)=>void window.zen.shellAction(a).then(r=>{setError(r.ok?'':r.error);});
 useEffect(()=>{void window.zen.shellStatus().then(r=>{if(r.ok)setStatus(r.value);});return window.zen.onShellStatus(setStatus);},[]);
 const model=useMascot({task:{id:'capsule-status',state:status.state,paused:status.paused,message:''},microphone:status.microphone,speaking:status.speaking,visible:true,collapsed:false,reduced:status.reduced,wardrobe:status.wardrobe??'auto',walks:false,hands:status.attention||receiving});
 const drop=async(e:React.DragEvent)=>{e.preventDefault();setHover(false);setError('');const files=Array.from(e.dataTransfer.files),text=e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain');try{if(files.length>8)throw Error('Máximo ocho adjuntos.');if(files.length){const local=files.filter(f=>!f.type.startsWith('image/'));if(local.length){const r=await window.zen.dropFiles(local);if(!r.ok)throw Error(r.error);}for(const file of files.filter(f=>f.type.startsWith('image/'))){const r=await window.zen.dropImage(await prepareInputImage(file));if(!r.ok)throw Error(r.error);}}else if(text.trim()){const r=await window.zen.dropText({text:text.slice(0,64000),link:/^https?:\/\//i.test(text)});if(!r.ok)throw Error(r.error);}action('chat');}catch(e){setError((e as Error).message);}};
 return <main className={'desktop-capsule '+(status.reduced||!documentVisible?'motion-off ':'')+(presentation.animate?'is-busy ':'')+(receiving?'is-drop ':'')+(status.attention?'needs-attention':'')} data-state={visibleError?'error':presentation.kind} aria-label="Cápsula de ZEN" onDragOver={e=>{e.preventDefault();setHover(true);}} onDragLeave={()=>setHover(false)} onDrop={drop} onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button'))return;drag.current={x:e.screenX,y:e.screenY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);action('drag-start');}} onPointerMove={e=>{if(drag.current&&Math.hypot(e.screenX-drag.current.x,e.screenY-drag.current.y)>4)drag.current.moved=true;}} onPointerUp={e=>{if(!drag.current)return;action('drag-end');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;action('drag-end');}}>
  <button className="capsule-character" aria-label="Abrir Inicio" onClick={()=>action('home')} title="Inicio · clic derecho para Apariencia" onContextMenu={e=>{e.preventDefault();action('appearance');}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();action('appearance');}}}><span data-mascot-anchor="head"/></button>
  <span className="capsule-divider"/>
  <button className="capsule-status" aria-label={status.permission?'Revisar permiso':presentation.action==='chat'?'Continuar en Chat':'Ver actividad'} onClick={()=>action(presentation.action)} title={visibleError||status.label}>
   <span className="capsule-state-text" role="status" aria-live="polite"><strong><i/>{visibleError?'Revisar aviso':windowDrop?.state==='preparing'?'Capturando ventana':windowDrop?.state==='hover'?'Suelta la ventana':hover?'Suelta para adjuntar':presentation.label}</strong><small>{visibleError|| (receiving?'Se revisará antes de enviar':presentation.detail)}</small></span>
   {presentation.animate&&<b className="capsule-equalizer" aria-hidden="true"><em/><em/><em/></b>}
  </button>
  <nav aria-label="Accesos de ZEN">
   <button className="capsule-labeled capsule-chat" title="Abrir Chat" aria-label="Abrir Chat" onClick={()=>action('chat')}><Icon name="chat"/><span>Chat</span></button>
   <button className="capsule-labeled" title="Seleccionar una región de pantalla" aria-label="Capturar región" onClick={()=>action('region')}><Icon name="screen"/><span>Captura</span></button>
   <button title="Adjuntar archivos" aria-label="Adjuntar archivos" onClick={()=>action('attach')}><Icon name="attach"/></button>
   <button className="capsule-context" data-ready={!!status.contextReady} title={status.contextReady?'Revisar contexto preparado':'Abrir contexto'} aria-label={status.contextReady?'Revisar contexto preparado':'Abrir contexto'} onClick={()=>action('context')}><Icon name="folder"/>{status.contextReady&&<i aria-hidden="true"/>}</button>
   <button title={status.microphone?'Silenciar micrófono':'Hablar con ZEN'} aria-label={status.microphone?'Silenciar micrófono':'Hablar con ZEN'} aria-pressed={status.microphone} onClick={()=>action('microphone')}><Icon name={status.microphone?'mic':'mute'}/></button>
   <button className="capsule-stop" title="Detener" aria-label="Detener todas las tareas" disabled={!status.busy&&!status.microphone&&!status.speaking} onClick={()=>action('stop')}><Icon name="stop"/></button>
   <button title="Preferencias" aria-label="Abrir Preferencias" onClick={()=>action('preferences')}><Icon name="settings"/></button>
   <button className="capsule-hide" title="Ocultar cápsula" aria-label="Ocultar cápsula" onClick={()=>action('hide')}><Icon name="close"/></button>
  </nav>
  <MascotHost model={model} visible reduced={status.reduced} placementKey="desktop-capsule" level={()=>0}/>
 </main>;
}
