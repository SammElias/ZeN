import React,{useRef,useState} from 'react';
import {mascotDirection} from '../shared/gaze';
import {useMascotCursor} from './useMascotCursor';

/** One pose, two compositing regions: torso behind the title, fingers in front.
 * Both regions share one transparent source, so their perspective stays aligned. */
export function MascotWelcome({animated,geometryKey}:{animated:boolean;geometryKey:string}){
 const [failed,setFailed]=useState(false),frame=useRef<HTMLDivElement>(null),gaze=useRef<HTMLDivElement>(null);
 useMascotCursor(animated,point=>{
  const el=gaze.current,box=frame.current?.getBoundingClientRect();if(!el)return;
  if(!point||!box){el.style.transform='';return;}
  const d=mascotDirection(point,{x:box.left+box.width*.5,y:box.top+box.height*.4});
  el.style.transform=`translate(${d.x*3}px,${d.y*2}px) rotate(${d.x*4}deg)`;
 },geometryKey+':'+failed);
 if(failed)return <img className="welcome-fallback" src="./mascot/head.png" alt=""/>;
 return <>
  <div ref={frame} className="welcome-art welcome-art-back"><div ref={gaze} className="welcome-gaze"><img src="./mascot/welcome-leaning.png" alt="" draggable={false} onError={()=>setFailed(true)}/></div></div>
  <div className="welcome-art welcome-art-hands" aria-hidden="true"><img src="./mascot/welcome-leaning.png" alt="" draggable={false}/></div>
 </>;
}
