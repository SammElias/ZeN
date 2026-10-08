import {useEffect,useRef,useState} from 'react';
import {emptyInteractions,guideSteps,type Guide,type Interactions,type VisualReference} from '../shared/interactions';
import type {TaskEvent} from '../shared/contracts';
export function useInteractions(projectId:string|null,records:TaskEvent[],notify:(text:string)=>void){
  const [value,setValue]=useState<Interactions>(emptyInteractions),[ready,setReady]=useState(false),[guideId,setGuideId]=useState<string>(),[setup,setSetup]=useState(false),[goal,setGoal]=useState(''),[suggestion,setSuggestion]=useState<{task?:TaskEvent;guide?:Guide}>();
  const current=useRef(value);current.current=value;
  useEffect(()=>{void window.zen.interactions().then(r=>{if(r.ok){current.current=r.value;setValue(r.value);setReady(true);}else notify(r.error);});},[]);
  const save=(next:Interactions)=>{current.current=next;setValue(next);void window.zen.saveInteractions(next).then(r=>{if(!r.ok)notify('No se pudo guardar el punto de lectura: '+r.error);});};
  const change=(guide:Guide)=>save({...current.current,guides:[...current.current.guides.filter(g=>g.id!==guide.id),guide].slice(-12)});
  const guide=value.guides.find(g=>g.id===guideId&&g.projectId===projectId);
  const create=(goal:string,taskId:string,text:string,visual?:VisualReference,contextAt?:number)=>{const steps=guideSteps(text);if(!steps.length){notify('La respuesta no contiene pasos. Puedes reformular el objetivo.');return;}const next:Guide={id:crypto.randomUUID(),projectId,taskId,goal:goal.slice(0,2000),steps,index:0,status:'active',updatedAt:Date.now(),visual,contextAt};change(next);setGuideId(next.id);setSetup(false);};
  const offer=()=>{if(!ready)return;const tasks=records.filter(t=>(t.projectContextId??null)===projectId&&!['idle','listening'].includes(t.state)&&!['voice','storage','control'].includes(t.id));const task=tasks.at(-1),lastGuide=value.guides.filter(g=>g.projectId===projectId).at(-1);const candidate=lastGuide&&(!task||lastGuide.updatedAt>=(task.updatedAt??0))?{guide:lastGuide}:task?{task}:undefined;const id=candidate?.guide?.id??candidate?.task?.id;setSuggestion(id&&!value.dismissed.includes(id)?candidate:undefined);};
  const dismiss=()=>{const id=suggestion?.guide?.id??suggestion?.task?.id;if(id)save({...current.current,dismissed:[...current.current.dismissed.filter(v=>v!==id),id].slice(-100)});setSuggestion(undefined);};
  return{ready,value,guide,setup,setSetup,goal,setGoal,change,create,offer,suggestion,dismiss,clearSuggestion:()=>setSuggestion(undefined),openGuide:(id:string)=>{setGuideId(id);setSetup(false);setSuggestion(undefined);},exit:()=>{if(guide&&guide.status==='active')change({...guide,status:'paused',updatedAt:Date.now()});setGuideId(undefined);setSetup(false);}};
}
