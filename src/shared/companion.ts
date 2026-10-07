import type {Activity} from './activity';
import type {TaskState} from './contracts';
export type RobotPose='idle'|'curious'|'listening'|'thinking'|'reading'|'typing'|'working'|'speaking'|'approval'|'success'|'concerned'|'paused';
export type RobotPresentation={pose:RobotPose;label:string;hint:string};
type Context={state:TaskState;activity?:Activity|null;busy:boolean;paused?:boolean;confirmation:boolean;microphone:boolean;speaking:boolean;meeting:boolean;contextReady:boolean;composing:boolean};
/** Presentation only: observed execution metadata, never interpretation of reply text. */
export function robotPresentation(c:Context):RobotPresentation{
  if(c.confirmation||c.state==='awaiting_approval')return{pose:'approval',label:'Tu turno',hint:'Revisa la propuesta y su código.'};
  if(c.paused)return{pose:'paused',label:'En pausa',hint:'Continúa cuando quieras.'};
  if(c.state==='failed')return{pose:'concerned',label:'Lo revisamos',hint:'La tarea necesita atención.'};
  if(c.state==='awaiting_input'&&c.activity!=='codex_external')return{pose:'curious',label:'Te necesito',hint:'Falta tu respuesta para seguir.'};
  if(c.speaking)return{pose:'speaking',label:'Te cuento',hint:'Puedes interrumpirme.'};
  if(c.microphone)return{pose:'listening',label:'Te escucho',hint:'Micrófono activo.'};
  if(c.busy){
    if(['reading','searching','searching_files','observing','verifying'].includes(c.activity??''))return{pose:'reading',label:c.activity==='verifying'?'Comprobando':'Revisando',hint:'Trabajo con el contexto de esta tarea.'};
    if(['writing','structuring','project'].includes(c.activity??''))return{pose:'typing',label:'Dándole forma',hint:'La tarea sigue en marcha.'};
    if(['executing','opening_app','opening_web','opening_codex'].includes(c.activity??''))return{pose:'working',label:'En marcha',hint:'Verás aquí el resultado.'};
    return{pose:'thinking',label:c.state==='queued'?'Esperando':'Pensando',hint:c.state==='queued'?'Tu tarea está en cola.':'Estoy preparando la respuesta.'};
  }
  if(c.composing)return{pose:'listening',label:'Te leo',hint:'Envía tu mensaje cuando esté listo.'};
  if(c.activity==='codex_external')return{pose:'idle',label:'En Codex',hint:'Puedes seguir allí o pedirme otra cosa.'};
  if(c.state==='completed')return{pose:'success',label:'Tarea completada',hint:'Puedes revisar el resultado.'};
  if(c.state==='cancelled')return{pose:'paused',label:'Detenido',hint:'No iniciaré nuevas acciones.'};
  if(c.contextReady)return{pose:'curious',label:'Todo preparado',hint:'Dime qué hacemos con esta referencia.'};
  return{pose:'idle',label:c.meeting?'Aquí, en silencio':'Estoy aquí',hint:c.meeting?'Seguimos por escrito.':'Escribe, habla o añade una captura.'};
}
