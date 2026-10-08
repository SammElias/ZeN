import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CompletionGestures} from '../shared/pet';
import type {TaskEvent,Settings} from '../shared/contracts';
import type {RobotPresentation} from '../shared/companion';

/** Decorative timers never change task, microphone or approval state. */
export function usePetPresentation(settings:Settings|undefined,visible:boolean){
  const tracker=useMemo(()=>new CompletionGestures(),[]);
  const [gesture,setGesture]=useState<'wave'|'success'|'thanks'|null>(null);
  const [completion,setCompletion]=useState<{id:string;text:string}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>>(undefined);
  const current=useRef({settings,visible});current.current={settings,visible};
  const perform=useCallback((next:NonNullable<typeof gesture>)=>{
    if(!current.current.visible||current.current.settings?.petSilent)return;
    clearTimeout(timer.current);setGesture(next);timer.current=setTimeout(()=>setGesture(null),1800);
  },[]);
  const accept=useCallback((event:TaskEvent)=>{
    if(tracker.accept(event)&&current.current.visible&&!current.current.settings?.petSilent){
      setCompletion({id:event.id,text:event.message.slice(0,120)||'Puedes revisar el resultado.'});perform('success');
    }
  },[tracker,perform]);
  const greet=useCallback(()=>{if(current.current.settings?.petSilent||!current.current.settings?.petGreeting)return;void window.zen.petGreeting().then(r=>{if(r.ok&&r.value)perform('wave');});},[perform]);
  const clear=useCallback(()=>{clearTimeout(timer.current);setGesture(null);setCompletion(null);},[]);
  useEffect(()=>{if(!visible||settings?.petSilent)clear();return()=>clearTimeout(timer.current);},[visible,settings?.petSilent,clear]);
  return{tracker,gesture,completion,accept,greet,perform,clear,dismiss:()=>setCompletion(null)};
}
export function presentedRobot(real:RobotPresentation,gesture:'wave'|'success'|'thanks'|null,blocked:boolean):RobotPresentation{
  if(!blocked&&gesture==='thanks')return{pose:'success',label:'¡A ti!',hint:'Aquí sigo cuando me necesites.'};
  if(real.pose==='success'&&gesture!=='success')return{...real,pose:'idle'};
  return real;
}
