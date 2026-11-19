import React,{useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {ISLAND_FINISH_MS} from '../shared/island';
import {orbitalPresentation} from '../shared/orbital-presentation';
import {CompanionIcon} from './CompanionActions';
import {ZenStatusMark} from './ZenStatusMark';
import {CapsuleDragGrip, CapsulePin} from './CapsuleMove';
import {CapsulePosition} from './CapsulePosition';
import {CapsuleNavigation, type ActivateSection} from './CapsuleNavigation';

const labels={idle:'ZEN',working:'Trabajando',attention:'Permiso',finished:'Terminado',error:'Error',paused:'En pausa'};

export function DynamicIsland({status,ready,open,onActivate,onError,error}:{status:CompanionStatus;ready:boolean;open:()=>void;onActivate:ActivateSection;onError:(error:string)=>void;error?:string}) {
 const {state}=orbitalPresentation(status);
 const finishedAt=status.notices.find(n=>n.kind==='finished'&&!n.read)?.at;
 const [expired,setExpired]=useState<number>();
 useEffect(()=>{
  if(!finishedAt)return;
  const timeout=setTimeout(()=>setExpired(finishedAt),Math.max(0,finishedAt+ISLAND_FINISH_MS-Date.now()));
  return ()=>clearTimeout(timeout);
 },[finishedAt]);
 const visual=state==='paused'?'paused':state==='approval'?'attention':error||status.notices.some(n=>n.kind==='error'&&!n.read)?'error':
  state==='thinking'||state==='working'?'working':
  state==='finished'&&finishedAt!==undefined&&expired!==finishedAt&&Date.now()<finishedAt+ISLAND_FINISH_MS?'finished':'idle';
 const label=labels[visual];
 const expanded=status.workspace?.expanded===true;
 const action=expanded?'Ocultar panel':'Abrir última sección';
 const lastPhase=useRef(visual);
 const [flash,setFlash]=useState(false);
 useEffect(()=>{
  setFlash(visual==='finished'&&['working','attention'].includes(lastPhase.current));
  lastPhase.current=visual;
 },[visual]);
 return <div className="zen-island-shell" data-stacked={status.workspace?.islandStacked===true}>
  <div className="zen-island-navigation">
  <button type="button" className="zen-island-trigger" data-phase={visual} data-flash={flash}
   aria-label={label+' · '+action} aria-expanded={expanded} aria-controls="capsule-content" title={error??label+' · '+action+' · Clic derecho para opciones'} disabled={!ready}
   onContextMenu={event=>{event.preventDefault();void window.companion.capsuleLocationMenu();}}
   onKeyDown={event=>{
    if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){
     event.preventDefault();
     void window.companion.capsuleLocationMenu();
     return;
    }
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    if(!event.repeat)open();
   }}
   onClick={open}>
  <ZenStatusMark status={status} ready={ready}/>
  <span role="status" className="zen-island-label">{label}</span>
  {error&&<span role="alert" className="zen-island-label">{error}</span>}
  <span aria-hidden="true" className="zen-island-signal" onAnimationEnd={()=>setFlash(false)}>
   {visual==='finished'?<CompanionIcon name="check"/>:visual==='attention'||visual==='error'?<b>!</b>:<i/>}
  </span>
  </button>
  <CapsuleNavigation status={status} ready={ready} compact onActivate={onActivate} onError={onError}/>
  </div>
  <div className="zen-island-controls">
   <CapsulePosition location={status.workspace?.location} ready={ready}/>
   <CapsulePin locked={status.settings.windowLocked} ready={ready} onError={onError}/>
   <CapsuleDragGrip workspace={false} locked={status.settings.windowLocked}/>
  </div>
 </div>;
}
