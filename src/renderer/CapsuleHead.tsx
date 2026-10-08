import React,{useContext,useEffect,useRef,useState} from 'react';
import {Companion} from './Companion';
import {CompanionContext} from './CompanionContext';
import type {TaskState} from '../shared/contracts';

/** Local decoration only. Permission identities and completion events come from the task store. */
export function CapsuleHead({state,permissionKey,canReceive,enabled,blocked}:{state:TaskState|'speaking';permissionKey:string;canReceive:boolean;enabled:boolean;blocked:boolean}){
  const shared=useContext(CompanionContext);
  const [brief,setBrief]=useState<'wave'|'permission'|null>(null),[receiving,setReceiving]=useState(false);
  const hover=useRef<ReturnType<typeof setTimeout>>(undefined),timer=useRef<ReturnType<typeof setTimeout>>(undefined),lastWave=useRef(-Infinity),seen=useRef(new Set<string>());
  const clearHover=()=>clearTimeout(hover.current);
  const show=(value:'wave'|'permission')=>{clearTimeout(timer.current);setBrief(value);timer.current=setTimeout(()=>setBrief(null),1600);};
  useEffect(()=>{if(permissionKey&&!seen.current.has(permissionKey)){seen.current.add(permissionKey);if(seen.current.size>100)seen.current.delete(seen.current.values().next().value!);if(enabled)show('permission');}if(!permissionKey)setBrief(value=>value==='permission'?null:value);},[permissionKey,enabled]);
  useEffect(()=>{if(!enabled){clearHover();clearTimeout(timer.current);setBrief(null);setReceiving(false);}return()=>{clearHover();clearTimeout(timer.current);};},[enabled]);
  const receive=(event:React.DragEvent)=>{const files=Array.from(event.dataTransfer.items).filter(item=>item.kind==='file');setReceiving(canReceive&&files.length>0&&files.every(item=>!item.type||/^(image\/(png|jpeg|webp)|text\/|application\/(pdf|json|vnd\.openxmlformats-officedocument))/.test(item.type)));};
  const gesture=enabled?(receiving?'receive':brief==='permission'?'permission':blocked?null:shared?.gesture==='success'?'success':brief??(shared?.gesture==='wave'?'wave':null)):null;
  return <span className="capsule-character" onPointerEnter={()=>{clearHover();if(enabled&&!blocked&&performance.now()-lastWave.current>20000)hover.current=setTimeout(()=>{lastWave.current=performance.now();show('wave');},650);}} onPointerLeave={clearHover} onPointerDown={()=>{clearHover();setBrief(null);}} onDragEnter={receive} onDragOver={receive} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setReceiving(false);}} onDrop={()=>setReceiving(false)}>
    <Companion state={state} variant="head" handGesture={gesture}/>
  </span>;
}
