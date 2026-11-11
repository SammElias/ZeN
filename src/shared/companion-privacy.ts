import type {CompanionStatus} from './codex-companion';
import {hasCorrelatedResult} from './companion-codex-result';

/** Redact at the main→renderer boundary, including hidden panels and IPC replies. */
export function displayStatus(raw:CompanionStatus,revision:number,visible:boolean):CompanionStatus{
 const value=structuredClone(raw);value.revision=revision;
 const workspaceVisible=visible&&value.workspace?.expanded;
 const showLatest=workspaceVisible&&!value.settings.presentation&&!value.settings.paused&&value.workspace?.page==='codex'&&value.workspace.codexTab==='summary';
 if(!workspaceVisible||value.workspace?.page!=='permissions'){
  const pendingIds=new Set(value.approvals.map(approval=>approval.id));
  for(const approval of value.approvals)approval.preview='';
  for(const session of value.sessions)for(const step of session.steps)if(pendingIds.has(step.id))delete step.preview;
 }
 for(const session of value.sessions){
  if(!showLatest||hasCorrelatedResult(session.lastReply?.text))delete session.lastReply;
 }
 if(!value.settings.presentation)return value;
 if(value.appearance)value.appearance={...value.appearance,background:'aurora',imageUrl:undefined,imageName:undefined};
 if(value.target){value.target.title='Chat de Codex';value.target.cwd='';}
 value.error=value.error?'Revisa la conexión en Codex.':undefined;
 value.targetError=value.targetError?'Revisa el chat fijado en Codex.':undefined;
 if(value.desktop){value.desktop.name=undefined;value.desktop.error=value.desktop.error?'No se pudo volver a la aplicación.':undefined;}
 value.sessions=value.sessions.map(s=>({...s,label:'Chat de Codex',title:undefined,cwd:'',tool:undefined,summary:undefined,steps:s.steps.map(t=>({id:t.id,label:'Actividad de Codex',at:t.at}))}));
 value.approvals=value.approvals.map(a=>({...a,label:'Permiso pendiente',tool:'Acción de Codex',preview:''}));
 value.notices=value.notices.map(n=>({...n,title:n.kind==='permission'?'Permiso pendiente':n.kind==='error'?'Revisar Codex':'Turno terminado'}));
 return value;
}
