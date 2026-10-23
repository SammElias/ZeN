import {useEffect,useLayoutEffect,useRef} from 'react';
import type {CursorPoint} from '../shared/gaze';

/** One read-only desktop subscription, independent of focus and task state. */
export function useMascotCursor(active:boolean,paint:(point:CursorPoint|null)=>void,geometryKey:string){
 const draw=useRef(paint),point=useRef<CursorPoint|null>(null);draw.current=paint;
 useLayoutEffect(()=>{draw.current(active?point.current:null);},[active,geometryKey]);
 useEffect(()=>{
  if(!active){point.current=null;draw.current(null);return;}
  let disposed=false,received=false,last=-Infinity;
  const update=(value:CursorPoint|null)=>{received=true;point.current=value;draw.current(value);};
  const move=(event:PointerEvent)=>{if(performance.now()-last<50)return;last=performance.now();update({x:event.clientX,y:event.clientY});};
  let off:(()=>void)|undefined;
  if(!window.zenDemo&&window.zen?.onCursor){
   off=window.zen.onCursor(update);
   void window.zen.cursor().then(r=>{if(!disposed&&!received&&r.ok)update(r.value);}).catch(()=>{});
  }else window.addEventListener('pointermove',move,{passive:true});
  return()=>{disposed=true;off?.();window.removeEventListener('pointermove',move);point.current=null;draw.current(null);};
 },[active]);
}
