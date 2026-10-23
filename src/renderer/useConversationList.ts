import {useEffect,useRef,useState} from 'react';
import type {ChatRow,ConversationCommand,ConversationReply} from '../shared/conversations';

const PAGE_SIZE=40;
type ListState={project:string|null;rows:ChatRow[];offset:number;more:boolean;loading:boolean;error:string};
const empty=(project:string|null):ListState=>({project,rows:[],offset:0,more:true,loading:false,error:''});
const ordered=(rows:ChatRow[])=>Array.from(new Map(rows.map(row=>[row.id,row])).values()).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));

export function useConversationList(visible:boolean,project:string|null,revision:number,call:(command:ConversationCommand)=>Promise<ConversationReply>){
 const [state,setState]=useState(()=>empty(project)),current=useRef(state),generation=useRef(0),latest=useRef({call,project,visible});
 latest.current={call,project,visible};
 const publish=(value:ListState)=>{current.current=value;setState(value);};
 const refresh=async()=>{
  const stamp=++generation.current;
  if(current.current.project!==project)publish(empty(project));
  if(!visible){publish({...current.current,loading:false});return;}
  // Refresh the loaded range together so new activity cannot leave gaps between pages.
  const count=Math.max(PAGE_SIZE,current.current.offset);
  publish({...current.current,loading:true,error:''});
   try{
    let rows:ChatRow[]=[],offset=0,more=true;
    while(offset<count&&more){
     const reply=await latest.current.call({action:'list',projectId:project,filter:'all',query:'',offset});
     if(stamp!==generation.current)return;
     const page=reply.rows??[];rows.push(...page);offset+=page.length;more=page.length===PAGE_SIZE;
    }
    publish({project,rows:ordered(rows),offset,more,loading:false,error:''});
   }catch(error){if(stamp===generation.current)publish({...current.current,loading:false,error:error instanceof Error?error.message:'No se pudieron cargar las conversaciones.'});}
 };
 const refreshLatest=useRef(refresh);refreshLatest.current=refresh;
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),lastRevision=useRef(revision);
 useEffect(()=>{
  void refreshLatest.current();
  return()=>{++generation.current;clearTimeout(timer.current);timer.current=undefined;};
 },[visible,project]);
 useEffect(()=>{
  if(revision===lastRevision.current)return;lastRevision.current=revision;
  if(!visible||timer.current)return;
  // Throttle live updates: streaming must not keep postponing the first load.
  timer.current=setTimeout(()=>{timer.current=undefined;void refreshLatest.current();},250);
 },[revision,visible]);
 const loadMore=async()=>{
  const before=current.current;
  if(!latest.current.visible||before.project!==latest.current.project||before.loading||!before.more||before.error)return;
  const stamp=generation.current;
  publish({...before,loading:true});
  try{
   const reply=await latest.current.call({action:'list',projectId:before.project,filter:'all',query:'',offset:before.offset});
   if(stamp!==generation.current)return;
   const page=reply.rows??[];
   publish({...before,rows:ordered([...before.rows,...page]),offset:before.offset+page.length,more:page.length===PAGE_SIZE,loading:false});
  }catch(error){if(stamp===generation.current)publish({...before,loading:false,error:error instanceof Error?error.message:'No se pudieron cargar más conversaciones.'});}
 };
 return{...state,loadMore,refresh};
}
