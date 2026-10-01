import type { Artifact, TaskEvent, Utterance } from '../shared/contracts';
export type LatestMessage = { speaker: 'user' | 'zen'; text: string; provisional: boolean; key: string; endMs?:number };
export type LatestState = { message?: LatestMessage; user?: { id: string; text: string; done: boolean }; taskId?: string; sourceText?: string;artifacts?:Artifact[];captionEnd?:number;captionStart?:number;waitingForLiveUser?:boolean };
export function beginLiveSession(previous:LatestState={}):LatestState{return {message:previous.message,sourceText:previous.sourceText,artifacts:previous.artifacts,waitingForLiveUser:true};}
export function latestUtterance(state: LatestState, event: Utterance): LatestState {
  if (event.timeline) {
    if (state.captionEnd !== undefined && (event.timeline.endMs < state.captionEnd || event.timeline.endMs===state.captionEnd&&event.timeline.startMs<(state.captionStart??0))) return state;
    return { ...(event.speaker==='user'?{user:{id:event.id,text:event.text,done:true},waitingForLiveUser:false}:state),captionEnd:event.timeline.endMs,captionStart:event.timeline.startMs, message:{speaker:event.speaker,text:event.text,provisional:true,key:event.id,endMs:event.timeline.endMs} };
  }
  if (event.speaker === 'user') {
    if (event.phase !== 'start' && state.user && state.user.id !== event.id) return state;
    if (state.user?.id === event.id && state.user.done) return state;
    const user = { id: event.id, text: event.text, done: event.phase === 'done' };
    return { user, message: { speaker: 'user', text: event.text, provisional: !user.done, key: event.id } };
  }
  if (state.user && event.sourceItemId !== state.user.id) return state;
  return { ...state, message: { speaker: 'zen', text: event.text, provisional: event.phase !== 'done', key: event.id } };
}
export function latestTask(state: LatestState, event: TaskEvent): LatestState {
  if (event.utterance) return latestUtterance(state, event.utterance);
  if(state.waitingForLiveUser&&!state.user&&!['voice','storage','control'].includes(event.id))return state;
  if (event.contextConsumed || event.state === 'idle' || event.state === 'listening' || event.state === 'awaiting_approval') return state;
  if (event.id === 'voice') return state;
  if (state.user && !['voice', 'control', 'storage'].includes(event.id) && (state.taskId ? event.id !== state.taskId : !state.user.done || event.request?.trim() !== state.user.text.trim())) return state;
  const next = { ...state, ...(!['voice', 'control', 'storage'].includes(event.id) ? { taskId: event.id,...(state.taskId!==event.id?{sourceText:undefined,artifacts:undefined}:{}) } : {}) };
  if (['queued', 'thinking', 'executing'].includes(event.state) && !event.streamText) {
    if (state.message) return next;
    return { ...next, message: { speaker: event.request ? 'user' : 'zen', text: event.request ?? event.message, provisional: false, key: event.id } };
  }
  return { ...next, artifacts:event.artifacts??next.artifacts, sourceText: event.streamText ? next.sourceText : event.message, message: { speaker: 'zen', text: event.streamText ?? event.message, provisional: !!event.streamText, key: event.id } };
}
