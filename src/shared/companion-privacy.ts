import type {CompanionStatus} from './codex-companion';
import {isLauncherPageSelected} from './companion-navigation';

/** Redact at the main→renderer boundary, including hidden panels and IPC replies. */
export function displayStatus(raw:CompanionStatus,revision:number,visible:boolean):CompanionStatus{
 const value=structuredClone(raw);value.revision=revision;
 const privateView=visible&&!value.settings.presentation&&!value.settings.paused;
 if(!privateView||!value.workspace?.expanded||value.workspace.page!=='metrics')delete value.oura;
 if(!privateView||!value.workspace?.expanded||value.workspace.page!=='home'){
  delete value.ouraHomeSleep;
  delete value.homeBrief;
 }
 if(!privateView||value.workspace?.expanded)delete value.ouraGlance;
 if(!privateView){
  delete value.officinaGlance;
  delete value.officinaQueueCount;
 }
 if(!privateView||!value.workspace?.expanded||value.workspace.page!=='officina'){
  delete value.officinaGlanceItems;
  delete value.officinaDecisions;
 }
 const showActivity=visible&&value.workspace?.expanded&&isLauncherPageSelected(value.workspace.page,'codex')&&!value.settings.presentation&&!value.settings.paused;
 if(!showActivity)delete value.activitySessions;
 for(const approval of value.approvals){
  if(showActivity&&(!value.target||approval.session===value.target.session||value.workspace?.page==='permissions'))continue;
  approval.preview='';approval.tool='Acción de Codex';approval.label='Permiso pendiente';
 }
 if(value.settings.paused||value.settings.presentation)value.approvalCount=0;
 for(const session of value.sessions){
  delete session.lastReply;
  delete session.summary;
  for(const step of session.steps)delete step.preview;
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
