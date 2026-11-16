import React,{useRef,useState} from 'react';
import {CapsuleLocation} from '../shared/workspace-layout';

const positions={
 top:{label:'Arriba',x:5,y:5,w:14,h:3},
 left:{label:'Izquierda',x:5,y:5,w:3,h:10},
 right:{label:'Derecha',x:16,y:5,w:3,h:10},
 floating:{label:'Flotante',x:8,y:8,w:8,h:5},
} as const;

export function CapsulePosition({location,ready,cards=false}:{location:CapsuleLocation|undefined;ready:boolean;cards?:boolean}) {
 const intent=useRef(0);
 const [failure,setFailure]=useState<{position:CapsuleLocation;message:string}>();
 async function select(position:CapsuleLocation) {
  const request=++intent.current;
  setFailure(undefined);
  try{
   const result=await window.companion.capsuleLocation(position);
   if(request===intent.current&&!result.ok)setFailure({position,message:result.error});
  }catch{
   if(request===intent.current)setFailure({position,message:'No se pudo cambiar la ubicación de ZEN.'});
  }
 }
 return <div className={cards?'capsule-position preference-positions':'capsule-position'} data-capsule-block={cards?undefined:'position'} role="group" aria-label="Ubicación de ZEN">
  {CapsuleLocation.options.map(position=>{
   const {label,x,y,w,h}=positions[position];
   const error=failure?.position===position?failure.message:undefined;
   return <button type="button" key={position} data-position={position} data-error={!!error} disabled={!ready}
     aria-label={label} aria-pressed={location===position} title={error?`${label} · ${error}`:label}
     onClick={()=>void select(position)}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
     <rect x="3" y="3" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
     <rect x={x} y={y} width={w} height={h} rx="1" fill="currentColor"/>
     <path d="M9 20h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/>
    </svg>
    {cards&&<span>{label}</span>}
   </button>;
  })}
  {failure&&<span className="capsule-position-error" role="alert">{failure.message}</span>}
 </div>;
}
