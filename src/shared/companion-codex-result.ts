import {COMPANION_REPLY_LIMIT,type CompanionLastReply} from './codex-companion';

export type CodexResult={id:string;text:string;label:string;at:number;targetTitle:string};
export type CodexResultState={state:'none'|'waiting'|'expired'|'changed'}|{state:'ready';result:CodexResult};

const resultTag='zen_resultado';
const resultStart=(id:string)=>`<${resultTag} id="${id}">`;
const resultEnd=`</${resultTag}>`;
const anyResultStart=new RegExp(`<${resultTag}\\s+id="[\\da-f-]{36}"`,'i');

export function hasCorrelatedResult(text:string|undefined):boolean{
 return text!==undefined&&anyResultStart.test(text);
}

/** Correlation is evidence from the exact final reply, never from elapsed time or a Stop alone. */
export function correlatedResult(reply:CompanionLastReply|undefined,id:string,since:number):string|undefined{
 if(!reply||reply.truncated||reply.at<since||reply.text.length>COMPANION_REPLY_LIMIT)return;
 const start=resultStart(id),end=resultEnd,i=reply.text.indexOf(start);
 if(i<0||reply.text.indexOf(start,i+start.length)>=0)return;
 const j=reply.text.indexOf(end,i+start.length);
 if(j<0||reply.text.indexOf(end,j+end.length)>=0)return;
 const text=reply.text.slice(i+start.length,j).trim();
 if(!text||/<\/?zen_(?:respuesta|resultado)\b/.test(text))return;
 return text;
}

export function resultInstruction(id:string){
 return `\n\nPara recuperar el resultado en ZEN, coloca únicamente el resultado solicitado entre ${resultStart(id)} y ${resultEnd}. Escribe cualquier observación fuera de ese bloque. La etiqueta se usa solo para vincular el resultado.`;
}
