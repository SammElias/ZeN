import type { TaskEvent } from '../shared/contracts';
import type { Activity } from '../shared/activity';

export type ActivityStep = {activity:Activity; sequence:number};
export type ActivityTrail = {id:string; state:TaskEvent['state']; steps:ActivityStep[]};
export function taskActivity(event:TaskEvent):Activity|null {
  // Terminal/attention states always override stale progress metadata.
  switch(event.state) {
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'cancelled': return 'cancelled';
    case 'awaiting_approval': return 'approval';
    case 'awaiting_input': return 'input';
    case 'idle': case 'listening': return null;
    default: return event.activity ?? (event.streamText ? 'writing' : event.state==='queued' ? 'queued' : event.state==='executing' ? 'executing' : 'thinking');
  }
}
export function advanceActivity(previous:ActivityTrail|undefined,event:TaskEvent):ActivityTrail|undefined {
  if (['voice','storage','control'].includes(event.id)||event.utterance||event.screenContext||event.contextConsumed) return previous;
  const activity=taskActivity(event); if(!activity)return previous;
  const same=previous?.id===event.id;
  // A late delta cannot resurrect a finished task.
  if(same&&['completed','failed','cancelled'].includes(previous.state)&&!['completed','failed','cancelled'].includes(event.state))return previous;
  const last=same?previous.steps.at(-1):undefined;
  if(last?.activity===activity&&previous?.state===event.state)return previous;
  const steps=last?.activity===activity?previous!.steps:[...(same?previous.steps:[]),{activity,sequence:(last?.sequence??0)+1}].slice(-24);
  return {id:event.id,state:event.state,steps};
}

/** Bounded, ephemeral UI data; no transcripts, screenshots or disk persistence. */
export class ActivityStore {
  private trails=new Map<string,ActivityTrail>();
  private listeners=new Set<()=>void>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  get=(id:string)=>this.trails.get(id);
  accept(event:TaskEvent){
    const previous=this.trails.get(event.id),next=advanceActivity(previous,event);
    if(!next||next===previous)return;
    this.trails.set(event.id,next);
    if(this.trails.size>24)this.trails.delete(this.trails.keys().next().value!);
    this.listeners.forEach(listener=>listener());
  }
}
