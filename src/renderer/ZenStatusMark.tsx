import React,{useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {orbitalPresentation} from '../shared/orbital-presentation';
import {ZenEmblem} from './ZenEmblem';

export function ZenStatusMark({status,ready}:{status:CompanionStatus;ready:boolean}){
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
 return <span className="zen-status-mark" aria-hidden="true" data-phase={state} data-visible={visible} data-finish-flash={flash} data-trace-count={steps} onAnimationEnd={e=>{if(e.animationName==='zen-mark-finished')setFlash(false);}}>
  <ZenEmblem/>
  {steps>0&&<span className="zen-status-trace">{[0,1,2].map(i=><i key={i} data-received={i<steps}/>)}</span>}
 </span>;
}
