import React,{useEffect,useId,useRef,useState} from 'react';
import type {MascotModel} from './useMascot';
import {mascotDirection} from '../shared/gaze';
import type {MascotTone} from '../shared/mascot';
import {bodyArtwork} from './mascot-artwork';
import {useMascotCursor} from './useMascotCursor';

const head='./mascot/head.png',atlas='./mascot/expressions.png',hands='./mascot/head-hands.png';
const faces:Record<Exclude<MascotTone,'neutral'>,string>={smug:'156 178 388 340',confident:'717 184 386 334',sad_empathic:'157 751 407 367',playful_cocky:'718 779 389 320'};

/** Texture-preserving 2D presentation. The source artwork is never repainted.
 * Only the short explicit walk separates overlapping leg regions at local pivots. */
export function MascotRig({model,full,animated,level,geometryKey}:{model:MascotModel;full:boolean;animated:boolean;level:()=>number;geometryKey:string}){
 const id=useId().replace(/:/g,''),host=useRef<SVGSVGElement>(null),gaze=useRef<SVGGElement>(null),bodyGaze=useRef<SVGGElement>(null),[failed,setFailed]=useState(false);
 const art=bodyArtwork[model.wardrobe],body=full&&!failed,[x,y,w,h]=art.box,neck=y+h*art.neck,hip=y+h*art.hip,knee=y+h*art.knee,split=x+w*art.split,overlap=h*.012,collar=h*.025;
 const scale=276/h,drawWidth=w*scale,face=failed?'neutral':model.face;
 const uri=(part:string)=>`url(#${id}-${part})`;
 const original=()=> <image className="mascot-original" href={art.src} width={art.width} height={art.height} onError={()=>setFailed(true)}/>;
 useEffect(()=>{setFailed(false);},[art.src]);
 useEffect(()=>{for(const src of [head,atlas,hands,...new Set(Object.values(bodyArtwork).map(a=>a.src))]){const i=new Image();i.src=src;void i.decode().catch(()=>{});}},[]);
 useMascotCursor(animated,point=>{
  const el=gaze.current,svg=host.current,matrix=svg?.getScreenCTM();if(!el)return;
  if(!point||!svg||!matrix){el.style.transform='';if(bodyGaze.current)bodyGaze.current.style.transform='';return;}
  const face=svg.createSVGPoint();face.x=body?90:80;face.y=body?8+276*art.neck*.64:60;
  const direction=mascotDirection(point,face.matrixTransform(matrix)),dx=direction.x,dy=direction.y;
  el.style.transform=`translate(${dx*(body?w*.018:8)}px,${dy*(body?h*.008:5)}px) rotate(${dx*(body?5:10)}deg)`;
  if(bodyGaze.current)bodyGaze.current.style.transform=`translate(${dx*1.5}px,0px) rotate(${dx}deg)`;
 },geometryKey+':'+body+':'+model.wardrobe);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  if(!animated||model.activity!=='speaking'){el.style.setProperty('--audio-level','0');return;}
  let smoothed=0;const timer=setInterval(()=>{const raw=level();smoothed=raw<.008?0:smoothed*.55+Math.min(1,raw*8)*.45;el.style.setProperty('--audio-level',String(smoothed));},50);
  return()=>{clearInterval(timer);el.style.setProperty('--audio-level','0');};
 },[animated,model.activity,level]);
 const showHands=!body&&(model.activity!=='idle'||model.delivery||model.hands);
 return <svg ref={host} className={`mascot-rig original-artwork outfit-${model.wardrobe} activity-${model.activity} ${animated?'animated':'static'} ${model.walking?'walking':''} ${model.delivery?'delivering':''}`} viewBox={body?'0 0 180 292':'0 0 160 130'} aria-hidden="true" data-face={face} data-rig={body?'original-textured-2d':'original-head'} data-artwork={body?art.src:head} style={{'--gesture-strength':.3+model.tone.intensity*.7} as React.CSSProperties}>
  {body?<>
   <defs>
    <clipPath id={`${id}-frame`}><rect x={x} y={y} width={w} height={h}/></clipPath>
    <linearGradient id={`${id}-collar`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={neck-collar} y2={neck+collar}><stop offset="0" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient>
    <mask id={`${id}-head`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={neck-y+collar}><rect x={x} y={y} width={w} height={neck-y+collar} fill={uri('collar')}/></mask>
    <clipPath id={`${id}-torso`}><rect x={x} y={neck-collar} width={w} height={h}/></clipPath>
    <clipPath id={`${id}-upper`}><rect x={x} y={neck-collar} width={w} height={hip-neck+collar+overlap}/></clipPath>
    {(['left','right'] as const).map(side=>{const start=side==='left'?x:split,width=side==='left'?split-x:x+w-split;return <React.Fragment key={side}>
     <clipPath id={`${id}-${side}-thigh`}><rect x={start} y={hip} width={width} height={knee-hip+overlap}/></clipPath>
     <clipPath id={`${id}-${side}-shin`}><rect x={start} y={knee} width={width} height={y+h-knee}/></clipPath>
    </React.Fragment>;})}
   </defs>
   <g className="mascot-travel"><g ref={bodyGaze} className="mascot-body-gaze"><g transform={`translate(${90-drawWidth/2} 8) scale(${scale}) translate(${-x} ${-y})`}>
    <g className="mascot-torso-bob">
     {model.walking&&animated?<>
      {(['left','right'] as const).map(side=><g key={side} className={`mascot-thigh ${side}`} style={{transformOrigin:`${x+w*(side==='left'?.34:.69)}px ${hip}px`}}>
       <g clipPath={uri(`${side}-thigh`)}>{original()}</g>
       <g className={`mascot-shin ${side}`} style={{transformOrigin:`${x+w*(side==='left'?.30:.72)}px ${knee}px`}}><g clipPath={uri(`${side}-shin`)}>{original()}</g></g>
      </g>)}
      <g clipPath={uri('upper')}>{original()}</g>
     </>:<g clipPath={uri('frame')}><g clipPath={uri('torso')}>{original()}</g></g>}
     <g ref={gaze} className="mascot-head-gaze" style={{transformOrigin:`${x+w*.52}px ${neck}px`}}><g className="mascot-head-nod" style={{transformOrigin:`${x+w*.52}px ${neck}px`}}><g mask={uri('head')}>{original()}</g></g></g>
    </g>
   </g></g></g>
  </>:<>
   <g ref={gaze} className="mascot-head-gaze"><g className="mascot-head-nod">
    <svg x="24" y="1" width="112" height="112" viewBox={face==='neutral'?'36 56 1218 1142':faces[face]} preserveAspectRatio="xMidYMax meet" overflow="hidden"><image href={face==='neutral'?head:atlas} width="1254" height="1254" onError={()=>setFailed(true)}/></svg>
   </g></g>
   {showHands&&<g className="mascot-compact-hands">
    <svg x="4" y="88" width="32" height="30" viewBox="98 929 273 252"><image href={hands} width="1254" height="1254"/></svg>
    <svg x="124" y="88" width="32" height="30" viewBox="879 944 277 238"><image href={hands} width="1254" height="1254"/></svg>
   </g>}
  </>}
 </svg>;
}
