import type {CompanionStatus} from './codex-companion';

/** Redact at the main→renderer boundary, including hidden panels and IPC replies. */
export function displayStatus(raw:CompanionStatus,revision:number):CompanionStatus{
 const value=structuredClone(raw);value.revision=revision;
 if(value.settings.presentation||value.settings.paused||!value.workspace?.expanded||value.workspace.page!=='codex')for(const session of value.sessions)delete session.lastReply;
 if(value.workspace&&(value.settings.presentation||value.settings.paused))delete value.workspace.gmail;
 if(!value.settings.presentation)return value;
 if(value.target){value.target.title='Chat de Codex';value.target.cwd='';}
 value.error=value.error?'Revisa la conexión en Codex.':undefined;
 value.targetError=value.targetError?'Revisa el chat fijado en Codex.':undefined;
 if(value.desktop){value.desktop.name=undefined;value.desktop.error=value.desktop.error?'No se pudo volver a la aplicación.':undefined;}
 if(value.integrations){value.integrations.proposal=undefined;value.integrations.lastHandoff=undefined;}
 value.sessions=value.sessions.map(s=>({...s,label:'Chat de Codex',title:undefined,cwd:'',tool:undefined,summary:undefined,steps:s.steps.map(t=>({id:t.id,label:'Actividad de Codex',at:t.at}))}));
 value.approvals=value.approvals.map(a=>({...a,label:'Permiso pendiente',tool:'Acción de Codex',preview:''}));
 value.notices=value.notices.map(n=>({...n,title:n.kind==='permission'?'Permiso pendiente':n.kind==='error'?'Revisar Codex':'Turno terminado'}));
 return value;
}
