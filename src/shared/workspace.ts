import {z} from 'zod';
import {localFileRequest} from './local-files';
import {controlIntent} from './personal';
import {folderAnalysisRequest} from './folders';
import {directOperation} from '../policy/direct';
import {authorizesNotepad} from '../policy/policy';
import type {TaskEvent} from './contracts';
import {isExternalCodexTask} from './project';
export function taskStatus(task:TaskEvent){
  if(isExternalCodexTask(task))return 'Esperando envío en Codex';
  if(task.paused)return 'En pausa';
  if(task.workContext?.phase==='review')return 'Necesita permiso';
  return {idle:'Preparada',queued:'En cola',listening:'Escuchando',thinking:'En ejecución',executing:'En ejecución',awaiting_approval:'Necesita permiso',awaiting_input:'Necesita contexto',completed:'Terminada',failed:'Interrumpida',cancelled:'Detenida'}[task.state];
}
export const FavoriteSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(50),prompt:z.string().trim().min(1).max(2000)}).strict();
export type Favorite=z.infer<typeof FavoriteSchema>;
export type TaskUsage={estimatedEur:number;inputTokens:number;outputTokens:number;uncertain:boolean;budgetEur:number};
export type SelectionContext={observationId:string;text:string;source:string};
export function requestRoute(text:string,folder=false):'local'|'codex'|'api'{
  if(folder||folderAnalysisRequest(text))return 'codex';
  try{if(localFileRequest(text))return 'local';}catch{return 'local';}
  return controlIntent(text)||directOperation(text)||authorizesNotepad(text)?'local':'api';
}
