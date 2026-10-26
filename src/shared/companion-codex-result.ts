import type {CompanionLastReply} from './codex-companion';

export type CodexResult={id:string;text:string;label:string;action:string;at:number;targetTitle:string};
export type CodexResultState={state:'none'|'waiting'|'expired'|'changed'}|{state:'ready';result:CodexResult};

/** Correlation is evidence from the exact final reply, never from elapsed time or a Stop alone. */
export function correlatedResult(reply:CompanionLastReply|undefined,id:string,tag:'zen_respuesta'|'zen_resultado',since:number):string|undefined{
 if(!reply||reply.truncated||reply.at<since||reply.text.length>64000)return;
 const start='<'+tag+' id="'+id+'">',end='</'+tag+'>',i=reply.text.indexOf(start);
 if(i<0||reply.text.indexOf(start,i+start.length)>=0)return;
 const j=reply.text.indexOf(end,i+start.length);
 if(j<0||reply.text.indexOf(end,j+end.length)>=0)return;
 const text=reply.text.slice(i+start.length,j).trim();
 if(!text||/<\/?zen_(?:respuesta|resultado)\b/.test(text))return;
 return text;
}

export function resultInstruction(id:string,reply=false){
 const tag=reply?'zen_respuesta':'zen_resultado';
 return '\n\nPara recuperar '+(reply?'la propuesta':'el resultado')+' en ZEN, coloca únicamente '+(reply?'el texto de respuesta':'el resultado solicitado')+' entre <'+tag+' id="'+id+'"> y </'+tag+'>. Escribe cualquier observación fuera de ese bloque. La etiqueta se usa solo para vincular el resultado.';
}
