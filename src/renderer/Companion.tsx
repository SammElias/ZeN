import {CompanionContext} from './CompanionContext';
import {nearbyGaze} from '../shared/pet';
import React, { useContext, useEffect, useId, useRef } from 'react';
import type { TaskState } from '../shared/contracts';
import {gazeOffset,type CursorPoint} from '../shared/gaze';
import type {RobotPose} from '../shared/companion';

// Original vector robot: local gestures and cursor gaze, independent of model output.
export function Companion({ state = 'idle', size = 'small', animated = true,pose='idle',wave=false,variant='full',handGesture=null }: { state?: TaskState | 'speaking'; size?: 'small' | 'large'; animated?: boolean;pose?:RobotPose;wave?:boolean;variant?:'full'|'head';handGesture?:'wave'|'permission'|'receive'|'success'|null }) {
  const shared=useContext(CompanionContext);
  if(shared){animated=animated&&shared.animated;pose=shared.presentation.pose;wave=shared.gesture==='wave';}
  const gaze=useRef<SVGGElement>(null),headGaze=useRef<SVGGElement>(null),host=useRef<HTMLSpanElement>(null);
  const id=useId().replace(/:/g,'');
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');let disposed=false,point:CursorPoint|null=null,lastPointer=0;
    const reset=()=>{if(gaze.current)gaze.current.style.transform='translate(0px,0px)';if(headGaze.current)headGaze.current.style.transform='translate(0px,0px) rotate(0deg)';};
    const paint=(next:CursorPoint|null)=>{
      point=next;
      if(!animated||(!shared&&query.matches)||!next){reset();return;}
      {
        const box=host.current?.getBoundingClientRect();if(!box||!box.width||!box.height||(variant!=='head'&&!nearbyGaze(next,box))){reset();return;}
        const offset=gazeOffset(next,box);
        // SVG units: keep the eyes inside the visor and the head inside its fixed slot.
        if(gaze.current)gaze.current.style.transform=`translate(${(offset.x*(variant==='head'?1.5:1)).toFixed(3)}px,${offset.y.toFixed(3)}px)`;
        if(headGaze.current)headGaze.current.style.transform=variant==='head'?`translate(${(offset.x*4/3).toFixed(3)}px,${offset.y.toFixed(3)}px) rotate(${(offset.x*5/3).toFixed(3)}deg)`:'none';
      }
    };
    const changed=()=>paint(point);query.addEventListener('change',changed);
    // The native bridge also observes positions outside ZEN. DOM fallback is for previews.
    const native=!window.zenDemo&&!!window.zen?.onCursor;
    const move=(event:PointerEvent)=>{if(performance.now()-lastPointer<50)return;lastPointer=performance.now();paint({x:event.clientX,y:event.clientY});};
    const leave=()=>paint(null);
    let off:(()=>void)|undefined;
    if(animated){
      if(native){off=window.zen.onCursor(paint);void window.zen.cursor().then(result=>{if(!disposed&&result.ok)paint(result.value);});}
      else{window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);}
    }
    return()=>{disposed=true;off?.();reset();query.removeEventListener('change',changed);window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);};
  },[animated,size,variant,shared?.motion]);
  return <span ref={host} className={`zen-companion zen-robot ${size} robot-${variant} hands-${handGesture??'none'} ${shared?.motion!=='reduced'&&shared?'motion-explicit':''} mood-${state} pose-${pose} ${wave?'robot-waving':''} ${shared?.drop?'drop-attention':''} ${animated?'':'still'}`} data-pose={pose} aria-hidden="true">
    <svg viewBox={variant==='head'?'-14 0 156 100':'0 0 128 144'} focusable="false">
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#faf6ff"/><stop offset=".55" stopColor="#d9cdf9"/><stop offset="1" stopColor="#9c89d4"/></linearGradient>
        <linearGradient id={`${id}-glass`} x2="0" y2="1"><stop stopColor="#303449"/><stop offset="1" stopColor="#141725"/></linearGradient>
      </defs>
      {variant==='full'&&<ellipse className="companion-shadow" cx="64" cy="138" rx="31" ry="4" fill="#c9b6ff" opacity=".13"/>}
      <g className="companion-float">
        {variant==='full'&&<g className="robot-body">
          <rect x="42" y="124" width="18" height="9" rx="4.5" fill="#b9a6e3"/><rect x="68" y="124" width="18" height="9" rx="4.5" fill="#b9a6e3"/>
          <rect x="40" y="84" width="48" height="42" rx="17" fill={`url(#${id}-shell)`} stroke="#b9a9e0" strokeWidth="1.5"/>
          <path d="M53 89h22" stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round"/>
          <rect x="51" y="96" width="26" height="19" rx="8" fill="#343248"/>
          <path className="robot-heart" d="M64 109l-5-4c-4-4 2-8 5-4 3-4 9 0 5 4z" fill="#a5eed6"/>
        </g>}
        {variant==='full'&&shared?.accessory==='bow'&&<g aria-hidden="true" fill="#a5eed6" stroke="#438b83" strokeWidth=".8"><path d="M63 89l-10-4v10l10-4 12 4V85z"/><circle cx="64" cy="90" r="2.5"/></g>}
        <g ref={headGaze} className="companion-head-gaze"><g className="robot-head">
        <path d="M64 29V16" stroke="#ada0d2" strokeWidth="4" strokeLinecap="round"/>
        <circle className="robot-beacon" cx="64" cy="11" r="5" fill="#a5eed6"/>
        <rect x="14" y="48" width="12" height="23" rx="6" fill="#9d8dc8"/><rect x="102" y="48" width="12" height="23" rx="6" fill="#9d8dc8"/>
        <rect className="robot-shell" x="22" y="27" width="84" height="62" rx="24" fill={`url(#${id}-shell)`} stroke="#b9a9e0" strokeWidth="1.5"/>
        <path d="M38 34Q52 30 76 33" stroke="#fff" strokeWidth="2.5" opacity=".65" fill="none" strokeLinecap="round"/>
        <g className="companion-face">
          <rect className="robot-visor" x="32" y="40" width="64" height="37" rx="14" fill={`url(#${id}-glass)`} stroke="#615d7e"/>
          <g ref={gaze} className="companion-gaze">
            <g className="companion-eyes" fill="#baffeb"><rect x="44" y="49" width="9" height="14" rx="4.5"/><rect x="75" y="49" width="9" height="14" rx="4.5"/></g>
            <path className="companion-smile" d="M44 58Q48.5 49 53 58M75 58Q79.5 49 84 58" stroke="#baffeb" strokeWidth="3" strokeLinecap="round" fill="none"/>
          </g>
          <path className="robot-mouth" d="M59 68Q64 73 69 68" stroke="#baffeb" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".75"/>
        </g>
        </g></g>
        {variant==='full'&&<><g className="robot-arm arm-left">
          <path d="M42 95Q29 96 23 108" fill="none" stroke="#a597c8" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="40" cy="95" r="5" fill="#dbcef3"/>
          <g className="robot-hand"><path d="M17 104c-2-3-5-1-4 2l2 7c-5-3-7 1-4 4l7 7c3 3 10 2 12-2l2-8c1-3-3-4-4-1l-1-8c0-4-4-4-4 0l-1-3c-1-4-5-3-4 1z" fill={`url(#${id}-shell)`} stroke="#9c8abe" strokeWidth="1.4"/><path d="M19 110l2 7m3-8 1 7" stroke="#a493c7" strokeWidth="1.2" strokeLinecap="round"/></g>
        </g>
        <g className="robot-arm arm-right">
          <path d="M86 95q13 1 19 13" fill="none" stroke="#a597c8" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="88" cy="95" r="5" fill="#dbcef3"/>
          <g className="robot-hand"><path d="M111 104c2-3 5-1 4 2l-2 7c5-3 7 1 4 4l-7 7c-3 3-10 2-12-2l-2-8c-1-3 3-4 4-1l1-8c0-4 4-4 4 0l1-3c1-4 5-3 4 1z" fill={`url(#${id}-shell)`} stroke="#9c8abe" strokeWidth="1.4"/><path d="M109 110l-2 7m-3-8-1 7" stroke="#a493c7" strokeWidth="1.2" strokeLinecap="round"/></g>
          <g className="robot-loupe"><path d="M105 113v-11" stroke="#80cdb8" strokeWidth="4" strokeLinecap="round"/><circle cx="105" cy="94" r="10" fill="#233d45" fillOpacity=".92" stroke="#a9ebdc" strokeWidth="3"/><path d="M101 91q3-4 7-1" fill="none" stroke="#fff" opacity=".5" strokeLinecap="round"/></g>
        </g>
        <g className="robot-keyboard"><rect x="33" y="121" width="62" height="12" rx="4" fill="#343347" stroke="#9282b1"/><path d="M40 125h4m4 0h4m4 0h4m4 0h4m4 0h4m4 0h6M46 129h32" stroke="#cbbcee" strokeWidth="1.5" strokeLinecap="round"/></g></>}
      </g>
      {variant==='head'&&handGesture&&<g className="head-hands" fill={`url(#${id}-shell)`} stroke="#9c8abe" strokeWidth="1.4" pointerEvents="none">
        {handGesture==='receive'&&<g transform="translate(-24 -22) scale(.9)"><g className="head-hand left-hand"><path d="M17 104c-2-3-5-1-4 2l2 7c-5-3-7 1-4 4l7 7c3 3 10 2 12-2l2-8c1-3-3-4-4-1l-1-8c0-4-4-4-4 0l-1-3c-1-4-5-3-4 1z"/></g></g>}
        <g transform="translate(34 -22) scale(.9)"><g className="head-hand right-hand"><path d={handGesture==='success'?'M98 120v-12h6l2-9c1-4 6-3 5 1l-1 7h6c3 0 4 2 3 5l-3 10h-16z':'M111 104c2-3 5-1 4 2l-2 7c5-3 7 1 4 4l-7 7c-3 3-10 2-12-2l-2-8c-1-3 3-4 4-1l1-8c0-4 4-4 4 0l1-3c1-4 5-3 4 1z'}/></g></g>
      </g>}
    </svg>
  </span>;
}
