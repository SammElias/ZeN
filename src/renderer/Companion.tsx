import React, { useEffect, useId, useRef } from 'react';
import type { TaskState } from '../shared/contracts';
import {gazeOffset,type CursorPoint} from '../shared/gaze';

// Original ZEN robot, drawn as vectors so the eyes remain crisp in a 40 DIP rail.
export function Companion({ state = 'idle', size = 'small', animated = true }: { state?: TaskState | 'speaking'; size?: 'small' | 'large'; animated?: boolean }) {
  const gaze=useRef<SVGGElement>(null),host=useRef<HTMLSpanElement>(null);
  const id=useId().replace(/:/g,'');
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,disposed=false,point:CursorPoint|null=null;
    const reset=()=>{cancelAnimationFrame(frame);gaze.current?.removeAttribute('transform');};
    const paint=(next:CursorPoint|null)=>{
      point=next;cancelAnimationFrame(frame);
      if(!animated||query.matches||!next){reset();return;}
      frame=requestAnimationFrame(()=>{
        const box=host.current?.getBoundingClientRect();if(!box)return;
        const offset=gazeOffset(next,box);gaze.current?.setAttribute('transform',`translate(${offset.x.toFixed(3)} ${offset.y.toFixed(3)})`);
      });
    };
    const changed=()=>paint(point);query.addEventListener('change',changed);
    // The native bridge also observes positions outside ZEN. DOM fallback is for previews.
    const native=!window.zenDemo&&!!window.zen?.onCursor;
    const move=(event:PointerEvent)=>paint({x:event.clientX,y:event.clientY});
    const leave=()=>paint(null);
    let off:(()=>void)|undefined;
    if(animated){
      if(native){off=window.zen.onCursor(paint);void window.zen.cursor().then(result=>{if(!disposed&&result.ok)paint(result.value);});}
      else{window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);}
    }
    return()=>{disposed=true;off?.();reset();query.removeEventListener('change',changed);window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);};
  },[animated,size]);
  return <span ref={host} className={`zen-companion zen-robot ${size} mood-${state} ${animated?'':'still'}`} aria-hidden="true">
    <svg viewBox="4 4 88 88" focusable="false">
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#faf6ff"/><stop offset=".55" stopColor="#d9cdf9"/><stop offset="1" stopColor="#9c89d4"/></linearGradient>
        <linearGradient id={`${id}-glass`} x2="0" y2="1"><stop stopColor="#303449"/><stop offset="1" stopColor="#141725"/></linearGradient>
      </defs>
      <ellipse className="companion-shadow" cx="48" cy="89" rx="23" ry="3" fill="#c9b6ff" opacity=".12"/>
      <g className="companion-float">
        <path d="M48 24V16" stroke="#ada0d2" strokeWidth="4" strokeLinecap="round"/>
        <circle className="robot-beacon" cx="48" cy="12" r="5" fill="#a5eed6"/>
        <rect x="7" y="41" width="11" height="20" rx="5" fill="#9d8dc8"/>
        <rect x="78" y="41" width="11" height="20" rx="5" fill="#9d8dc8"/>
        <rect className="robot-shell" x="15" y="22" width="66" height="55" rx="20" fill={`url(#${id}-shell)`} stroke="#b9a9e0" strokeWidth="1.5"/>
        <path d="M28 29Q40 25 56 28" stroke="#fff" strokeWidth="2" opacity=".65" fill="none" strokeLinecap="round"/>
        <g className="companion-face">
          <rect className="robot-visor" x="23" y="32" width="50" height="33" rx="12" fill={`url(#${id}-glass)`} stroke="#615d7e"/>
          <g ref={gaze} className="companion-gaze">
            <g className="companion-eyes" fill="#baffeb"><rect x="33" y="40" width="8" height="12" rx="4"/><rect x="55" y="40" width="8" height="12" rx="4"/></g>
            <path className="companion-smile" d="M33 48Q37 41 41 48M55 48Q59 41 63 48" stroke="#baffeb" strokeWidth="3" strokeLinecap="round" fill="none"/>
          </g>
          <path className="robot-mouth" d="M44 56Q48 59 52 56" stroke="#baffeb" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity=".65"/>
        </g>
        <rect x="40" y="78" width="16" height="3" rx="1.5" fill="#9b8abd"/>
        <rect x="33" y="83" width="30" height="4" rx="2" fill="#c9b8ee"/>
      </g>
    </svg>
  </span>;
}
