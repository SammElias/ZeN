import React,{useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {orbitalPresentation} from '../shared/orbital-presentation';

const asset=(name:string)=>'./icons/orbital/'+name+'.svg';
/** Original Figma assets at their native geometry; CSS moves wrappers, never rewrites SVGs. */
export function OrbitalMark({status,ready}:{status:CompanionStatus;ready:boolean}){
 const {state,steps,runKey}=orbitalPresentation(status);
 const [visible,setVisible]=useState(!document.hidden),[flash,setFlash]=useState(false);
 const seen=useRef<{ready:boolean;state:string;runKey?:string}>({ready:false,state});
 const finishedRuns=useRef(new Set<string>());
 useEffect(()=>{const sync=()=>{setVisible(!document.hidden);if(document.hidden)setFlash(false);};document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync);},[]);
 useEffect(()=>{
  const old=seen.current;
  const firstEnd=!!runKey&&!finishedRuns.current.has(runKey);
  if(ready&&state==='finished'&&runKey){finishedRuns.current.add(runKey);if(finishedRuns.current.size>128)finishedRuns.current.delete(finishedRuns.current.values().next().value!);}
  // A restored finished state is not a new completion. Only animate a transition received while visible.
  const completed=ready&&old.ready&&firstEnd&&status.settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&state==='finished'&&!document.hidden;
  seen.current={ready,state,runKey};setFlash(completed);
 },[ready,state,runKey,status.settings.motion]);
 return <span className="zen-mark orbital-mark" aria-hidden="true" data-orbital-state={state} data-visible={visible} data-finish-flash={flash} data-trace-count={steps} onAnimationEnd={e=>{if(e.animationName==='orbital-finished')setFlash(false);}}>
  <span className="orbital-canvas">
   {state==='thinking'?<span className="orbital-geometry orbital-thinking">
    <img className="orbital-front" src={asset('front')} alt="" draggable={false}/>
    <img className="orbital-back" src={asset('back')} alt="" draggable={false}/>
    <span className="orbital-core"><img src={asset('core')} alt="" draggable={false}/></span>
    <img className="orbital-satellite" src={asset('satellite')} alt="" draggable={false}/>
   </span>:<span className={'orbital-geometry orbital-'+state}><img src={asset(state)} alt="" draggable={false}/></span>}
   {steps>0&&<span className="orbital-trace">{[0,1,2].map(i=><i key={i} data-received={i<steps}/>)}</span>}
  </span>
 </span>;
}
