import {useEffect,useRef,useState} from 'react';
import {availableFace,observedActivity,resolveWardrobe,validateAppearance,validateTone,type MascotTone,type Wardrobe,type ToneMetadata} from '../shared/mascot';
import type {ChatMessage} from '../shared/conversations';
import type {TaskEvent} from '../shared/contracts';

export function useMascot(input:{chatId?:string;message?:ChatMessage;task?:TaskEvent;microphone:boolean;speaking:boolean;visible:boolean;collapsed:boolean;reduced:boolean;wardrobe:'auto'|Wardrobe;walks:boolean;hands?:boolean}){
 const cancelled=useRef(new Set<string>()),[,changed]=useState(0);
 const activity=observedActivity({...input,task:input.task&&cancelled.current.has(input.task.id)?undefined:input.task}),[preview,setPreview]=useState<ToneMetadata>(),[walking,setWalking]=useState(false),[delivery,setDelivery]=useState(false);
 const [controls,setControls]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>(undefined),deliveryTimer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const last=useRef<{chat?:string;id?:string;state?:string}>({}),frozen=useRef<{id?:string;tone:ToneMetadata}>({tone:validateTone(null)});
 const message=input.message;
 // The persisted appearance is frozen per message; streams cannot switch expressions.
 if(last.current.chat!==input.chatId||frozen.current.id!==message?.id)frozen.current={id:message?.id,tone:validateAppearance(message?.appearance,input.chatId??'',message?.id??'').tone};
 const chosen=preview??frozen.current.tone,tone=activity==='error'||input.task?.state==='awaiting_input'?validateTone(null):chosen,wardrobe=resolveWardrobe(chosen.value,input.wardrobe);
 const cancelWalk=()=>{clearTimeout(timer.current);setWalking(false);};
 useEffect(()=>{setPreview(undefined);cancelWalk();setDelivery(false);setControls(false);},[input.chatId]);
 useEffect(()=>{if(input.collapsed||!input.visible){setPreview(undefined);cancelWalk();setDelivery(false);setControls(false);}},[input.collapsed,input.visible]);
 useEffect(()=>{if(activity!=='idle'){setPreview(undefined);cancelWalk();}},[activity,input.task?.id]);
 useEffect(()=>{
  const previous=last.current;last.current={chat:input.chatId,id:message?.id,state:message?.state};
  if(previous.chat===input.chatId&&previous.id===message?.id&&['running','pending'].includes(previous.state??'')&&message?.state==='completed'&&!input.speaking&&input.visible&&!input.reduced){
   setDelivery(true);clearTimeout(deliveryTimer.current);deliveryTimer.current=setTimeout(()=>setDelivery(false),850);
  }
 },[input.chatId,message?.id,message?.state,input.speaking,input.visible,input.reduced]);
 useEffect(()=>{if(input.reduced||!input.walks||!input.visible)cancelWalk();},[input.reduced,input.walks,input.visible]);
 useEffect(()=>()=>{clearTimeout(timer.current);clearTimeout(deliveryTimer.current);},[]);
 return{activity,tone,wardrobe,face:availableFace(tone.value,wardrobe),walking,delivery,hands:!!input.hands,controls,setControls,
  preview:!!preview,previewTone:(value:MascotTone,intensity=tone.intensity)=>setPreview(validateTone({schemaVersion:1,value,intensity,source:'local_rule'})),
  reset:()=>{setPreview(undefined);cancelWalk();},stopMovement:cancelWalk,
  cancelAll:()=>{if(input.task){cancelled.current.add(input.task.id);if(cancelled.current.size>128)cancelled.current.delete(cancelled.current.values().next().value!);}setPreview(undefined);cancelWalk();setDelivery(false);changed(n=>n+1);},
  walk:()=>{if(input.reduced||!input.walks||!input.visible||activity!=='idle')return;cancelWalk();setWalking(true);timer.current=setTimeout(()=>setWalking(false),2400);},
 };
}
export type MascotModel=ReturnType<typeof useMascot>;
